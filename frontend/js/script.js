// ========== ОБЩИЙ JS ДЛЯ САЙТА ИСУР ==========
// Все функции из всех HTML файлов объединены в один файл

// Данные для поиска (общие для всего сайта)
const searchData = [
    { title: "Главная страница", description: "Начните с главной страницы системы ИСУР", url: "index.html", icon: "fas fa-home" },
    { title: "О нас", description: "Узнайте о нашей миссии и команде", url: "about.html", icon: "fas fa-info-circle" },
    { title: "Аналитика Москвы", description: "Интерактивные карты и данные", url: "analytics.html", icon: "fas fa-chart-line" },
    { title: "Контакты", description: "Свяжитесь с нашей командой", url: "contact.html", icon: "fas fa-envelope" },
    { title: "Городская инфраструктура", description: "Анализ развития городов", url: "analytics.html#infrastructure", icon: "fas fa-city" },
    { title: "Устойчивое развитие", description: "Экологические решения", url: "about.html#values", icon: "fas fa-seedling" },
    { title: "Транспортная доступность", description: "Отчеты по районам", url: "analytics.html#transport", icon: "fas fa-bus" },
    { title: "Социальные объекты", description: "Школы, больницы, сады", url: "analytics.html#social", icon: "fas fa-hospital" }
];

// Глобальные переменные
let mobileMenuBtn, mainNav, notification, notificationText;
let searchInput, searchResults;

// ========== ОБЩИЕ ФУНКЦИИ ==========

// Инициализация всех компонентов
function initCommonComponents() {
    // Мобильное меню
    mobileMenuBtn = document.getElementById('mobileMenuBtn');
    mainNav = document.getElementById('mainNav');
    
    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            mobileMenuBtn.innerHTML = mainNav.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                mainNav.classList.remove('active');
                if (mobileMenuBtn) mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    }
    
    // Уведомления
    notification = document.getElementById('notification');
    notificationText = document.getElementById('notification-text');
    
    // Анимация при скролле
    initScrollAnimation();
    
    // Плавная прокрутка
    initSmoothScroll();
    
    // Подсветка активного пункта меню
    highlightActiveNavLink();
}

// Функция для показа уведомлений
function showNotification(message, type = 'info', duration = 3000) {
    if (!notification || !notificationText) {
        // console.warn('Notification elements not found');
        return;
    }
    
    notificationText.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Функция для возврата на предыдущую страницу
function goBack() {
    if (document.referrer && !document.referrer.includes(window.location.hostname)) {
        window.history.back();
    } else {
        window.location.href = 'index.html';
    }
}

// Функция для выполнения поиска
function performSearch() {
    if (!searchInput || !searchResults) {
        searchInput = document.getElementById('searchInput');
        searchResults = document.getElementById('searchResults');
        if (!searchInput || !searchResults) return;
    }
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }
    
    const results = searchData.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query)
    );
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">По вашему запросу ничего не найдено. Попробуйте другой запрос.</div>';
    } else {
        let html = '<div style="background: var(--gray-light); padding: 1rem; border-radius: 10px;">';
        html += '<h4 style="margin-bottom: 1rem; color: var(--primary);">Результаты поиска:</h4>';
        html += '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
        
        results.forEach(item => {
            html += `
                <a href="${item.url}" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 8px; text-decoration: none; color: var(--dark); transition: var(--transition);">
                    <i class="${item.icon}" style="color: var(--primary); font-size: 1.25rem;"></i>
                    <div>
                        <div style="font-weight: 600; color: var(--primary);">${highlightText(item.title, query)}</div>
                        <div style="font-size: 0.875rem; color: var(--gray); margin-top: 0.25rem;">${highlightText(item.description, query)}</div>
                    </div>
                </a>
            `;
        });
        
        html += '</div></div>';
        searchResults.innerHTML = html;
        
        searchResults.querySelectorAll('a').forEach(link => {
            link.addEventListener('mouseenter', () => {
                link.style.transform = 'translateX(5px)';
                link.style.boxShadow = 'var(--card-shadow)';
            });
            link.addEventListener('mouseleave', () => {
                link.style.transform = 'translateX(0)';
                link.style.boxShadow = 'none';
            });
        });
    }
    
    searchResults.style.display = 'block';
}

// Подсветка текста
function highlightText(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span style="background: rgba(255, 230, 0, 0.4); font-weight: bold; border-radius: 3px;">$1</span>');
}

