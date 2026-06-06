require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const archiver = require('archiver');
const feedbackRoutes = require('./routes/feedback');

const app = express();

// ============================================
// КОНФИГУРАЦИЯ И МИДЛВАРЕ
// ============================================

// Логгер запросов
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${timestamp} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    
    // Цветная консольная отладка
    if (process.env.NODE_ENV !== 'production') {
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`${timestamp} \x1b[36m${req.method}\x1b[0m ${req.originalUrl} ${statusColor}${res.statusCode}\x1b[0m ${duration}ms`);
    }
    
    // Логирование в файл (опционально)
    if (process.env.LOG_TO_FILE === 'true') {
      fsSync.appendFileSync('server.log', logMessage + '\n', 'utf8');
    }
  });
  
  next();
};

// Настройка CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'development' ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 часа кэширования preflight
};

app.use(cors(corsOptions));
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// API РОУТЫ
// ============================================

// Роуты обратной связи
app.use('/api', feedbackRoutes);

// API для сравнения объектов (в памяти сервера)
let comparisonData = {
  sessions: new Map(), // sessionId -> { buildings: [], createdAt, updatedAt }
  maxBuildingsPerSession: 5,
  sessionTimeout: 24 * 60 * 60 * 1000 // 24 часа
};

// Очистка устаревших сессий
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, session] of comparisonData.sessions) {
    if (now - session.updatedAt > comparisonData.sessionTimeout) {
      comparisonData.sessions.delete(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[Session Cleanup] Удалено ${cleaned} устаревших сессий`);
  }
}, 60 * 60 * 1000); // Каждый час

// Генерация sessionId
const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// API для сравнения объектов
app.post('/api/comparison/add', async (req, res) => {
  try {
    const { buildingData, sessionId: providedSessionId } = req.body;
    
    if (!buildingData || !buildingData.lat || !buildingData.lon) {
      return res.status(400).json({
        success: false,
        message: "Некорректные данные объекта"
      });
    }
    
    // Получаем или создаем sessionId
    let sessionId = providedSessionId;
    if (!sessionId || !comparisonData.sessions.has(sessionId)) {
      sessionId = generateSessionId();
      comparisonData.sessions.set(sessionId, {
        buildings: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    
    const session = comparisonData.sessions.get(sessionId);
    
    // Проверяем дубликаты
    const exists = session.buildings.some(b => 
      Math.abs(b.lat - buildingData.lat) < 0.000001 && 
      Math.abs(b.lon - buildingData.lon) < 0.000001
    );
    
    if (exists) {
      return res.json({
        success: false,
        message: "Этот объект уже добавлен в сравнение",
        sessionId
      });
    }
    
    // Проверяем лимит
    if (session.buildings.length >= comparisonData.maxBuildingsPerSession) {
      return res.json({
        success: false,
        message: `Максимум ${comparisonData.maxBuildingsPerSession} объектов для сравнения`,
        sessionId
      });
    }
    
    // Добавляем метаданные
    buildingData.id = 'building_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    buildingData.addedAt = new Date().toISOString();
    
    // Получаем дополнительную информацию из JSON файлов
    try {
      const buildingsJson = await fs.readFile(path.join(__dirname, 'buildings.json'), 'utf8');
      const buildingsData = JSON.parse(buildingsJson);
      
      // Ищем здание по координатам (примерная логика, можно улучшить)
      const foundBuilding = Object.values(buildingsData.buildings || {}).find(b => {
        return Math.abs(parseFloat(b[11]) - buildingData.lat) < 0.001 &&
               Math.abs(parseFloat(b[12]) - buildingData.lon) < 0.001;
      });
      
      if (foundBuilding) {
        buildingData.fullData = foundBuilding;
      }
    } catch (error) {
      console.warn('Не удалось загрузить дополнительные данные здания:', error.message);
    }
    
    session.buildings.push(buildingData);
    session.updatedAt = Date.now();
    
    res.json({
      success: true,
      message: "Объект добавлен в сравнение",
      buildingId: buildingData.id,
      sessionId,
      count: session.buildings.length,
      building: buildingData
    });
    
  } catch (error) {
    console.error('Ошибка при добавлении в сравнение:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

app.get('/api/comparison/list', (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Не указан идентификатор сессии"
      });
    }
    
    const session = comparisonData.sessions.get(sessionId);
    
    if (!session) {
      return res.json({
        success: true,
        buildings: [],
        sessionId,
        count: 0
      });
    }
    
    res.json({
      success: true,
      buildings: session.buildings,
      sessionId,
      count: session.buildings.length,
      maxBuildings: comparisonData.maxBuildingsPerSession
    });
    
  } catch (error) {
    console.error('Ошибка при получении списка сравнения:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

app.delete('/api/comparison/remove', (req, res) => {
  try {
    const { sessionId, buildingId } = req.body;
    
    if (!sessionId || !buildingId) {
      return res.status(400).json({
        success: false,
        message: "Не указаны sessionId или buildingId"
      });
    }
    
    const session = comparisonData.sessions.get(sessionId);
    
    if (!session) {
      return res.json({
        success: false,
        message: "Сессия не найдена"
      });
    }
    
    const initialLength = session.buildings.length;
    session.buildings = session.buildings.filter(b => b.id !== buildingId);
    
    if (session.buildings.length === initialLength) {
      return res.json({
        success: false,
        message: "Объект не найден в сессии"
      });
    }
    
    session.updatedAt = Date.now();
    
    res.json({
      success: true,
      message: "Объект удален из сравнения",
      count: session.buildings.length,
      buildingId
    });
    
  } catch (error) {
    console.error('Ошибка при удалении объекта:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

app.delete('/api/comparison/clear', (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Не указан sessionId"
      });
    }
    
    if (!comparisonData.sessions.has(sessionId)) {
      return res.json({
        success: false,
        message: "Сессия не найдена"
      });
    }
    
    comparisonData.sessions.delete(sessionId);
    
    res.json({
      success: true,
      message: "Сессия сравнения очищена"
    });
    
  } catch (error) {
    console.error('Ошибка при очистке сессии:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

// API для получения данных здания по ID
app.get('/api/building/:id', async (req, res) => {
  try {
    const buildingId = req.params.id;
    
    const buildingsJson = await fs.readFile(path.join(__dirname, 'buildings.json'), 'utf8');
    const buildingsData = JSON.parse(buildingsJson);
    
    const building = Object.values(buildingsData.buildings || {}).find(b => 
      b[0] === buildingId || b[1]?.includes(buildingId)
    );
    
    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Здание не найдено"
      });
    }
    
    // Форматируем ответ
    const formattedBuilding = {
      id: building[0],
      address: building[1],
      district: building[2],
      build_year: building[3],
      floors: building[4],
      is_emergency: building[5],
      coordinates: {
        lat: parseFloat(building[11]),
        lon: parseFloat(building[12])
      },
      metadata: building.slice(6, 11)
    };
    
    res.json({
      success: true,
      building: formattedBuilding
    });
    
  } catch (error) {
    console.error('Ошибка при получении данных здания:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

// API для получения всех JSON файлов
app.get('/api/data/all', async (req, res) => {
  try {
    const files = [
      'buildings.json',
      'schools.json', 
      'hospitals.json',
      'metro.json',
      'transport-stops.json'
    ];
    
    const data = {};
    
    for (const file of files) {
      try {
        const filePath = path.join(__dirname, file);
        const content = await fs.readFile(filePath, 'utf8');
        data[file.replace('.json', '')] = JSON.parse(content);
      } catch (error) {
        console.warn(`Не удалось загрузить файл ${file}:`, error.message);
        data[file.replace('.json', '')] = null;
      }
    }
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      count: Object.keys(data).filter(key => data[key] !== null).length
    });
    
  } catch (error) {
    console.error('Ошибка при получении всех данных:', error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера"
    });
  }
});

// ============================================
// СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

// Раздача JSON-файлов из backend
app.use('/backend', express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Кэширование на 1 час
    }
  }
}));

// Раздача фронтенда с настройками кэширования
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// SPA-like routing для фронтенда
const frontendPaths = ['/', '/index', '/about', '/services', '/analytics', '/contact', '/diffs'];
frontendPaths.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  });
});

// ============================================
// ZIP ЭКСПОРТ ДАННЫХ
// ============================================

app.get('/download/installdata.zip', async (req, res) => {
  try {
    res.setHeader('Content-Disposition', 'attachment; filename=isur_data_' + new Date().toISOString().split('T')[0] + '.zip');
    res.setHeader('Content-Type', 'application/zip');
    
    const archive = archiver('zip', {
      zlib: { level: 9 },
      comment: 'Данные ИСУР - Экспорт от ' + new Date().toLocaleDateString('ru-RU')
    });
    
    archive.on('error', err => {
      console.error('Ошибка при создании архива:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка создания архива' });
      }
    });
    
    archive.on('warning', err => {
      console.warn('Предупреждение при создании архива:', err);
    });
    
    archive.on('end', () => {
      console.log('Архив успешно создан, размер:', archive.pointer() + ' байт');
    });
    
    archive.pipe(res);
    
    // Добавляем JSON файлы
    const jsonFiles = [
      'buildings.json',
      'schools.json', 
      'hospitals.json',
      'metro.json',
      'transport-stops.json'
    ];
    
    let addedCount = 0;
    
    for (const file of jsonFiles) {
      const filePath = path.join(__dirname, file);
      try {
        if (fsSync.existsSync(filePath)) {
          archive.file(filePath, { name: file });
          addedCount++;
        } else {
          console.warn(`Файл ${file} не найден, пропускаем`);
        }
      } catch (error) {
        console.error(`Ошибка при добавлении файла ${file}:`, error.message);
      }
    }
    
    // Добавляем README файл
    const readmeContent = `# Экспорт данных ИСУР\n\n` +
      `Дата экспорта: ${new Date().toLocaleString('ru-RU')}\n` +
      `Количество файлов: ${addedCount}\n` +
      `Формат данных: JSON\n\n` +
      `## Описание файлов:\n` +
      `- buildings.json: Жилые объекты Москвы\n` +
      `- schools.json: Образовательные учреждения\n` +
      `- hospitals.json: Медицинские учреждения\n` +
      `- metro.json: Станции метро\n` +
      `- transport-stops.json: Остановки общественного транспорта\n\n` +
      `Генерировано сервером ИСУР`;
    
    archive.append(readmeContent, { name: 'README.txt' });
    
    await archive.finalize();
    
  } catch (error) {
    console.error('Критическая ошибка при создании архива:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Не удалось создать архив данных"
      });
    }
  }
});

