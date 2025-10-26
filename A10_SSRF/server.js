const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3010;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Симуляція внутрішньої бази даних
const internalDB = {
    users: [
        { id: 1, username: 'admin', password: 'super_secret_pass', role: 'admin' },
        { id: 2, username: 'user', password: 'user123', role: 'user' }
    ],
    api_keys: {
        aws: 'AKIAIOSFODNN7EXAMPLE',
        stripe: 'sk_live_51HvKYjKa...',
        database: 'mongodb://admin:pass@internal-db:27017'
    }
};

// === ВРАЗЛИВИЙ ЕНДПОІНТ ===
// SSRF: Сервер виконує запити до будь-якого URL без перевірки!
app.post('/fetch', async (req, res) => {
    const url = req.body.url;

    if (!url) {
        return res.status(400).json({
            error: 'URL не вказано',
            success: false
        });
    }

    try {
        console.log(`[SSRF] Спроба запиту до: ${url}`);

        // НЕБЕЗПЕЧНО: Ніяких перевірок! Можна запросити що завгодно!
        const response = await axios.get(url, {
            timeout: 5000,
            maxRedirects: 5,
            validateStatus: () => true // Приймаємо будь-які статус-коди
        });

        // Повертаємо результат
        res.json({
            success: true,
            url: url,
            status: response.status,
            headers: response.headers,
            data: typeof response.data === 'object'
                ? response.data
                : response.data.substring(0, 2000), // Обмежуємо розмір відповіді
            message: 'Запит виконано успішно!'
        });

    } catch (error) {
        console.error(`[SSRF ERROR] ${error.message}`);

        res.json({
            success: false,
            error: error.message,
            code: error.code,
            url: url
        });
    }
});

// === ВНУТРІШНІ ЕНДПОІНТИ (доступні тільки через SSRF!) ===

// Внутрішній API з секретами
app.get('/internal/api', (req, res) => {
    res.json({
        message: "Ти знайшов внутрішній API!",
        secret_flag: "SSRF{Y0U_F0UND_1NT3RN4L_4P1}",
        api_keys: internalDB.api_keys,
        warning: "Ці дані мали бути недоступні ззовні!"
    });
});

// Внутрішня база користувачів
app.get('/internal/users', (req, res) => {
    res.json({
        message: "💀 База користувачів (внутрішній доступ)",
        users: internalDB.users,
        flag: "SSRF{US3R_D4T4B4S3_L34K3D}"
    });
});

// Метадані (як у AWS EC2)
app.get('/metadata/credentials', (req, res) => {
    res.json({
        AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
        SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        Token: "IQoJb3JpZ2luX2VjEH...",
        Expiration: "2025-10-27T12:00:00Z",
        flag: "SSRF{CL0UD_M3T4D4T4_ST0L3N}"
    });
});

// Адмін-панель (тільки для localhost)
app.get('/admin/dashboard', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    res.json({
        message: "Адмін-панель",
        accessed_from: clientIP,
        admin_token: "admin_token_12345",
        flag: "SSRF{4DM1N_P4N3L_PWNED}",
        warning: "Цей ресурс має бути доступний тільки з localhost!"
    });
});

// === ДОДАТКОВІ ЕНДПОІНТИ ДЛЯ ТЕСТУВАННЯ ===

// Сторінка з формою
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Інфо про сервер
app.get('/info', (req, res) => {
    res.json({
        server: 'SSRF Vulnerable Lab',
        version: '1.0',
        port: PORT,
        endpoints: {
            vulnerable: '/fetch',
            internal_api: '/internal/api',
            internal_users: '/internal/users',
            metadata: '/metadata/credentials',
            admin: '/admin/dashboard'
        }
    });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('OWASP A10: SSRF Vulnerable Lab');
    console.log('='.repeat(60));
    console.log(`Сервер запущено: http://localhost:${PORT}`);
    console.log(`Головна сторінка: http://localhost:${PORT}/`);
    console.log('');
    console.log('ВНУТРІШНІ РЕСУРСИ (доступні через SSRF):');
    console.log(`   • http://localhost:${PORT}/internal/api`);
    console.log(`   • http://localhost:${PORT}/internal/users`);
    console.log(`   • http://localhost:${PORT}/metadata/credentials`);
    console.log(`   • http://localhost:${PORT}/admin/dashboard`);
    console.log('');
    console.log('ПРИКЛАД АТАКИ:');
    console.log(`   POST /fetch з body: {"url": "http://localhost:${PORT}/internal/api"}`);
    console.log('');
    console.log('ВРАЗЛИВІСТЬ: Немає валідації URL! Можна запитати будь-які внутрішні ресурси!');
    console.log('='.repeat(60) + '\n');
});