// DOM элементы
const distanceInput = document.getElementById("distance");
const minDistanceInput = document.getElementById("min-distance");

// Чекбоксы фильтров
const filterSchool = document.getElementById("filter-school");
const filterHospital = document.getElementById("filter-hospital");
const filterBuilding = document.getElementById("filter-building");
const filterMetro = document.getElementById("filter-metro");
const filterStop = document.getElementById("filter-stop");

// Кнопки управления
const resetViewBtn = document.getElementById("reset-view-btn");
const loadDataBtn = document.getElementById("load-data-btn");

// Панель информации
const infoPanel = document.getElementById("info-panel");
const infoTitle = document.getElementById("info-title");
const infoContent = document.getElementById("info-content");
const addToCompareBtn = document.getElementById("add-to-compare-btn");
const detailedAnalysisBtn = document.getElementById("detailed-analysis-btn");
const closeBtn = document.getElementById("close-btn");

// Источники данных
let source, clusterSource, map;

// Все типы объектов
const allFeaturesByType = {
  building: [],
  school: [],
  hospital: [],
  metro: [],
  stop: [],
};

// Реальные данные по районам Москвы (обновленные на основе открытых данных)
const moscowDistrictsData = [
  { name: "Центральный", population: 753696, area: 66.2, density: 11388, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Северный", population: 1147599, area: 113.7, density: 10090, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Северо-Восточный", population: 1416748, area: 101.9, density: 13906, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Восточный", population: 1516345, area: 154.8, density: 9793, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Юго-Восточный", population: 1414777, area: 117.6, density: 12035, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Южный", population: 1792876, area: 131.8, density: 13606, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Юго-Западный", population: 1438957, area: 111.4, density: 12922, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Западный", population: 1309828, area: 153.0, density: 8559, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Северо-Западный", population: 980940, area: 93.3, density: 10516, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 },
  { name: "Зеленоградский", population: 250173, area: 37.2, density: 6721, infrastructure: 0, transport: 0, education: 0, healthcare: 0, housing: 0, schools: 0, hospitals: 0, metro: 0, stops: 0, buildings: 0 }
];

// Переменная для хранения обработанных данных районов
let moscowDistricts = [...moscowDistrictsData];

// Текущий выбранный объект для сравнения
let currentSelectedObject = null;