// Обработчик нажатия клавиш в поиске
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        performSearch();
    } else if (event.key === 'Escape') {
        if (searchResults) searchResults.style.display = 'none';
    } else {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(performSearch, 300);
    }
}

// Закрытие результатов поиска при клике вне области
function initSearchCloseOnClickOutside() {
    if (!searchInput || !searchResults) return;
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

// Анимация появления элементов при скролле
function initScrollAnimation() {
    const fadeElements = document.querySelectorAll('.fade-in');
    
    function checkFade() {
        fadeElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.style.opacity = 1;
                element.style.animation = 'fadeInUp 0.8s ease forwards';
            }
        });
    }
    
    checkFade();
    window.addEventListener('scroll', checkFade);
}

// Плавная прокрутка к якорям
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            const id = href;
            const element = document.querySelector(id);
            if (element) {
                e.preventDefault();
                window.scrollTo({
                    top: element.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Подсветка активного пункта меню
function highlightActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ========== ФУНКЦИИ ДЛЯ СТРАНИЦЫ ANALYTICS.HTML ==========

// Переменные для карты и графиков
let map, transportLayer, educationLayer, healthcareLayer, residentialLayer, heatLayer;

// Данные для графиков
const chartData = {
    pie: {
        labels: ['Образование', 'Парки', 'Медицина'],
        datasets: [{
            data: [40, 25, 35],
            backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 15
        }]
    },
    line: {
        education: [10, 8, 6.5, 5.2, 4.1, 3.3],
        healthcare: [9, 7.2, 5.8, 4.6, 3.7, 3.0],
        parks: [8, 6.4, 5.1, 4.1, 3.3, 2.6],
        labels: [0, 100, 200, 300, 400, 500]
    },
    bar: {
        labels: [
            'Образование', 'Медицина', 'Парки', 
            'Обр. + мед.', 'Обр. + парки', 'Мед. + парки', 'Все факторы'
        ],
        data: [4, 3, 2, 4.5, 4.25, 3.5, 5]
    }
};

// Реальные координаты объектов Москвы
const realMoscowData = {
    transport: [
        { name: "Станция метро Китай-город", lat: 55.7557, lng: 37.6312, intensity: 95 },
        { name: "Станция метро Лубянка", lat: 55.7597, lng: 37.6252, intensity: 92 },
        { name: "Станция метро Охотный ряд", lat: 55.7570, lng: 37.6168, intensity: 98 },
        { name: "Станция метро Библиотека им. Ленина", lat: 55.7520, lng: 37.6096, intensity: 90 },
        { name: "Станция метро Арбатская", lat: 55.7522, lng: 37.6035, intensity: 88 },
        { name: "Станция метро Пушкинская", lat: 55.7657, lng: 37.6052, intensity: 85 },
        { name: "Станция метро Тверская", lat: 55.7654, lng: 37.6035, intensity: 87 },
        { name: "Станция метро Театральная", lat: 55.7586, lng: 37.6174, intensity: 89 }
    ],
    education: [
        { name: "МГУ им. Ломоносова", lat: 55.7030, lng: 37.5286, intensity: 90 },
        { name: "МГТУ им. Баумана", lat: 55.7657, lng: 37.6843, intensity: 88 },
        { name: "РЭУ им. Плеханова", lat: 55.7328, lng: 37.6254, intensity: 85 },
        { name: "Школа №1253", lat: 55.7372, lng: 37.5824, intensity: 92 },
        { name: "Лицей №1535", lat: 55.7552, lng: 37.5793, intensity: 95 },
        { name: "Школа №179", lat: 55.7584, lng: 37.5952, intensity: 89 },
        { name: "Гимназия №1520", lat: 55.7623, lng: 37.6057, intensity: 87 }
    ],
    healthcare: [
        { name: "ГКБ №1 им. Пирогова", lat: 55.7312, lng: 37.6234, intensity: 88 },
        { name: "ГКБ №15 им. Филатова", lat: 55.8350, lng: 37.4150, intensity: 85 },
        { name: "НМИЦ онкологии им. Блохина", lat: 55.6550, lng: 37.6230, intensity: 90 },
        { name: "Морозовская детская больница", lat: 55.7230, lng: 37.6320, intensity: 87 },
        { name: "ГКБ им. Боткина", lat: 55.7730, lng: 37.6020, intensity: 89 },
        { name: "Институт Склифосовского", lat: 55.7876, lng: 37.6072, intensity: 94 }
    ],
    residential: [
        { name: "ЖК Царев сад", lat: 55.7500, lng: 37.6400, intensity: 85 },
        { name: "ЖК Садовые кварталы", lat: 55.7530, lng: 37.6350, intensity: 90 },
        { name: "ЖК Романов", lat: 55.7580, lng: 37.6300, intensity: 88 },
        { name: "ЖК Нескучный Home", lat: 55.7600, lng: 37.6200, intensity: 82 },
        { name: "ЖК Покровский", lat: 55.7620, lng: 37.6150, intensity: 84 },
        { name: "ЖК ЗИЛАРТ", lat: 55.6900, lng: 37.6600, intensity: 79 }
    ]
};

let pieChart, lineChart, barChart;
let currentChartTab = 'education';

// Инициализация карты
function initMap() {
    if (typeof L === 'undefined') return;
    
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;
    
    map = L.map('map-container').setView([55.7558, 37.6173], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    transportLayer = L.layerGroup().addTo(map);
    educationLayer = L.layerGroup().addTo(map);
    healthcareLayer = L.layerGroup().addTo(map);
    residentialLayer = L.layerGroup().addTo(map);
}

// Добавление маркеров на карту
function addMarkers(data, layer, color) {
    if (!layer) return;
    
    data.forEach(item => {
        const marker = L.circleMarker([item.lat, item.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.7,
            radius: 10,
            weight: 2
        }).addTo(layer);
        
        marker.bindPopup(`
            <div style="padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #1a56db; font-size: 16px;">${item.name}</h3>
                <p style="margin: 5px 0;"><strong>Интенсивность:</strong> <span style="color: #1a56db; font-weight: 600;">${item.intensity}/100</span></p>
            </div>
        `);
        
        marker.on('mouseover', function() {
            this.setStyle({ fillOpacity: 0.9, radius: 12 });
        });
        
        marker.on('mouseout', function() {
            this.setStyle({ fillOpacity: 0.7, radius: 10 });
        });
    });
}

// Загрузка данных на карту
function loadMapData() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    
    setTimeout(() => {
        if (transportLayer) transportLayer.clearLayers();
        if (educationLayer) educationLayer.clearLayers();
        if (healthcareLayer) healthcareLayer.clearLayers();
        if (residentialLayer) residentialLayer.clearLayers();
        
        addMarkers(realMoscowData.transport, transportLayer, '#3498db');
        addMarkers(realMoscowData.education, educationLayer, '#e74c3c');
        addMarkers(realMoscowData.healthcare, healthcareLayer, '#9b59b6');
        addMarkers(realMoscowData.residential, residentialLayer, '#2ecc71');
        
        const transportCount = document.getElementById('transport-count');
        const educationCount = document.getElementById('education-count');
        const healthcareCount = document.getElementById('healthcare-count');
        const residentialCount = document.getElementById('residential-count');
        
        if (transportCount) transportCount.textContent = realMoscowData.transport.length;
        if (educationCount) educationCount.textContent = realMoscowData.education.length;
        if (healthcareCount) healthcareCount.textContent = realMoscowData.healthcare.length;
        if (residentialCount) residentialCount.textContent = realMoscowData.residential.length;
        
        if (loader) loader.style.display = 'none';
        showNotification('Реальные данные Москвы успешно загружены!', 'success');
        
        window.allData = [
            ...realMoscowData.transport,
            ...realMoscowData.education,
            ...realMoscowData.healthcare,
            ...realMoscowData.residential
        ];
    }, 1500);
}

// Переключение тепловой карты
function toggleHeatmap() {
    const heatmapBtn = document.getElementById('heatmap-btn');
    if (!heatmapBtn) return;
    
    if (heatLayer) {
        if (map) map.removeLayer(heatLayer);
        heatLayer = null;
        heatmapBtn.innerHTML = '<i class="fas fa-fire"></i> Тепловая карта';
        showNotification('Тепловая карта отключена', 'info');
    } else {
        if (window.allData && window.allData.length > 0) {
            heatLayer = L.layerGroup();
            
            window.allData.forEach(point => {
                const intensity = point.intensity / 100;
                const radius = intensity * 30;
                const color = intensity > 0.8 ? '#ff0000' : 
                             intensity > 0.6 ? '#ffff00' : 
                             intensity > 0.4 ? '#00ff00' : '#0000ff';
                
                L.circle([point.lat, point.lng], {
                    radius: radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.3,
                    weight: 0
                }).addTo(heatLayer);
            });
            
            if (map) heatLayer.addTo(map);
            heatmapBtn.innerHTML = '<i class="fas fa-times"></i> Скрыть тепловую карту';
            showNotification('Тепловая карта включена', 'success');
        } else {
            showNotification('Сначала загрузите данные', 'error');
        }
    }
}

// Инициализация круговой диаграммы
function initPieChart() {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: chartData.pie,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const score = value === 40 ? 12 : value === 35 ? 10.5 : 7.5;
                            return `${label}: ${value}% (${score} баллов)`;
                        }
                    }
                }
            },
            animation: { animateScale: true, animateRotate: true, duration: 1500 }
        }
    });
}

