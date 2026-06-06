// diffs.js - Логика страницы сравнения объектов

class ComparisonManager {
    constructor() {
        this.buildings = [];
        this.storageKey = 'isur_buildings_comparison';
        this.maxBuildings = 5;
        
        this.init();
    }
    
    init() {
        this.loadFromStorage();
        this.renderBuildings();
        this.setupEventListeners();
        
        if (this.buildings.length > 0) {
            this.showComparison();
        }
    }
    
    loadFromStorage() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.buildings = JSON.parse(stored);
                console.log(`Загружено ${this.buildings.length} объектов из хранилища`);
            } catch (e) {
                console.error('Ошибка при чтении из хранилища:', e);
                this.buildings = [];
            }
        }
    }
    
    saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.buildings));
    }
    
    addBuilding(building) {
        // Проверяем, не добавлен ли уже этот объект
        const exists = this.buildings.some(b => 
            b.id === building.id
        );
        
        if (exists) {
            this.showNotification('Этот объект уже добавлен в сравнение', 'warning');
            return false;
        }
        
        // Проверяем лимит
        if (this.buildings.length >= this.maxBuildings) {
            this.showNotification(`Максимальное количество объектов для сравнения: ${this.maxBuildings}. Удалите некоторые объекты, чтобы добавить новые.`, 'error');
            return false;
        }
        
        this.buildings.push(building);
        this.saveToStorage();
        this.renderBuildings();
        this.showComparison();
        this.showNotification(`Объект добавлен в сравнение (${this.buildings.length}/${this.maxBuildings})`, 'success');
        
        return true;
    }
    
    removeBuilding(index) {
        if (index >= 0 && index < this.buildings.length) {
            const building = this.buildings[index];
            this.buildings.splice(index, 1);
            this.saveToStorage();
            this.renderBuildings();
            this.showNotification(`Объект "${building.address || 'Без адреса'}" удален`, 'success');
            
            if (this.buildings.length === 0) {
                this.hideComparison();
            } else {
                this.showComparison();
            }
        }
    }
    
    clearAll() {
        if (this.buildings.length > 0) {
            this.buildings = [];
            this.saveToStorage();
            this.renderBuildings();
            this.hideComparison();
            this.showNotification('Все объекты удалены из сравнения', 'success');
        }
    }
    
    renderBuildings() {
        const container = document.getElementById('buildings-list');
        const emptyState = document.getElementById('empty-state');
        const countElement = document.getElementById('selected-count');
        
        countElement.textContent = this.buildings.length;
        
        if (this.buildings.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        container.innerHTML = '';
        
        this.buildings.forEach((building, index) => {
            const card = this.createBuildingCard(building, index);
            container.appendChild(card);
        });
        
        // Обновляем лимит в заголовке
        const title = document.querySelector('.selected-title h2');
        if (title) {
            const badge = title.querySelector('.badge');
            if (badge) {
                badge.innerHTML = `${this.buildings.length}<span style="font-size: 10px; margin-left: 3px;">/${this.maxBuildings}</span>`;
            }
        }
    }
    
    createBuildingCard(building, index) {
        const card = document.createElement('div');
        card.className = 'building-card';
        
        const getRatingClass = (rating) => {
            if (!rating || rating === 'Н/Д') return 'rating-average';
            if (rating >= 80) return 'rating-excellent';
            if (rating >= 60) return 'rating-good';
            if (rating >= 40) return 'rating-average';
            return 'rating-poor';
        };
        
        const formatRating = (rating) => {
            if (rating === null || rating === undefined) return 'Н/Д';
            if (typeof rating === 'number') return rating.toFixed(2);
            return rating;
        };
        
        const formatAddress = (address) => {
            if (!address) return 'Адрес не указан';
            // Ограничиваем длину адреса
            if (address.length > 50) {
                return address.substring(0, 50) + '...';
            }
            return address;
        };
        
        card.innerHTML = `
            <button class="remove-btn" data-index="${index}" title="Удалить из сравнения">
                <i class="fas fa-times"></i>
            </button>
            <div class="building-address" title="${building.address || 'Адрес не указан'}">${formatAddress(building.address)}</div>
            <ul class="building-details">
                <li>
                    <span class="label">Общий рейтинг:</span>
                    <span class="value">
                        <span class="rating-badge ${getRatingClass(building.totalScore)}">
                            ${formatRating(building.totalScore)}
                        </span>
                    </span>
                </li>
                <li>
                    <span class="label">Социальный:</span>
                    <span class="value">${formatRating(building.socialScore)}</span>
                </li>
                <li>
                    <span class="label">Качество:</span>
                    <span class="value">${formatRating(building.qualityScore)}</span>
                </li>
                <li>
                    <span class="label">Транспорт:</span>
                    <span class="value">${formatRating(building.transportScore)}</span>
                </li>
                <li>
                    <span class="label">Этажность:</span>
                    <span class="value">${building.floors || 'Н/Д'}</span>
                </li>
                <li>
                    <span class="label">Год постройки:</span>
                    <span class="value">${building.build_year || 'Н/Д'}</span>
                </li>
                <li>
                    <span class="label">Аварийность:</span>
                    <span class="value">${building.is_emergency || 'Н/Д'}</span>
                </li>
                <li>
                    <span class="label">Добавлен:</span>
                    <span class="value">${building.addedAt ? new Date(building.addedAt).toLocaleDateString('ru-RU') : 'Недавно'}</span>
                </li>
            </ul>
        `;
        
        card.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeBuilding(index);
        });
        
        return card;
    }
    
    showComparison() {
        document.getElementById('comparison-section').style.display = 'block';
        document.getElementById('charts-section').style.display = 'block';
        this.renderComparisonTable();
        this.renderCharts();
    }
    
    hideComparison() {
        document.getElementById('comparison-section').style.display = 'none';
        document.getElementById('charts-section').style.display = 'none';
    }
    
    renderComparisonTable() {
        const table = document.getElementById('comparison-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        
        // Очищаем таблицу
        thead.innerHTML = '<tr><th class="param-name">Параметр</th></tr>';
        tbody.innerHTML = '';
        
        if (this.buildings.length === 0) return;
        
        // Добавляем заголовки колонок (объекты)
        const headerRow = thead.querySelector('tr');
        this.buildings.forEach((building, index) => {
            const th = document.createElement('th');
            th.textContent = building.address ? 
                (building.address.length > 30 ? building.address.substring(0, 30) + '...' : building.address) : 
                `Объект ${index + 1}`;
            th.title = building.address || `Объект ${index + 1}`;
            headerRow.appendChild(th);
        });
        
        // Параметры для сравнения
        const parameters = [
            { key: 'address', label: 'Адрес', formatter: v => v || 'Н/Д' },
            { key: 'totalScore', label: 'Общий рейтинг', formatter: v => v ? v.toFixed(2) : 'Н/Д' },
            { key: 'socialScore', label: 'Социальный рейтинг', formatter: v => v ? v.toFixed(2) : 'Н/Д' },
            { key: 'qualityScore', label: 'Качество инфраструктуры', formatter: v => v ? v.toFixed(2) : 'Н/Д' },
            { key: 'transportScore', label: 'Транспортная доступность', formatter: v => v ? v.toFixed(2) : 'Н/Д' },
            { key: 'floors', label: 'Этажность', formatter: v => v || 'Н/Д' },
            { key: 'build_year', label: 'Год постройки', formatter: v => v || 'Н/Д' },
            { key: 'is_emergency', label: 'Аварийность', formatter: v => v || 'Н/Д' },
            { key: 'lat', label: 'Широта', formatter: v => v || 'Н/Д' },
            { key: 'lon', label: 'Долгота', formatter: v => v || 'Н/Д' }
        ];
        
        // Добавляем строки с параметрами
        parameters.forEach(param => {
            const row = document.createElement('tr');
            const paramCell = document.createElement('td');
            paramCell.className = 'param-name';
            paramCell.textContent = param.label;
            row.appendChild(paramCell);
            
            this.buildings.forEach(building => {
                const valueCell = document.createElement('td');
                let value = building[param.key];
                
                if (param.formatter) {
                    value = param.formatter(value);
                }
                
                valueCell.textContent = value || 'Н/Д';
                
                // Подсветка лучших значений для рейтингов
                if (param.key.includes('Score') && typeof building[param.key] === 'number') {
                    const numValue = building[param.key];
                    if (numValue >= 80) valueCell.style.color = '#10B981';
                    else if (numValue >= 60) valueCell.style.color = '#3B82F6';
                    else if (numValue >= 40) valueCell.style.color = '#F59E0B';
                    else if (numValue > 0) valueCell.style.color = '#EF4444';
                }
                
                row.appendChild(valueCell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    renderCharts() {
        if (this.buildings.length === 0) return;
        
        // Уничтожаем старые графики, если они есть
        if (window.ratingsChart) {
            window.ratingsChart.destroy();
        }
        if (window.distributionChart) {
            window.distributionChart.destroy();
        }
        
        // Данные для графиков
        const labels = this.buildings.map(b => b.address ? 
            (b.address.length > 20 ? b.address.substring(0, 20) + '...' : b.address) : 
            'Объект');
        const addresses = this.buildings.map(b => b.address || 'Объект');
        
        const socialScores = this.buildings.map(b => b.socialScore || 0);
        const qualityScores = this.buildings.map(b => b.qualityScore || 0);
        const transportScores = this.buildings.map(b => b.transportScore || 0);
        const totalScores = this.buildings.map(b => b.totalScore || 0);
        
        // График сравнения рейтингов
        const ratingsCtx = document.getElementById('ratings-chart');
        if (ratingsCtx) {
            window.ratingsChart = new Chart(ratingsCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Социальный рейтинг',
                            data: socialScores,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Качество инфраструктуры',
                            data: qualityScores,
                            backgroundColor: 'rgba(255, 99, 132, 0.7)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Транспортная доступность',
                            data: transportScores,
                            backgroundColor: 'rgba(255, 159, 64, 0.7)',
                            borderColor: 'rgba(255, 159, 64, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Общий рейтинг',
                            data: totalScores,
                            backgroundColor: 'rgba(75, 192, 192, 0.7)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Оценка'
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.raw !== null) {
                                        label += context.raw.toFixed(2);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Радарная диаграмма для ВСЕХ объектов сравнения
        const distributionCtx = document.getElementById('distribution-chart');
        if (distributionCtx && this.buildings.length > 0) {
            // Создаем цветовую палитру
            const colors = [
                'rgba(54, 162, 235, 0.5)',  // синий
                'rgba(255, 99, 132, 0.5)',  // красный
                'rgba(255, 159, 64, 0.5)',  // оранжевый
                'rgba(75, 192, 192, 0.5)',  // зеленый
                'rgba(153, 102, 255, 0.5)', // фиолетовый
            ];
            
            const borderColors = [
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
            ];
            
            // Создаем наборы данных для каждого объекта
            const datasets = this.buildings.map((building, index) => {
                // Рассчитываем возраст здания (в годах)
                const currentYear = new Date().getFullYear();
                const buildYear = parseInt(building.build_year) || currentYear - 50;
                const age = currentYear - buildYear;
                const ageScore = Math.max(0, 100 - (age * 2)); // Чем старше, тем ниже оценка
                
                // Рассчитываем оценку этажности (идеально 5-10 этажей)
                const floors = parseInt(building.floors) || 5;
                let floorScore;
                if (floors <= 3) floorScore = 60; // Малоэтажка
                else if (floors <= 10) floorScore = 90; // Оптимально
                else if (floors <= 20) floorScore = 70; // Высотка
                else floorScore = 50; // Очень высокая
                
                return {
                    label: building.address ? 
                        (building.address.length > 20 ? building.address.substring(0, 20) + '...' : building.address) : 
                        `Объект ${index + 1}`,
                    data: [
                        building.socialScore || 0,
                        building.qualityScore || 0,
                        building.transportScore || 0,
                        floorScore,
                        ageScore
                    ],
                    backgroundColor: colors[index % colors.length],
                    borderColor: borderColors[index % borderColors.length],
                    pointBackgroundColor: borderColors[index % borderColors.length],
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: borderColors[index % borderColors.length],
                    borderWidth: 2,
                    fill: true
                };
            });
            
            window.distributionChart = new Chart(distributionCtx, {
                type: 'radar',
                data: {
                    labels: ['Социальный', 'Качество', 'Транспорт', 'Этажность', 'Возраст'],
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    scales: {
                        r: {
                            angleLines: {
                                display: true
                            },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            ticks: {
                                stepSize: 20
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notification-message');
        
        if (!notification || !messageEl) return;
        
        notification.className = `notification ${type}`;
        messageEl.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    setupEventListeners() {
        // Кнопка "Очистить все"
        const clearBtn = document.getElementById('clear-all-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.buildings.length > 0) {
                    if (confirm('Вы уверены, что хотите удалить все объекты из сравнения?')) {
                        this.clearAll();
                    }
                }
            });
        }
        
        // Синхронизация вкладок
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey) {
                this.loadFromStorage();
                this.renderBuildings();
                if (this.buildings.length > 0) {
                    this.showComparison();
                } else {
                    this.hideComparison();
                }
            }
        });
        
        // Обновление при изменении данных в той же вкладке
        window.addEventListener('comparisonUpdated', () => {
            this.loadFromStorage();
            this.renderBuildings();
            if (this.buildings.length > 0) {
                this.showComparison();
            } else {
                this.hideComparison();
            }
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.comparisonManager = new ComparisonManager();
});

// Глобальные функции для добавления объектов со страницы аналитики
window.ISURComparison = {
    addBuilding: function(buildingData) {
        const manager = window.comparisonManager || new ComparisonManager();
        return manager.addBuilding(buildingData);
    },

    removeBuilding: function(identifier) {
        const manager = window.comparisonManager || new ComparisonManager();
        const index = manager.buildings.findIndex(item =>
            String(item.id || '') === String(identifier || '') ||
            String(item.address || '').trim().toLowerCase() === String(identifier || '').trim().toLowerCase()
        );
        if (index === -1) {
            return false;
        }
        manager.removeBuilding(index);
        return true;
    },
    
    getBuildings: function() {
        const stored = localStorage.getItem('isur_buildings_comparison');
        return stored ? JSON.parse(stored) : [];
    },
    
    clearBuildings: function() {
        localStorage.removeItem('isur_buildings_comparison');
        const event = new Event('comparisonUpdated');
        window.dispatchEvent(event);
    },
    
    getCount: function() {
        const stored = localStorage.getItem('isur_buildings_comparison');
        const buildings = stored ? JSON.parse(stored) : [];
        return buildings.length;
    },
    
    getMaxLimit: function() {
        return 5;
    }
};