// Функция для определения района по координатам (упрощенная логика)
function getDistrictByCoordinates(lat, lon) {
  // Центральный административный округ
  if (lat >= 55.73 && lat <= 55.78 && lon >= 37.55 && lon <= 37.65) {
    return "Центральный";
  }
  // Северный административный округ
  else if (lat >= 55.83 && lat <= 55.90 && lon >= 37.47 && lon <= 37.62) {
    return "Северный";
  }
  // Северо-Восточный административный округ
  else if (lat >= 55.83 && lat <= 55.90 && lon >= 37.58 && lon <= 37.70) {
    return "Северо-Восточный";
  }
  // Восточный административный округ
  else if (lat >= 55.75 && lat <= 55.83 && lon >= 37.70 && lon <= 37.90) {
    return "Восточный";
  }
  // Юго-Восточный административный округ
  else if (lat >= 55.65 && lat <= 55.75 && lon >= 37.70 && lon <= 37.85) {
    return "Юго-Восточный";
  }
  // Южный административный округ
  else if (lat >= 55.60 && lat <= 55.70 && lon >= 37.60 && lon <= 37.82) {
    return "Южный";
  }
  // Юго-Западный административный округ
  else if (lat >= 55.60 && lat <= 55.70 && lon >= 37.45 && lon <= 37.65) {
    return "Юго-Западный";
  }
  // Западный административный округ
  else if (lat >= 55.70 && lat <= 55.78 && lon >= 37.35 && lon <= 37.55) {
    return "Западный";
  }
  // Северо-Западный административный округ
  else if (lat >= 55.78 && lat <= 55.85 && lon >= 37.35 && lon <= 37.55) {
    return "Северо-Западный";
  }
  // Зеленоградский административный округ
  else if (lat >= 55.98 && lat <= 56.02 && lon >= 37.15 && lon <= 37.25) {
    return "Зеленоградский";
  }
  else {
    // Если координаты не попадают в четкие границы, определяем по ближайшему центру
    const districtCenters = {
      "Центральный": { lat: 55.7558, lon: 37.6173 },
      "Северный": { lat: 55.835, lon: 37.55 },
      "Северо-Восточный": { lat: 55.85, lon: 37.63 },
      "Восточный": { lat: 55.78, lon: 37.8 },
      "Юго-Восточный": { lat: 55.70, lon: 37.75 },
      "Южный": { lat: 55.65, lon: 37.7 },
      "Юго-Западный": { lat: 55.65, lon: 37.55 },
      "Западный": { lat: 55.73, lon: 37.45 },
      "Северо-Западный": { lat: 55.83, lon: 37.43 },
      "Зеленоградский": { lat: 55.98, lon: 37.18 }
    };

    let closestDistrict = "Центральный";
    let minDistance = Number.MAX_VALUE;

    for (const [district, center] of Object.entries(districtCenters)) {
      const distance = Math.sqrt(Math.pow(lat - center.lat, 2) + Math.pow(lon - center.lon, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestDistrict = district;
      }
    }

    return closestDistrict;
  }
}

// Обновление слоя кластеров
function updateClusterLayer() {
  if (!source) return;

  const filteredFeatures = [];
  if (filterBuilding?.checked)
    filteredFeatures.push(...allFeaturesByType.building);
  if (filterSchool?.checked) filteredFeatures.push(...allFeaturesByType.school);
  if (filterHospital?.checked)
    filteredFeatures.push(...allFeaturesByType.hospital);
  if (filterMetro?.checked) filteredFeatures.push(...allFeaturesByType.metro);
  if (filterStop?.checked) filteredFeatures.push(...allFeaturesByType.stop);

  source.clear();
  if (filteredFeatures.length > 0) {
    source.addFeatures(filteredFeatures);
  }

  // Обновляем статистику
  updateStats();
}

// Обновление статистики
function updateStats() {
  const buildingCount = document.getElementById("building-count");
  const schoolCount = document.getElementById("school-count");
  const hospitalCount = document.getElementById("hospital-count");
  const metroCount = document.getElementById("metro-count");
  const stopCount = document.getElementById("stop-count");

  if (buildingCount) buildingCount.textContent = allFeaturesByType.building.length;
  if (schoolCount) schoolCount.textContent = allFeaturesByType.school.length;
  if (hospitalCount) hospitalCount.textContent = allFeaturesByType.hospital.length;
  if (metroCount) metroCount.textContent = allFeaturesByType.metro.length;
  if (stopCount) stopCount.textContent = allFeaturesByType.stop.length;
}

// Показать информацию об объекте в панели
function showInfoPanel(event, data) {
  if (!infoPanel) return;

  // Устанавливаем позицию панели в месте клика
  const mapContainer = document.getElementById('map-container');
  const rect = mapContainer.getBoundingClientRect();

  // Координаты клика относительно карты
  let x = event.clientX - rect.left + 20;
  let y = event.clientY - rect.top + 20;

  // Проверяем, чтобы панель не выходила за границы карты
  if (x + 400 > rect.width) {
    x = event.clientX - rect.left - 420;
  }

  if (y + 300 > rect.height) {
    y = event.clientY - rect.top - 320;
  }

  infoPanel.style.left = x + 'px';
  infoPanel.style.top = y + 'px';

  // Заполняем данные
  infoTitle.textContent = data.title || 'Информация';
  infoContent.innerHTML = data.content || 'Нет информации';

  // Настраиваем кнопку добавления к сравнению
  if (data.type === 'building' && data.id) {
    addToCompareBtn.style.display = 'flex';
    addToCompareBtn.onclick = function () {
      addToComparison(data);
    };

    // Проверяем, добавлен ли уже этот объект
    const buildings = JSON.parse(localStorage.getItem('isur_buildings_comparison') || '[]');
    const isAlreadyAdded = buildings.some(b => b.id === data.id);

    if (isAlreadyAdded) {
      addToCompareBtn.innerHTML = '<i class="fas fa-check"></i> Уже добавлено';
      addToCompareBtn.classList.add('disabled');
      addToCompareBtn.disabled = true;
    } else {
      addToCompareBtn.innerHTML = '<i class="fas fa-balance-scale"></i> Добавить к сравнению';
      addToCompareBtn.classList.remove('disabled');
      addToCompareBtn.disabled = false;
    }
  } else {
    addToCompareBtn.style.display = 'none';
  }

  // Настраиваем кнопку детального анализа
  if (data.detailsUrl) {
    detailedAnalysisBtn.href = data.detailsUrl;
    detailedAnalysisBtn.style.display = 'flex';
  } else {
    detailedAnalysisBtn.style.display = 'none';
  }

  // Сохраняем текущий объект
  currentSelectedObject = data;

  // Показываем панель
  infoPanel.classList.add('show');

  // Добавляем обработчик кликов для закрытия панели
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 10);
}

// Обработчик клика вне панели
function handleOutsideClick(event) {
  if (!infoPanel || !infoPanel.classList.contains('show')) return;

  // Проверяем, был ли клик внутри панели
  if (infoPanel.contains(event.target)) {
    return; // Клик внутри панели - не закрываем
  }

  // Проверяем, был ли клик на кнопке закрытия
  if (event.target === closeBtn || event.target.closest('#close-btn')) {
    closeInfoPanel();
    return;
  }

  // Проверяем, был ли клик на чекбоксах фильтров
  if (event.target.closest('.filter-options') ||
    event.target.closest('.map-controls') ||
    event.target.closest('.map-buttons')) {
    return; // Не закрываем при клике на элементы управления картой
  }

  // Закрываем панель при клике в любом другом месте
  closeInfoPanel();
}