// Инициализация линейного графика
function initLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.line.labels,
            datasets: [{
                label: 'Образование',
                data: chartData.line.education,
                borderColor: '#3b82f6',
                backgroundColor: '#3b82f620',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, title: { display: true, text: 'Расстояние (м)' } },
                y: { beginAtZero: true, max: 10, grid: { color: 'rgba(0, 0, 0, 0.05)' }, title: { display: true, text: 'Баллы' } }
            },
            animation: { duration: 1500 }
        }
    });
}

// Инициализация столбчатой диаграммы
function initBarChart() {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.bar.labels,
            datasets: [{
                label: 'Баллы',
                data: chartData.bar.data,
                backgroundColor: '#8b5cf6',
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
                y: { beginAtZero: true, max: 5, grid: { color: 'rgba(0, 0, 0, 0.05)' }, title: { display: true, text: 'Баллы' } }
            },
            animation: { duration: 1500 }
        }
    });
}

// Переключение табов линейного графика
function switchChartTab(tab) {
    currentChartTab = tab;
    
    const buttons = document.querySelectorAll('#chartTabs button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    let newData, newColor, newLabel;
    switch(tab) {
        case 'education':
            newData = chartData.line.education;
            newColor = '#3b82f6';
            newLabel = 'Образование';
            break;
        case 'healthcare':
            newData = chartData.line.healthcare;
            newColor = '#ef4444';
            newLabel = 'Медицина';
            break;
        case 'parks':
            newData = chartData.line.parks;
            newColor = '#10b981';
            newLabel = 'Парки';
            break;
    }
    
    if (lineChart) {
        lineChart.data.datasets[0].data = newData;
        lineChart.data.datasets[0].borderColor = newColor;
        lineChart.data.datasets[0].backgroundColor = newColor + '20';
        lineChart.data.datasets[0].pointBackgroundColor = newColor;
        lineChart.data.datasets[0].label = newLabel;
        lineChart.update();
        showNotification(`Переключено на ${newLabel}`, 'success');
    }
}

// Функция для определения слоя по типу
function getLayerByType(type) {
    switch(type) {
        case 'transport': return transportLayer;
        case 'education': return educationLayer;
        case 'healthcare': return healthcareLayer;
        case 'residential': return residentialLayer;
        default: return null;
    }
}

// ========== ФУНКЦИИ ДЛЯ СТРАНИЦЫ CONTACT.HTML ==========

// Обработка отправки формы обратной связи
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName')?.value.trim();
        const lastName = document.getElementById('lastName')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const subject = document.getElementById('subject')?.value;
        const message = document.getElementById('message')?.value.trim();
        
        if (!firstName || !lastName || !email || !subject || !message) {
            showNotification('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Пожалуйста, введите корректный email адрес', 'error');
            return;
        }
        
        const submitButton = this.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.textContent;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Отправка...';
        }

        try {
            const response = await fetch('/.netlify/functions/send-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone: document.getElementById('phone')?.value.trim() || '',
                    subject,
                    message
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Не удалось отправить сообщение');

            showNotification(result.message, 'success');
            this.reset();
        } catch (error) {
            console.error('Ошибка при отправке формы:', error);
            showNotification(error.message, 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
}

// Инициализация FAQ
function initFaq() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    if (!faqQuestions.length) return;
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isActive = item.classList.contains('active');
            
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if (otherItem !== item) otherItem.classList.remove('active');
            });
            
            item.classList.toggle('active', !isActive);
        });
    });
}

