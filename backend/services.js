// ========== FUNCTIONS FOR SERVICES.HTML CHAT ==========

let messageInput, chatMessages, sendButton;
const CHAT_API_URL = window.ISUR_CHAT_API || 'http://localhost:8000/chat';
const CHAT_UPLOAD_API_URL = (window.ISUR_CHAT_API || 'http://localhost:8000/chat').replace(/\/chat$/, '/chat/upload');
const CHAT_SESSION_STORAGE_KEY = 'isur_chat_session_id';
const CHAT_HISTORY_PREFIX = 'isur_chat_history_';
const CHAT_MAX_MESSAGES = 80;
const CHAT_SESSION_ID = getOrCreateChatSessionId();
const CHAT_HISTORY_KEY = `${CHAT_HISTORY_PREFIX}${CHAT_SESSION_ID}`;
const COMPARISON_STORAGE_KEY = 'isur_buildings_comparison';
const MAX_COMPARISON_ITEMS = 5;
const MAX_UPLOAD_FILE_SIZE = 25 * 1024 * 1024;
let chatFileInput, uploadFileButton;

function getOrCreateChatSessionId() {
    const saved = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (saved && typeof saved === 'string' && saved.trim() !== '') {
        return saved;
    }
    const created = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, created);
    return created;
}