// Закрыть панель информации
function closeInfoPanel() {
  if (infoPanel) {
    infoPanel.classList.remove('show');
    currentSelectedObject = null;

    // Удаляем обработчик кликов
    document.removeEventListener('click', handleOutsideClick);
  }
}

// Добавить объект к сравнению
function addToComparison(objectData) {
  try {
    const storageKey = 'isur_buildings_comparison';
    const stored = localStorage.getItem(storageKey);
    let buildings = stored ? JSON.parse(stored) : [];
    const maxBuildings = 5;

    // Проверяем, не добавлен ли уже этот объект
    const exists = buildings.some(b => b.id === objectData.id);

    if (exists) {
      showNotification('Этот объект уже добавлен в сравнение', 'warning');
      return false;
    }

    // Проверяем лимит (максимум 5 объектов)
    if (buildings.length >= maxBuildings) {
      showNotification(`Достигнут лимит сравнения: ${maxBuildings} объектов. Перейдите на страницу сравнения и удалите ненужные объекты.`, 'error');

      // Показать ссылку на страницу сравнения
      setTimeout(() => {
        if (confirm(`Достигнут лимит сравнения (${maxBuildings} объектов). Перейти на страницу сравнения?`)) {
          window.open('diffs.html', '_blank');
        }
      }, 500);

      return false;
    }

    // Добавляем объект
    buildings.push({
      id: objectData.id,
      type: objectData.type,
      title: objectData.title,
      address: objectData.address,
      lat: objectData.lat,
      lon: objectData.lon,
      socialScore: objectData.socialScore,
      qualityScore: objectData.qualityScore,
      transportScore: objectData.transportScore,
      totalScore: objectData.totalScore,
      floors: objectData.floors,
      build_year: objectData.build_year,
      is_emergency: objectData.is_emergency,
      addedAt: new Date().toISOString()
    });

    // Сохраняем в localStorage
    localStorage.setItem(storageKey, JSON.stringify(buildings));

    // Обновляем счетчик в навигации
    updateComparisonCounter();

    // Обновляем кнопку в панели
    if (addToCompareBtn) {
      addToCompareBtn.innerHTML = '<i class="fas fa-check"></i> Уже добавлено';
      addToCompareBtn.classList.add('disabled');
      addToCompareBtn.disabled = true;
    }

    // Показываем уведомление с информацией о текущем количестве
    showNotification(`Объект добавлен к сравнению (${buildings.length}/${maxBuildings})`, 'success');

    // Генерируем событие обновления сравнения
    const event = new Event('comparisonUpdated');
    window.dispatchEvent(event);

    return true;
  } catch (error) {
    console.error('Ошибка при добавлении к сравнению:', error);
    showNotification('Ошибка при добавлении к сравнению', 'error');
    return false;
  }
}