// ========== ФУНКЦИИ ДЛЯ СТРАНИЦЫ 404.HTML ==========

let errorNumber, neuralNetwork, particles;

// Создание нейронной сети
function createNeuralNetwork() {
    const neuralNetwork = document.getElementById('neuralNetwork');
    if (!neuralNetwork) return;
    
    const nodes = [];
    
    for (let i = 0; i < 15; i++) {
        const node = document.createElement('div');
        node.className = 'neural-node';
        node.style.left = `${Math.random() * 100}%`;
        node.style.top = `${Math.random() * 100}%`;
        node.style.animationDelay = `${Math.random() * 2}s`;
        node.style.backgroundColor = Math.random() > 0.5 ? 'var(--primary)' : 'var(--accent)';
        neuralNetwork.appendChild(node);
        nodes.push(node);
    }
}

// Создание частиц
function createParticles() {
    const particles = document.getElementById('particles');
    if (!particles) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        particle.style.backgroundColor = Math.random() > 0.7 ? 'var(--accent)' : 'var(--primary)';
        particle.style.opacity = `${0.2 + Math.random() * 0.3}`;
        particles.appendChild(particle);
    }
}

// Инициализация анимации 404 страницы
function init404Page() {
    errorNumber = document.getElementById('errorNumber');
    if (errorNumber) {
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY;
            const rotation = scrollPosition * 0.01;
            errorNumber.style.transform = `translateY(${scrollPosition * 0.05}px) rotateX(${rotation}deg) rotateY(${rotation}deg)`;
        });
    }
    
    createNeuralNetwork();
    createParticles();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