// ============================================
// ПРОЧИЕ СЕРВИСНЫЕ ЭНДПОИНТЫ
// ============================================

// Health check с подробной информацией
app.get('/health', async (req, res) => {
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    services: {
      jsonFiles: {},
      sessions: comparisonData.sessions.size
    }
  };
  
  // Проверяем доступность JSON файлов
  const jsonFiles = ['buildings.json', 'schools.json', 'hospitals.json', 'metro.json', 'transport-stops.json'];
  
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(__dirname, file);
      const exists = fsSync.existsSync(filePath);
      const stats = exists ? fsSync.statSync(filePath) : null;
      
      healthInfo.services.jsonFiles[file] = {
        exists,
        size: exists ? stats.size : 0,
        modified: exists ? stats.mtime : null
      };
    } catch (error) {
      healthInfo.services.jsonFiles[file] = {
        exists: false,
        error: error.message
      };
    }
  }
  
  res.json(healthInfo);
});

// Информация о сервере
app.get('/api/info', (req, res) => {
  res.json({
    app: 'ИСУР - Информационная система урбанистики',
    version: '1.0.0',
    server: {
      node: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime())
    },
    features: {
      analytics: true,
      comparison: true,
      feedback: true,
      dataExport: true
    },
    endpoints: {
      analytics: '/analytics.html',
      comparison: '/diffs.html',
      feedback: '/api/send-feedback',
      data: '/api/data/all',
      export: '/download/installdata.zip',
      health: '/health'
    }
  });
});

