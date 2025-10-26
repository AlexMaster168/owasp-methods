const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3009;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Простий session middleware (в пам'яті)
const sessions = {};
app.use((req, res, next) => {
    const sessionId = req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
    if (sessionId && sessions[sessionId]) {
        req.session = sessions[sessionId];
    }
    next();
});

// Створюємо логер з файловим транспортом
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/access.log' })
    ]
});

// Створюємо директорію для логів
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// ВРАЗЛИВІСТЬ #1: Логуємо ТІЛЬКИ успішні входи
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    db.get('SELECT id, username, role FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
            if (err) {
                console.error('Помилка бази:', err);
                return res.status(500).json({ success: false, message: 'Помилка сервера' });
            }

            if (!row) {
                // КРИТИЧНА ВРАЗЛИВІСТЬ: Не логуємо невдалі спроби!
                // Атакувач може перебирати паролі без слідів
                return res.json({
                    success: false,
                    message: 'Неправильне ім\'я або пароль'
                });
            }

            // Логуємо ТІЛЬКИ успішні входи
            logger.info(`Успішний логін: ${row.username} (IP: ${ip})`);

            const sessionId = Math.random().toString(36).substring(7);
            sessions[sessionId] = { user: { id: row.id, username: row.username, role: row.role } };

            res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly`);
            res.json({ success: true, redirect: '/profile' });
        }
    );
});

// ВРАЗЛИВІСТЬ #2: Адмін панель без логування доступу
app.get('/admin', (req, res) => {
    if (!req.session?.user) {
        return res.redirect('/login');
    }

    // ВРАЗЛИВІСТЬ: Не логуємо спроби доступу до адмін панелі!
    if (req.session.user.role !== 'admin') {
        return res.send(`
            <div style="text-align: center; margin-top: 50px;">
                <h2>Доступ заборонено</h2>
                <p>Тільки для адміністраторів</p>
                <a href="/profile">Назад</a>
            </div>
        `);
    }

    // Навіть успішний доступ адміна не логується!
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Адмін панель</title><link rel="stylesheet" href="/style.css"></head>
        <body>
            <div class="container">
                <h1>Адмін панель</h1>
                <p>Ви увійшли як: ${req.session.user.username}</p>
                <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3>Конфіденційні дані:</h3>
                    <ul>
                        <li>База даних користувачів: /api/users</li>
                        <li>Фінансові звіти: /api/reports</li>
                        <li>Системні налаштування: /api/config</li>
                    </ul>
                </div>
                <a href="/logout">Вийти</a>
            </div>
        </body>
        </html>
    `);
});

// ВРАЗЛИВІСТЬ #3: API без логування
app.get('/api/users', (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
        // Не логуємо несанкціоновані спроби доступу до API!
        return res.status(403).json({ error: 'Доступ заборонено' });
    }

    db.all('SELECT id, username, email, role FROM users', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Помилка сервера' });
        }
        // Навіть успішний доступ до чутливих даних не логується!
        res.json(rows);
    });
});

// Форма входу
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Профіль
app.get('/profile', (req, res) => {
    if (!req.session?.user) {
        return res.redirect('/login');
    }

    const adminLink = req.session.user.role === 'admin'
        ? '<a href="/admin" style="background: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Адмін панель</a>'
        : '';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Профіль</title><link rel="stylesheet" href="/style.css"></head>
        <body>
            <div class="container">
                <h1>Ваш профіль</h1>
                <p><strong>Ім'я:</strong> ${req.session.user.username}</p>
                <p><strong>Роль:</strong> ${req.session.user.role}</p>
                <div style="margin: 20px 0;">
                    ${adminLink}
                    <a href="/logout">Вийти</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Вихід
app.get('/logout', (req, res) => {
    const username = req.session?.user?.username || 'невідомий';
    const sessionId = req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];

    if (sessionId) {
        delete sessions[sessionId];
    }

    // ВРАЗЛИВІСТЬ: Логуємо вихід, але не деталізуємо (коли, звідки, тривалість сесії)
    logger.info(`Вихід: ${username}`);

    res.setHeader('Set-Cookie', 'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.redirect('/login');
});

// Сторінка з логами (незахищена для демонстрації)
app.get('/logs', (req, res) => {
    try {
        const logs = fs.readFileSync('logs/access.log', 'utf8');
        const logLines = logs.split('\n').filter(l => l.trim());

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Логи системи</title>
                <link rel="stylesheet" href="/style.css">
                <style>
                    .log-entry { 
                        background: #f8f9fa; 
                        padding: 10px; 
                        margin: 5px 0; 
                        border-left: 3px solid #28a745;
                        font-family: monospace;
                        font-size: 14px;
                    }
                    .stats {
                        background: #fff3cd;
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Логи системи</h1>
                    <div class="stats">
                        <p><strong>Всього записів:</strong> ${logLines.length}</p>
                        <p><strong>Увага:</strong> Тут відображаються ТІЛЬКИ успішні входи!</p>
                        <p>Спроби зламу, невдалі входи, доступ до API — все це НЕ логується!</p>
                    </div>
                    <div>
                        ${logLines.length > 0
            ? logLines.map(line => `<div class="log-entry">${line}</div>`).join('')
            : '<p>Логи порожні</p>'}
                    </div>
                    <a href="/login" style="margin-top: 20px; display: inline-block;">Назад</a>
                </div>
            </body>
            </html>
        `);
    } catch (e) {
        res.send('<h3>Логи не знайдено або не доступні.</h3><a href="/login">Назад</a>');
    }
});

// Демонстраційна сторінка для тестування атаки
app.get('/attack-demo', (req, res) => {
    res.sendFile(__dirname + '/public/attack-demo.html');
});

app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`A09: Security Logging and Monitoring Failures`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Сервер запущено: http://localhost:${PORT}`);
    console.log(`\nДоступні URL:`);
    console.log(`  • Логін:        http://localhost:${PORT}/login`);
    console.log(`  • Логи:         http://localhost:${PORT}/logs`);
    console.log(`  • Демо атаки:   http://localhost:${PORT}/attack-demo`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ВРАЗЛИВОСТІ:`);
    console.log(`  ✗ Не логуються невдалі спроби входу`);
    console.log(`  ✗ Не логується доступ до адмін панелі`);
    console.log(`  ✗ Не логуються спроби доступу до API`);
    console.log(`  ✗ Немає контролю за brute-force атаками`);
    console.log(`  ✗ Немає алертів про підозрілу активність`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nТестові користувачі:`);
    console.log(`  alice / alice123     (user)`);
    console.log(`  bob / bobpass        (admin)`);
    console.log(`  charlie / charlie123 (user)`);
    console.log(`${'='.repeat(60)}\n`);
});