function readChatHistory() {
    try {
        const raw = localStorage.getItem(CHAT_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function writeChatHistory(records) {
    try {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(records.slice(-CHAT_MAX_MESSAGES)));
    } catch (_) {
        // ignore storage quota errors
    }
}

function persistChatMessage(record) {
    const history = readChatHistory();
    history.push(record);
    writeChatHistory(history);
}

function restoreChatHistory() {
    if (!chatMessages) return;
    const history = readChatHistory();
    if (history.length === 0) return;
    chatMessages.innerHTML = '';
    history.forEach((record) => {
        addMessage(record.text || '', record.sender || 'bot', {
            actions: record.actions || [],
            persist: false,
            time: record.time || '',
        });
    });
}

async function sendMessage() {
    if (!messageInput || !chatMessages) {
        messageInput = document.getElementById('messageInput');
        chatMessages = document.getElementById('chatMessages');
        if (!messageInput || !chatMessages) return;
    }

    const message = messageInput.value.trim();
    if (message === '') return;

    if (sendButton) {
        sendButton.style.transform = 'scale(0.9)';
        setTimeout(() => { if (sendButton) sendButton.style.transform = ''; }, 200);
    }

    addMessage(message, 'user');
    messageInput.value = '';

    const loadingId = addLoadingMessage();

    try {
        const response = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: message,
                top_n: 5,
                session_id: CHAT_SESSION_ID,
                comparison_state: getComparisonState(),
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.answer || 'Не удалось получить ответ.';

        const comparisonResult = applyBuildingsToComparison(data.buildings_to_add || []);
        const removalResult = applyComparisonRemovals(
            data.buildings_to_remove || [],
            Boolean(data.clear_comparison)
        );
        let finalAnswer = answer;
        if (shouldBuildClientComparisonAnalysis(message, data)) {
            finalAnswer = buildClientComparisonAnalysis(
                data.buildings_to_add || [],
                comparisonResult.added
            );
        } else if (comparisonResult.added > 0) {
            finalAnswer += `\n\nВ сравнение добавлено: ${comparisonResult.added}.`;
        }
        if (removalResult.cleared) {
            finalAnswer += '\n\nСписок сравнения очищен.';
        } else if (removalResult.removed > 0) {
            finalAnswer += `\n\nИз сравнения удалено: ${removalResult.removed}.`;
        }

        removeLoadingMessage(loadingId);
        addMessage(finalAnswer, 'bot', { actions: data.actions || [] });
    } catch (error) {
        console.error('Ошибка при отправке запроса:', error);
        removeLoadingMessage(loadingId);
        let errorMsg = 'Произошла ошибка при обращении к помощнику. ';
        if (String(error.message || '').includes('Failed to fetch')) {
            errorMsg += 'Проверьте, запущен ли Python-сервер (команда: uvicorn api:app --host 0.0.0.0 --port 8000).';
        } else {
            errorMsg += error.message;
        }
        addMessage(errorMsg, 'bot error');
    }
}

async function uploadChatFile() {
    if (!chatFileInput || !uploadFileButton) {
        chatFileInput = document.getElementById('chatFileInput');
        uploadFileButton = document.getElementById('uploadFileButton');
    }
    if (!chatFileInput || !uploadFileButton) return;

    const file = chatFileInput.files && chatFileInput.files[0];
    if (!file) {
        addMessage('Выберите файл перед загрузкой.', 'bot');
        return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
        addMessage('Файл слишком большой. Максимальный размер: 25 МБ.', 'bot error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    uploadFileButton.disabled = true;

    const loadingId = addLoadingMessage();
    try {
        const response = await fetch(CHAT_UPLOAD_API_URL, {
            method: 'POST',
            body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.detail || 'Ошибка загрузки файла');
        }
        removeLoadingMessage(loadingId);
        const chunksInfo = Number.isFinite(Number(payload.chunks_added))
            ? ` (фрагментов добавлено: ${payload.chunks_added})`
            : '';
        addMessage(`Документ "${file.name}" загружен и учтён в анализе${chunksInfo}.`, 'bot');
        chatFileInput.value = '';
    } catch (error) {
        removeLoadingMessage(loadingId);
        addMessage(`Не удалось загрузить файл: ${error.message || error}`, 'bot error');
    } finally {
        uploadFileButton.disabled = false;
    }
}

function addMessage(text, sender, options = {}) {
    if (!chatMessages) {
        chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;

    const time = options.time || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const textNode = document.createElement('div');
    textNode.textContent = text;
    textNode.style.whiteSpace = 'pre-wrap';
    messageElement.appendChild(textNode);

    const actions = Array.isArray(options.actions) ? options.actions : [];
    if (sender.includes('bot') && actions.length > 0) {
        const actionsWrap = document.createElement('div');
        actionsWrap.style.marginTop = '10px';
        actionsWrap.style.display = 'flex';
        actionsWrap.style.gap = '8px';
        actionsWrap.style.flexWrap = 'wrap';

        actions.forEach(action => {
            if (!action || action.type !== 'link') return;
            const safeUrl = sanitizeActionUrl(action.url);
            if (!safeUrl) return;

            const link = document.createElement('a');
            link.href = safeUrl;
            link.textContent = action.label || 'Открыть';
            link.style.display = 'inline-block';
            link.style.padding = '8px 12px';
            link.style.borderRadius = '10px';
            link.style.background = '#1B6DB7';
            link.style.color = '#fff';
            link.style.textDecoration = 'none';
            link.style.fontSize = '0.9rem';
            actionsWrap.appendChild(link);
        });

        if (actionsWrap.childElementCount > 0) {
            messageElement.appendChild(actionsWrap);
        }
    }

    const timeNode = document.createElement('div');
    timeNode.className = 'message-time';
    timeNode.textContent = time;
    messageElement.appendChild(timeNode);

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });

    if (options.persist !== false) {
        persistChatMessage({
            sender,
            text,
            actions,
            time,
            sessionId: CHAT_SESSION_ID,
        });
    }
}

function sanitizeActionUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') return null;
    const value = url.trim();
    if (value.startsWith('/')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return null;
}

function getComparisonState() {
    try {
        const stored = localStorage.getItem(COMPARISON_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function applyBuildingsToComparison(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { added: 0, skipped: 0 };
    }

    let added = 0;
    let skipped = 0;

    items.forEach(item => {
        const normalized = normalizeComparisonBuilding(item);
        if (!normalized) {
            skipped += 1;
            return;
        }

        if (window.ISURComparison && typeof window.ISURComparison.addBuilding === 'function') {
            const ok = window.ISURComparison.addBuilding(normalized);
            if (ok) added += 1;
            else skipped += 1;
            return;
        }

        const fallbackOk = addToComparisonStorage(normalized);
        if (fallbackOk) added += 1;
        else skipped += 1;
    });

    if (added > 0) {
        window.dispatchEvent(new Event('comparisonUpdated'));
    }

    return { added, skipped };
}

function applyComparisonRemovals(items, clearAll = false) {
    if (clearAll) {
        const before = getComparisonState();
        localStorage.removeItem(COMPARISON_STORAGE_KEY);
        window.dispatchEvent(new Event('comparisonUpdated'));
        return { removed: before.length, cleared: true };
    }

    if (!Array.isArray(items) || items.length === 0) {
        return { removed: 0, cleared: false };
    }

    const before = getComparisonState();
    if (before.length === 0) {
        return { removed: 0, cleared: false };
    }

    const targets = items
        .map(item => normalizeComparisonBuilding(item))
        .filter(Boolean);

    if (targets.length === 0) {
        return { removed: 0, cleared: false };
    }

    const filtered = before.filter(existing => !targets.some(target => isSameComparisonBuilding(existing, target)));
    const removed = before.length - filtered.length;
    if (removed > 0) {
        localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new Event('comparisonUpdated'));
    }
    return { removed, cleared: false };
}

function normalizeComparisonBuilding(item) {
    if (!item || typeof item !== 'object') return null;

    const address = typeof item.address === 'string' ? item.address.trim() : '';
    if (!address) return null;

    const lat = parseNumber(item.lat);
    const lon = parseNumber(item.lon);

    return {
        id: String(item.id || `chat_${address}`),
        address,
        lat,
        lon,
        socialScore: parseNumber(item.socialScore),
        qualityScore: parseNumber(item.qualityScore),
        transportScore: parseNumber(item.transportScore),
        totalScore: parseNumber(item.totalScore),
        floors: item.floors ?? null,
        build_year: item.build_year ?? null,
        is_emergency: item.is_emergency ?? null,
        addedAt: item.addedAt || new Date().toISOString(),
    };
}

function shouldBuildClientComparisonAnalysis(message, data) {
    const askedAnalysis = /(анализ|аналитик|аналитику|проанализ|оцени|оценк|сравни|сопостав)/i.test(String(message || ''));
    return askedAnalysis && Array.isArray(data && data.buildings_to_add) && data.buildings_to_add.length > 0;
}

function buildClientComparisonAnalysis(items, addedCount = 0) {
    const buildings = items
        .map(item => normalizeComparisonBuilding(item))
        .filter(Boolean)
        .sort((left, right) => scoreValue(right.totalScore) - scoreValue(left.totalScore));

    if (buildings.length === 0) {
        return 'Добавил объекты в сравнение, но не смог собрать рейтинги для анализа.';
    }

    const lines = [];
    lines.push(
        addedCount > 0
            ? `Добавил в сравнение ${addedCount} объект(а) и сразу провёл анализ.`
            : 'Эти объекты уже есть в сравнении, сразу провёл анализ.'
    );

    if (buildings.length >= 2) {
        const leader = buildings[0];
        const last = buildings[buildings.length - 1];
        const leaderScore = parseNumber(leader.totalScore);
        const lastScore = parseNumber(last.totalScore);
        if (leaderScore !== null && lastScore !== null) {
            lines.push(
                `Вывод: сильнее выглядит ${leader.address} — общий рейтинг ${formatScore(leaderScore)}, ` +
                `это на ${formatScore(leaderScore - lastScore)} выше, чем у ${last.address}.`
            );
        } else {
            lines.push(`Вывод: по доступным данным сильнее выглядит ${leader.address}.`);
        }
    }

    lines.push('');
    lines.push('По объектам:');
    buildings.forEach((building) => {
        const parts = [`- ${building.address}`];
        appendMetric(parts, 'общий рейтинг', building.totalScore);
        appendMetric(parts, 'социальная среда', building.socialScore);
        appendMetric(parts, 'инфраструктура', building.qualityScore);
        appendMetric(parts, 'транспорт', building.transportScore);
        if (building.build_year) parts.push(`год постройки ${building.build_year}`);
        if (building.floors) parts.push(`${building.floors} этажей`);
        lines.push(`${parts.join(', ')}.`);
    });

    if (buildings.length >= 2) {
        const top = buildings[0];
        const next = buildings[1];
        lines.push('');
        lines.push('Ключевые различия:');
        lines.push(`- социальная среда: ${metricDelta(top, next, 'socialScore')}`);
        lines.push(`- инфраструктура: ${metricDelta(top, next, 'qualityScore')}`);
        lines.push(`- транспорт: ${metricDelta(top, next, 'transportScore')}`);
    }

    lines.push('');
    lines.push('Практически: для проживания лучше смотреть на общий и социальный рейтинг; для инвестиционного вывода нужны цена, площадь и срок прогноза.');
    return lines.join('\n');
}

function appendMetric(parts, label, value) {
    const parsed = parseNumber(value);
    if (parsed !== null) parts.push(`${label} ${formatScore(parsed)}`);
}

function metricDelta(left, right, key) {
    const leftValue = parseNumber(left[key]);
    const rightValue = parseNumber(right[key]);
    if (leftValue === null || rightValue === null) return 'нет данных';
    if (Math.abs(leftValue - rightValue) < 0.01) return `одинаково (${formatScore(leftValue)})`;
    const better = leftValue > rightValue ? left.address : right.address;
    return `лучше у ${better} (${formatScore(Math.max(leftValue, rightValue))} против ${formatScore(Math.min(leftValue, rightValue))})`;
}

function formatScore(value) {
    return Number(value).toFixed(2);
}

function scoreValue(value) {
    const parsed = parseNumber(value);
    return parsed === null ? -1 : parsed;
}

function isSameComparisonBuilding(left, right) {
    if (!left || !right) return false;
    const leftId = String(left.id || '').trim();
    const rightId = String(right.id || '').trim();
    if (leftId && rightId && leftId === rightId) return true;
    return normalizeAddress(left.address) === normalizeAddress(right.address);
}

function parseNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function addToComparisonStorage(building) {
    let buildings = getComparisonState();

    const duplicate = buildings.some(item =>
        String(item.id) === String(building.id) ||
        normalizeAddress(item.address) === normalizeAddress(building.address)
    );

    if (duplicate) return false;
    if (buildings.length >= MAX_COMPARISON_ITEMS) return false;

    buildings.push(building);
    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(buildings));
    return true;
}

function normalizeAddress(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function addLoadingMessage() {
    if (!chatMessages) return null;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot loading';
    loadingDiv.id = 'loading-' + Date.now();
    loadingDiv.innerHTML = '<div>Мими думает...</div><div class="message-time">...</div>';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    return loadingDiv.id;
}

function removeLoadingMessage(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) loadingDiv.remove();
}

function quickAction(action) {
    if (!messageInput) {
        messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
    }

    let message = '';
    switch (action) {
        case 'report':
            message = 'Создать отчет по городской инфраструктуре за последний квартал';
            break;
        case 'analyze':
            message = 'Проанализировать данные о транспортной доступности в центральном округе';
            break;
        case 'help':
            message = 'Какие возможности у помощника МИМИ?';
            break;
    }

    messageInput.value = message;
    messageInput.focus();
    sendMessage();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    messageInput = document.getElementById('messageInput');
    chatMessages = document.getElementById('chatMessages');
    sendButton = document.getElementById('sendButton');
    chatFileInput = document.getElementById('chatFileInput');
    uploadFileButton = document.getElementById('uploadFileButton');
    restoreChatHistory();

    if (uploadFileButton) {
        uploadFileButton.addEventListener('click', uploadChatFile);
    }
});