// Обработка 404 ошибок (для API)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint не найден",
    path: req.originalUrl
  });
});

// Обработка 404 ошибок (для статических файлов)
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, '..', 'frontend', '404.html'));
  } else if (req.accepts('json')) {
    res.status(404).json({
      success: false,
      message: "Ресурс не найден",
      path: req.originalUrl
    });
  } else {
    res.status(404).type('txt').send('Ресурс не найден');
  }
});

// Обработчик глобальных ошибок
app.use((error, req, res, next) => {
  console.error('Глобальная ошибка:', error.stack);
  
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : "Внутренняя ошибка сервера",
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

// Функция проверки доступности порта
const checkPort = (port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, HOST);
  });
};

// Запуск сервера с проверкой порта
const startServer = async (port = DEFAULT_PORT, attempts = 0) => {
  try {
    const isPortAvailable = await checkPort(port);
    
    if (!isPortAvailable) {
      if (attempts >= 50) {
        console.error(`❌ Не удалось найти свободный порт после ${attempts + 1} попыток`);
        process.exit(1);
      }
      console.error(`❌ Порт ${port} уже занят!`);
      const nextPort = port + 1;
      console.log(`🔄 Попытка использовать порт ${nextPort}...`);
      return startServer(nextPort, attempts + 1);
    }
    
    const server = app.listen(port, HOST, () => {
      const actualPort = server.address().port;
      console.log('\n' + '='.repeat(50));
      console.log('🚀 СЕРВЕР ИСУР УСПЕШНО ЗАПУЩЕН');
      console.log('='.repeat(50));
      console.log(`📡 URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${actualPort}`);
      console.log(`🌐 Среда: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Сессий сравнения: ${comparisonData.sessions.size}`);
      console.log('='.repeat(50));
      console.log('\n📋 ДОСТУПНЫЕ СТРАНИЦЫ:');
      console.log(`   📍 Главная: http://localhost:${actualPort}/`);
      console.log(`   📊 Аналитика: http://localhost:${actualPort}/analytics.html`);
      console.log(`   ⚖️ Сравнение: http://localhost:${actualPort}/diffs.html`);
      console.log(`   📝 О нас: http://localhost:${actualPort}/about.html`);
      console.log(`   🤖 Цифровой помощник: http://localhost:${actualPort}/services.html`);
      console.log(`   📞 Контакты: http://localhost:${actualPort}/contact.html`);
      console.log('\n🔧 API ЭНДПОИНТЫ:');
      console.log(`   📧 Обратная связь: http://localhost:${actualPort}/api/send-feedback`);
      console.log(`   💾 Экспорт данных: http://localhost:${actualPort}/download/installdata.zip`);
      console.log(`   📡 Состояние сервера: http://localhost:${actualPort}/health`);
      console.log(`   ℹ️ Информация: http://localhost:${actualPort}/api/info`);
      console.log('='.repeat(50) + '\n');
    });
    
    // Обработка graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n🔻 Получен сигнал SIGTERM. Завершаем работу...');
      server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('\n🔻 Получен сигнал SIGINT. Завершаем работу...');
      server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
      });
    });
    
    // Обработка необработанных исключений
    process.on('uncaughtException', (error) => {
      console.error('❌ Необработанное исключение:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Необработанный rejection в promise:', reason);
    });
    
  } catch (error) {
    console.error('❌ Критическая ошибка при запуске сервера:', error);
    process.exit(1);
  }
};

startServer();