// Определение текущей страницы и инициализация специфичных функций
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация общих компонентов
    initCommonComponents();
    
    // Инициализация поиска
    searchInput = document.getElementById('searchInput');
    searchResults = document.getElementById('searchResults');
    
    if (searchInput && searchResults) {
        initSearchCloseOnClickOutside();
        searchInput.addEventListener('keyup', handleKeyPress);
        window.performSearch = performSearch;
    }
    
    // Анимация для карточек
    const cards = document.querySelectorAll('.card, .value-card, .team-member, .achievement, .capability, .link-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Инициализация страницы аналитики
    if (document.getElementById('map-container')) {
        initMap();
        
        const loadDataBtn = document.getElementById('load-data-btn');
        const heatmapBtn = document.getElementById('heatmap-btn');
        const resetViewBtn = document.getElementById('reset-view-btn');
        const locateBtn = document.getElementById('locate-btn');
        
        if (loadDataBtn) loadDataBtn.addEventListener('click', loadMapData);
        if (heatmapBtn) heatmapBtn.addEventListener('click', toggleHeatmap);
        if (resetViewBtn) resetViewBtn.addEventListener('click', () => {
            if (map) map.setView([55.7558, 37.6173], 11);
            showNotification('Вид карты сброшен к центру Москвы', 'info');
        });
        if (locateBtn) {
            locateBtn.addEventListener('click', () => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(position => {
                        if (map) {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            map.setView([lat, lng], 15);
                            L.marker([lat, lng]).addTo(map).bindPopup('Ваше текущее местоположение').openPopup();
                            showNotification('Ваше местоположение отмечено на карте', 'success');
                        }
                    }, () => {
                        showNotification('Не удалось определить ваше местоположение', 'error');
                    });
                } else {
                    showNotification('Геолокация не поддерживается вашим браузером', 'error');
                }
            });
        }
        
        document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const type = this.dataset.type;
                const layer = getLayerByType(type);
                if (layer) {
                    if (this.checked) {
                        if (map) map.addLayer(layer);
                    } else {
                        if (map) map.removeLayer(layer);
                    }
                }
            });
        });
        
        initPieChart();
        initLineChart();
        initBarChart();
        setTimeout(() => loadMapData(), 500);
    }
    
    // Инициализация страницы контактов
    initContactForm();
    initFaq();
    
    // Инициализация страницы 404
    if (document.querySelector('.error-number')) {
        init404Page();
    }
    
    // Приветственное уведомление для главной страницы
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'index.html' || currentPage === '') {
        setTimeout(() => {
            showNotification('Добро пожаловать в ИСУР! Воспользуйтесь поиском или меню.', 'info', 5000);
        }, 800);
    }
    
    // Для страницы контактов
    if (currentPage === 'contact.html') {
        setTimeout(() => {
            showNotification('Добро пожаловать на страницу контактов ИСУР! Мы всегда рады помочь вам.', 'info', 5000);
        }, 1000);
    }
    
    // Для страницы аналитики
    if (currentPage === 'analytics.html') {
        setTimeout(() => {
            showNotification('Добро пожаловать в систему аналитики Москвы! Исследуйте данные на интерактивной карте.', 'info', 5000);
        }, 1000);
    }
});