// Обновить счетчик сравнения
function updateComparisonCounter() {
  try {
    const storageKey = 'isur_buildings_comparison';
    const stored = localStorage.getItem(storageKey);
    const buildings = stored ? JSON.parse(stored) : [];
    const maxBuildings = 5;

    const counter = document.getElementById('comparison-counter');

    if (counter) {
      counter.textContent = buildings.length;
      counter.style.display = buildings.length > 0 ? 'inline-flex' : 'none';

      // Добавляем подсказку с лимитом
      counter.title = `Объектов в сравнении: ${buildings.length} из ${maxBuildings}`;

      // Если достигнут лимит, меняем цвет счетчика
      if (buildings.length >= maxBuildings) {
        counter.style.background = '#EF4444'; // Красный
      } else if (buildings.length >= maxBuildings - 1) {
        counter.style.background = '#F59E0B'; // Оранжевый
      } else {
        counter.style.background = '#FF6B35'; // Оранжево-красный по умолчанию
      }
    }

    // Также обновляем счетчик на странице аналитики, если он есть
    const comparisonLink = document.querySelector('a[href="diffs.html"]');
    if (comparisonLink) {
      let counterElement = comparisonLink.querySelector('.comparison-counter');
      if (!counterElement) {
        counterElement = document.createElement('span');
        counterElement.className = 'comparison-counter';
        counterElement.style.cssText = `
          background: #FF6B35;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          margin-left: 5px;
        `;
        comparisonLink.appendChild(counterElement);
      }
      counterElement.textContent = buildings.length;
      counterElement.style.display = buildings.length > 0 ? 'inline-flex' : 'none';
      counterElement.title = `Объектов в сравнении: ${buildings.length} из ${maxBuildings}`;

      if (buildings.length >= maxBuildings) {
        counterElement.style.background = '#EF4444';
      } else if (buildings.length >= maxBuildings - 1) {
        counterElement.style.background = '#F59E0B';
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении счетчика:', error);
  }
}

// Показать уведомление
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notification-message');
  const notificationProgress = document.getElementById('notification-progress');

  if (!notification || !notificationMessage) return;

  notification.className = `notification ${type}`;
  notificationMessage.textContent = message;

  // Сбрасываем прогресс-бар
  if (notificationProgress) {
    notificationProgress.style.width = '0%';
  }

  // Показываем уведомление
  notification.classList.add('show');

  // Анимируем прогресс-бар
  if (notificationProgress) {
    setTimeout(() => {
      notificationProgress.style.width = '100%';
    }, 10);
  }

  // Скрываем через 3 секунды
  setTimeout(() => {
    notification.classList.remove('show');
    if (notificationProgress) {
      notificationProgress.style.width = '0%';
    }
  }, 3000);
}

// Загрузка данных с одной повторной попыткой
async function loadData(url, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const isLocalFile = !url.startsWith('http');
      const fetchOptions = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      };

      if (!isLocalFile) {
        fetchOptions.mode = 'cors';
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Ошибка: ${response.statusText}`);

      try {
        return await response.json();
      } catch (jsonError) {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.warn(`Проблема с парсингом ответа от ${url}, возвращаем null`);
          return null;
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        if (i < retries) {
          console.warn(`Запрос прерван для ${url}, повторная попытка...`);
        } else {
          console.warn(`Запрос прерван для ${url} после ${retries + 1} попыток`);
        }
      } else if (error.message && error.message.includes('Content-Length')) {
        console.warn(`Проблема с Content-Length для ${url}, но продолжаем...`);
        return null;
      } else {
        if (i < retries) {
          console.warn(`Ошибка загрузки данных (${url}), повторная попытка...`);
        } else {
          console.error(`Ошибка загрузки данных (${url}):`, error);
        }
      }

      if (i >= retries) {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
}

// Анализ данных и создание статистики по районам на основе реальных координат
function analyzeDistrictData() {
  const districts = {};

  // Инициализация районов
  moscowDistrictsData.forEach(district => {
    districts[district.name] = { ...district };
  });

  // Анализ школ по реальным координатам
  allFeaturesByType.school.forEach(school => {
    const lat = parseFloat(school.get('lat'));
    const lon = parseFloat(school.get('lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
      const district = getDistrictByCoordinates(lat, lon);
      if (districts[district]) {
        districts[district].schools++;
      }
    }
  });

  // Анализ больниц по реальным координатам
  allFeaturesByType.hospital.forEach(hospital => {
    const lat = parseFloat(hospital.get('lat'));
    const lon = parseFloat(hospital.get('lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
      const district = getDistrictByCoordinates(lat, lon);
      if (districts[district]) {
        districts[district].hospitals++;
      }
    }
  });

  // Анализ метро по реальным координатам
  allFeaturesByType.metro.forEach(metro => {
    const lat = parseFloat(metro.get('lat'));
    const lon = parseFloat(metro.get('lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
      const district = getDistrictByCoordinates(lat, lon);
      if (districts[district]) {
        districts[district].metro++;
      }
    }
  });

  // Анализ остановок по реальным координатам
  allFeaturesByType.stop.forEach(stop => {
    const lat = parseFloat(stop.get('lat'));
    const lon = parseFloat(stop.get('lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
      const district = getDistrictByCoordinates(lat, lon);
      if (districts[district]) {
        districts[district].stops++;
      }
    }
  });

  // Анализ зданий по реальным координатам
  allFeaturesByType.building.forEach(building => {
    const lat = parseFloat(building.get('lat'));
    const lon = parseFloat(building.get('lon'));

    if (!isNaN(lat) && !isNaN(lon)) {
      const district = getDistrictByCoordinates(lat, lon);
      if (districts[district]) {
        districts[district].buildings++;
      }
    }
  });

  // Обновляем расчетные показатели на основе реальных данных
  const updatedDistricts = Object.values(districts).map(district => {
    // Пересчитываем индексы на основе реального количества объектов
    const transport = Math.min(100, Math.round((district.metro * 5 + district.stops * 0.05) / 5));
    const education = Math.min(100, Math.round((district.schools / district.population * 100000) * 2.5));
    const healthcare = Math.min(100, Math.round((district.hospitals / district.population * 100000)));
    const housing = Math.min(100, Math.round((district.buildings / district.population * 10000)));
    const infrastructure = Math.min(100, Math.round((transport + education + healthcare + housing) / 4));

    return {
      ...district,
      transport,
      education,
      healthcare,
      housing,
      infrastructure
    };
  });

  // Обновляем переменную moscowDistricts
  moscowDistricts = updatedDistricts;

}

// Инициализация аналитических графиков на основе реальных данных
function initAnalyticsCharts() {
  if (moscowDistricts.length === 0) {
    console.warn('Нет данных для инициализации графиков');
    return;
  }

  const districtNames = moscowDistricts.map(d => d.name);

  // Настройки для всех графиков
  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Индекс качества'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Районы Москвы'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    }
  };

  // Транспортная доступность
  const transportCtx = document.getElementById('transport-chart');
  if (transportCtx) {
    if (window.transportChart) {
      window.transportChart.destroy();
    }

    window.transportChart = new Chart(transportCtx, {
      type: 'bar',
      data: {
        labels: districtNames,
        datasets: [{
          label: 'Транспортная доступность',
          data: moscowDistricts.map(d => d.transport),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }

  // Образовательная инфраструктура
  const educationCtx = document.getElementById('education-chart');
  if (educationCtx) {
    if (window.educationChart) {
      window.educationChart.destroy();
    }

    window.educationChart = new Chart(educationCtx, {
      type: 'bar',
      data: {
        labels: districtNames,
        datasets: [{
          label: 'Образовательная инфраструктура',
          data: moscowDistricts.map(d => d.education),
          backgroundColor: 'rgba(255, 159, 64, 0.7)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }

  // Здравоохранение
  const healthcareCtx = document.getElementById('healthcare-chart');
  if (healthcareCtx) {
    if (window.healthcareChart) {
      window.healthcareChart.destroy();
    }

    window.healthcareChart = new Chart(healthcareCtx, {
      type: 'bar',
      data: {
        labels: districtNames,
        datasets: [{
          label: 'Здравоохранение',
          data: moscowDistricts.map(d => d.healthcare),
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }

  // Жилищный фонд
  const housingCtx = document.getElementById('housing-chart');
  if (housingCtx) {
    if (window.housingChart) {
      window.housingChart.destroy();
    }

    window.housingChart = new Chart(housingCtx, {
      type: 'bar',
      data: {
        labels: districtNames,
        datasets: [{
          label: 'Жилищный фонд',
          data: moscowDistricts.map(d => d.housing),
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  }
}

// Обновление статистики районов
function updateDistrictStats(districtName) {
  const district = moscowDistricts.find(d => d.name === districtName);
  if (!district) return;

  const populationElement = document.getElementById('district-population');
  const areaElement = document.getElementById('district-area');
  const densityElement = document.getElementById('district-density');
  const infrastructureElement = document.getElementById('district-infrastructure');

  if (populationElement) populationElement.textContent = district.population.toLocaleString();
  if (areaElement) areaElement.textContent = district.area;
  if (densityElement) densityElement.textContent = district.density.toLocaleString();
  if (infrastructureElement) infrastructureElement.textContent = district.infrastructure;

  // Обновление графика для выбранного района
  updateDistrictChart(district);
}

// Обновление графика района
function updateDistrictChart(district) {
  const ctx = document.getElementById('district-chart');
  if (!ctx) return;

  if (window.districtChart) {
    window.districtChart.destroy();
  }

  window.districtChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Транспорт', 'Образование', 'Здравоохранение', 'Жилье', 'Инфраструктура', 'Социальная'],
      datasets: [{
        label: district.name,
        data: [
          district.transport,
          district.education,
          district.healthcare,
          district.housing,
          district.infrastructure,
          Math.min(100, (district.transport + district.education + district.healthcare) / 3)
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      }
    }
  });
}

// Инициализация селектора районов
function initDistrictSelector() {
  const districtSelect = document.getElementById('district-select');
  if (!districtSelect || moscowDistricts.length === 0) return;

  districtSelect.innerHTML = '<option value="">Выберите район Москвы</option>';

  moscowDistricts.forEach(district => {
    const option = document.createElement('option');
    option.value = district.name;
    option.textContent = district.name;
    districtSelect.appendChild(option);
  });

  districtSelect.addEventListener('change', function () {
    updateDistrictStats(this.value);
  });

  if (moscowDistricts.length > 0) {
    updateDistrictStats(moscowDistricts[0].name);
  }
}

// Проверка загрузки OpenLayers
if (typeof ol === 'undefined') {
  console.error('OpenLayers не загружен!');
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    mapContainer.innerHTML = '<div style="padding: 20px; text-align: center;">Ошибка: OpenLayers не загружен. Проверьте подключение к интернету.</div>';
  }
} else {
  console.log('OpenLayers загружен успешно');
}

// Основная функция инициализации
async function initializeApplication() {
  console.log('Начало инициализации приложения...');

  try {
    // Загружаем данные из локальных файлов
    const results = await Promise.allSettled([
      loadData("/backend/buildings.json"),
      loadData("/backend/schools.json"),
      loadData("/backend/hospitals.json"),
      loadData("/backend/metro.json"),
      loadData("/backend/transport-stops.json"),
    ]);

    const buildingsData = results[0].status === 'fulfilled' ? results[0].value : null;
    const schoolsData = results[1].status === 'fulfilled' ? results[1].value : null;
    const hospitalsData = results[2].status === 'fulfilled' ? results[2].value : null;
    const metroData = results[3].status === 'fulfilled' ? results[3].value : null;
    const stopData = results[4].status === 'fulfilled' ? results[4].value : null;

    console.log('Данные загружены:', {
      buildings: buildingsData ? Object.keys(buildingsData.buildings || {}).length : 0,
      schools: schoolsData ? Object.keys(schoolsData.schools || {}).length : 0,
      hospitals: hospitalsData ? Object.keys(hospitalsData.hospitals || {}).length : 0,
      metro: metroData ? Object.keys(metroData.stations || {}).length : 0,
      stops: stopData ? Object.keys(stopData.stops || {}).length : 0,
    });

    // Обработка данных зданий
    if (buildingsData && buildingsData.buildings) {
      allFeaturesByType.building = Object.values(buildingsData.buildings).map((building) => {
        const coords = ol.proj.fromLonLat([
          parseFloat(building[12]),
          parseFloat(building[11]),
        ]);
        const feature = new ol.Feature(new ol.geom.Point(coords));
        feature.set("address", building[1]);
        feature.set("type", "building");
        feature.set("id", building[0]);
        feature.set("floors", building[4]);
        feature.set("build_year", building[3]);
        feature.set("is_emergency", building[5]);
        feature.set("lat", building[11]);
        feature.set("lon", building[12]);
        return feature;
      });
    }

    // Обработка данных школ (без привязки к району из данных)
    if (schoolsData && schoolsData.schools) {
      allFeaturesByType.school = Object.values(schoolsData.schools).map((school) => {
        const coords = ol.proj.fromLonLat([
          parseFloat(school[6]),
          parseFloat(school[7]),
        ]);
        const feature = new ol.Feature(new ol.geom.Point(coords));

        feature.set("type", "school");
        feature.set("id", school[0]);
        feature.set("name", school[1]);
        feature.set("address", school[2]);
        feature.set("contacts", school[4]);
        feature.set("website", school[5]);
        feature.set("lat", school[7]);
        feature.set("lon", school[6]);
        return feature;
      });
    }

    // Обработка данных больниц
    if (hospitalsData && hospitalsData.hospitals) {
      allFeaturesByType.hospital = Object.values(hospitalsData.hospitals).map((hospital) => {
        const coords = ol.proj.fromLonLat([
          parseFloat(hospital[3]),
          parseFloat(hospital[2]),
        ]);
        const feature = new ol.Feature(new ol.geom.Point(coords));

        feature.set("type", "hospital");
        feature.set("id", hospital[0]);
        feature.set("name", hospital[1]);
        feature.set("lat", hospital[2]);
        feature.set("lon", hospital[3]);
        return feature;
      });
    }

    // Обработка данных метро
    if (metroData && metroData.stations) {
      allFeaturesByType.metro = Object.values(metroData.stations).map((metro) => {
        const coords = ol.proj.fromLonLat([
          parseFloat(metro[3]),
          parseFloat(metro[2]),
        ]);
        const feature = new ol.Feature(new ol.geom.Point(coords));

        feature.set("type", "metro");
        feature.set("id", metro[0]);
        feature.set("name", metro[1]);
        feature.set("lat", metro[2]);
        feature.set("lon", metro[3]);
        return feature;
      });
    }

    // Обработка данных остановок
    if (stopData && stopData.stops) {
      allFeaturesByType.stop = Object.values(stopData.stops).map((stop) => {
        const coords = ol.proj.fromLonLat([
          parseFloat(stop.longitude),
          parseFloat(stop.latitude),
        ]);
        const feature = new ol.Feature(new ol.geom.Point(coords));
        feature.set("address", stop.name || "Без названия");
        feature.set("type", "stop");
        feature.set("id", stop.stop_id);
        feature.set("name", stop.name);
        feature.set("transport_type", stop.transport_type);
        feature.set("routes", stop.routes);
        feature.set("lat", stop.latitude);
        feature.set("lon", stop.longitude);
        return feature;
      });
    }

    // Анализируем данные для графиков на основе реальных координат
    analyzeDistrictData();

    // Инициализируем графики и селектор районов
    initAnalyticsCharts();
    initDistrictSelector();

    // Инициализация карты
    source = new ol.source.Vector({ features: [] });
    clusterSource = new ol.source.Cluster({
      distance: parseInt(distanceInput?.value || 50, 10),
      minDistance: parseInt(minDistanceInput?.value || 20, 10),
      source: source,
    });

    const styleCache = {};
    const clusters = new ol.layer.Vector({
      source: clusterSource,
      style: function (feature) {
        const features = feature.get("features");
        if (!features || features.length === 0) return null;

        const type = features[0].get("type");
        const size = features.length;

        const createStyle = (fillColor) => {
          return new ol.style.Style({
            image: new ol.style.Circle({
              radius: 10,
              stroke: new ol.style.Stroke({ color: "#fff" }),
              fill: new ol.style.Fill({ color: fillColor }),
            }),
            text: new ol.style.Text({
              text: size.toString(),
              fill: new ol.style.Fill({ color: "#fff" }),
            }),
          });
        };

        if (type === "school") {
          return (
            styleCache[size + "_school"] ||
            (styleCache[size + "_school"] = createStyle("#9e6c33"))
          );
        } else if (type === "hospital") {
          return (
            styleCache[size + "_hospital"] ||
            (styleCache[size + "_hospital"] = createStyle("#FF0000"))
          );
        } else if (type === "metro") {
          return (
            styleCache[size + "_metro"] ||
            (styleCache[size + "_metro"] = createStyle("#8024c7"))
          );
        } else if (type === "stop") {
          return (
            styleCache[size + "_stop"] ||
            (styleCache[size + "_stop"] = createStyle("#FFA500"))
          );
        } else {
          return (
            styleCache[size + "_building"] ||
            (styleCache[size + "_building"] = createStyle("#1f90d1"))
          );
        }
      },
    });

    // Инициализация карты
    try {
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) {
        map = new ol.Map({
          layers: [new ol.layer.Tile({ source: new ol.source.OSM() }), clusters],
          target: "map-container",
          view: new ol.View({
            center: ol.proj.fromLonLat([37.6173, 55.7558]),
            zoom: 12,
          }),
        });
        console.log('Карта инициализирована успешно');
      } else {
        console.error('Контейнер карты не найден');
      }
    } catch (error) {
      console.error('Ошибка инициализации карты:', error);
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) {
        mapContainer.innerHTML = '<div style="padding: 20px; text-align: center;">Ошибка инициализации карты: ' + error.message + '</div>';
      }
    }

    // Применяем фильтры и обновляем статистику
    updateClusterLayer();
    updateStats();

    // Обработка изменений фильтров
    [
      filterBuilding,
      filterSchool,
      filterHospital,
      filterMetro,
      filterStop,
    ].forEach((checkbox) => {
      if (checkbox) {
        checkbox.addEventListener("change", updateClusterLayer);
      }
    });

    // Обработка клика на карту
    if (map) {
      map.on("click", async (e) => {
        const featureAtPixel = map.forEachFeatureAtPixel(
          e.pixel,
          (feature, layer) => {
            if (layer === clusters) {
              return feature;
            }
          },
        );

        if (!featureAtPixel) {
          // Клик на пустое место карты - закрываем панель
          closeInfoPanel();
          return;
        }

        const clusterFeatures = featureAtPixel.get("features");

        if (clusterFeatures.length > 1) {
          const extent = ol.extent.boundingExtent(
            clusterFeatures.map((f) => f.getGeometry().getCoordinates()),
          );
          map.getView().fit(extent, {
            duration: 1000,
            padding: [50, 50, 50, 50],
            maxZoom: 18,
          });
          // Закрываем панель при зуме на кластер
          closeInfoPanel();
        } else {
          const feature = clusterFeatures[0];
          console.log(clusterFeatures);
          const type = feature.get("type");

          if (type === "building") {
            await showBuildingDetails(feature, e.originalEvent);
          } else if (type === "school") {
            showSchoolDetails(feature, e.originalEvent);
          } else if (type === "hospital") {
            showHospitalDetails(feature, e.originalEvent);
          } else if (type === "metro") {
            showMetroDetails(feature, e.originalEvent);
          } else if (type === "stop") {
            showStopDetails(feature, e.originalEvent);
          }
        }
      });
    }

    console.log('Приложение успешно инициализировано');

  } catch (error) {
    console.error('Ошибка при инициализации приложения:', error);
  }
}

// Функции показа деталей объектов
async function showBuildingDetails(feature, event) {
  const buildingId = feature.get("id");
  const buildingsData = await loadData("/backend/buildings.json");

  let socialScore = "Н/Д", qualityScore = "Н/Д", transportScore = "Нй/Д", totalScore = "Н/Д";
  let lat = feature.get("lat") || "Н/Д", lon = feature.get("lon") || "Н/Д", build_year = feature.get("build_year") || "Н/Д";
  let is_emergency = feature.get("is_emergency") ? "Да" : "Нет", floors = feature.get("floors") || "Н/Д";

  try {
    // Извлекаем только значения с индексами с 15 по 18 для соответствующего здания
    const arr = buildingsData.buildings.find(b => Array.isArray(b) && b[0] === buildingId);
    if (arr) {
      [socialScore, qualityScore, transportScore, totalScore] = arr.slice(15, 19);
    }

    // Используем данные для координат и других полей
    lat = parseFloat(building.latitude).toFixed(6);
    lon = parseFloat(building.longitude).toFixed(6);
    floors = building.floors_number;
    build_year = building.build_year;
    is_emergency = building.is_emergency === 't' ? "Да" : "Нет";
  }
  catch (error) {
    console.error('Ошибка при получении данных:', error);
  }

  const ratingText = `
<p><strong>Адрес:</strong> ${feature.get("address")}</p>
<p><strong>Социальный рейтинг:</strong> ${typeof socialScore === 'number' ? socialScore.toFixed(2) : socialScore}</p>
<p><strong>Качество инфраструктуры:</strong> ${typeof qualityScore === 'number' ? qualityScore.toFixed(2) : qualityScore}</p>
<p><strong>Транспортная доступность:</strong> ${typeof transportScore === 'number' ? transportScore.toFixed(2) : transportScore}</p>
<p><strong>Общий рейтинг:</strong> ${typeof totalScore === 'number' ? totalScore.toFixed(2) : totalScore}</p>
<p><strong>Координаты:</strong> ${lat}, ${lon}</p>
<p><strong>Этажность:</strong> ${floors}</p>
<p><strong>Год постройки:</strong> ${build_year}</p>
<p><strong>Аварийность:</strong> ${is_emergency}</p>`;

  showInfoPanel(event, {
    title: "Жилище",
    content: ratingText,
    type: "building",
    id: buildingId,
    address: feature.get("address"),
    lat: lat,
    lon: lon,
    socialScore: typeof socialScore === 'number' ? socialScore : null,
    qualityScore: typeof qualityScore === 'number' ? qualityScore : null,
    transportScore: typeof transportScore === 'number' ? transportScore : null,
    totalScore: typeof totalScore === 'number' ? totalScore : null,
    floors: floors,
    build_year: build_year,
    is_emergency: is_emergency
  });
}

function showSchoolDetails(feature, event) {
  let details = `<p><strong>Название:</strong> ${feature.get("name") || "Н/Д"}</p>`;

  if (feature.get("address")) details += `<p><strong>Адрес:</strong> ${feature.get("address")}</p>`;

  let contacts = [];
  if (feature.get("contacts")) contacts.push(feature.get("contacts"));
  if (feature.get("website")) contacts.push(feature.get("website"));

  if (contacts.length > 0) {
    details += `<p><strong>Контакты:</strong> ${contacts.join(', ')}</p>`;
  }

  details += `<p><strong>Координаты:</strong> ${feature.get("lat") || "Н/Д"}, ${feature.get("lon") || "Н/Д"}</p>`;

  showInfoPanel(event, {
    title: "Школа",
    content: details,
    type: "school",
    id: feature.get("id"),
    address: feature.get("address")
  });
}

function showHospitalDetails(feature, event) {
  let details = `<p><strong>Название:</strong> ${feature.get("name") || "Н/Д"}</p>`;
  details += `<p><strong>Координаты:</strong> ${feature.get("lat") || "Н/Д"}, ${feature.get("lon") || "Н/Д"}</p>`;

  showInfoPanel(event, {
    title: "Больница",
    content: details,
    type: "hospital",
    id: feature.get("id")
  });
}

function showMetroDetails(feature, event) {
  let details = `<p><strong>Название станции:</strong> ${feature.get("name") || "Н/Д"}</p>`;
  details += `<p><strong>Координаты:</strong> ${feature.get("lat") || "Н/Д"}, ${feature.get("lon") || "Н/Д"}</p>`;

  showInfoPanel(event, {
    title: "Станция метро",
    content: details,
    type: "metro",
    id: feature.get("id")
  });
}

function showStopDetails(feature, event) {
  let details = `<p><strong>Название:</strong> ${feature.get("name") || "Н/Д"}</p>`;
  if (feature.get("transport_type")) details += `<p><strong>Тип транспорта:</strong> ${feature.get("transport_type")}</p>`;
  if (feature.get("routes")) details += `<p><strong>Маршруты:</strong> ${feature.get("routes")}</p>`;
  details += `<p><strong>Координаты:</strong> ${feature.get("lat") || "Н/Д"}, ${feature.get("lon") || "Н/Д"}</p>`;

  showInfoPanel(event, {
    title: "Остановка транспорта",
    content: details,
    type: "stop",
    id: feature.get("id")
  });
}

function showBasicInfo(feature, event, typeName) {
  const details = `<p><strong>Адрес:</strong> ${feature.get("address") || "Н/Д"}</p>
<p><strong>Координаты:</strong> ${feature.get("lat") || "Н/Д"}, ${feature.get("lon") || "Н/Д"}</p>`;

  showInfoPanel(event, {
    title: typeName,
    content: details,
    type: feature.get("type"),
    id: feature.get("id"),
    address: feature.get("address")
  });
}

// Обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM загружен, инициализация приложения...');

  // Инициализация приложения
  initializeApplication();

  // Обновление счетчика сравнения при загрузке
  updateComparisonCounter();

  // Обработчик кнопки закрытия
  if (closeBtn) {
    closeBtn.addEventListener('click', closeInfoPanel);
  }

  // Закрытие панели при нажатии ESC
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeInfoPanel();
    }
  });
});
