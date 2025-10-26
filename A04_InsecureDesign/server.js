const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const crypto = require('crypto');

const app = express();
const PORT = 3004;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Session simulation (in-memory, insecure)
const sessions = {};

// 1. Реєстрація користувача (з вразливостями)
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    // Вразливість: немає валідації складності пароля
    // Вразливість: пароль зберігається у відкритому вигляді
    db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, password, 'user'],
        function (err) {
            if (err) {
                return res.json({ success: false, message: 'Користувач вже існує' });
            }
            res.json({ success: true, message: 'Реєстрація успішна' });
        }
    );
});

// 2. Логін (з вразливостями)
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Вразливість: SQL Injection можливий
    db.get(
        `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`,
        (err, row) => {
            if (err) return res.json({ success: false, message: 'Помилка сервера' });
            if (!row) return res.json({ success: false, message: 'Невірні дані' });

            // Вразливість: передбачуваний session ID
            const sessionId = crypto.createHash('md5').update(username + Date.now()).digest('hex');
            sessions[sessionId] = { userId: row.id, username: row.username, role: row.role };

            res.json({
                success: true,
                sessionId,
                user: { username: row.username, role: row.role }
            });
        }
    );
});

// 3. Перегляд профілю (IDOR вразливість)
app.get('/profile/:userId', (req, res) => {
    const { userId } = req.params;

    // Вразливість: немає перевірки доступу
    db.get('SELECT username, email, role FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return res.json({ success: false, message: 'Користувач не знайдений' });
        res.json({ success: true, user: row });
    });
});

// 4. Перегляд всіх токенів
app.get('/api/tokens', (req, res) => {
    // Вразливість: відкритий доступ до всіх токенів
    db.all('SELECT * FROM password_reset_tokens', (err, rows) => {
        if (err) return res.json({ success: false, message: 'Помилка' });
        res.json({ success: true, tokens: rows });
    });
});

// 5. Перегляд користувачів
app.get('/api/users', (req, res) => {
    // Вразливість: відкритий доступ до всіх користувачів з паролями
    db.all('SELECT id, username, email, password, role FROM users', (err, rows) => {
        if (err) return res.json({ success: false, message: 'Помилка' });
        res.json({ success: true, users: rows });
    });
});

// 6. Генерація токена
app.post('/forgot', (req, res) => {
    const { email } = req.body;

    db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });
        if (!row) return res.json({ success: true, message: 'Якщо адреса існує, лист надіслано.' });

        // Вразливість: токен генерується на основі email + username
        const token = crypto.createHash('sha256').update(email + row.username).digest('hex');
        const expiresAt = Date.now() + 3600000;

        db.run(
            'INSERT OR REPLACE INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [row.id, token, expiresAt],
            (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Server error' });
                console.log(`Згенеровано токен для ${row.username}: ${token}`);
                res.json({
                    success: true,
                    message: 'Якщо адреса існує, лист надіслано.',
                    debug: { token, username: row.username, email }
                });
            }
        );
    });
});

// 7. Перевірка токена
app.get('/reset', (req, res) => {
    const token = req.query.token;

    db.get(
        'SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
        [token],
        (err, row) => {
            if (err || !row) {
                return res.send('<h3>Недійсний токен.</h3><a href="/">Повернутися</a>');
            }
            res.sendFile(__dirname + '/public/reset.html');
        }
    );
});

// 8. Скидання пароля
app.post('/reset', (req, res) => {
    const { token, newPassword } = req.body;

    db.get(
        'SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
        [token],
        (err, row) => {
            if (err || !row) {
                return res.json({ success: false, message: 'Недійсний токен.' });
            }

            // Вразливість: не перевіряємо термін дії і повторне використання токена
            db.run('UPDATE users SET password = ? WHERE id = ?', [newPassword, row.user_id], (err) => {
                if (err) return res.json({ success: false, message: 'Помилка оновлення пароля.' });

                res.json({
                    success: true,
                    message: 'Пароль успішно змінено',
                    vulnerabilities: {
                        tokenReused: !row.used,
                        tokenExpired: Date.now() > row.expires_at,
                        stillValid: true
                    }
                });
            });
        }
    );
});

// 9. Брутфорс токенів
app.post('/api/bruteforce-token', (req, res) => {
    const { email, username } = req.body;

    const possibleToken = crypto.createHash('sha256').update(email + username).digest('hex');

    db.get('SELECT user_id FROM password_reset_tokens WHERE token = ?', [possibleToken], (err, row) => {
        res.json({
            success: !!row,
            token: possibleToken,
            found: !!row,
            message: row ? 'Токен знайдено' : 'Токен не знайдено'
        });
    });
});

// 10. Скидання бази даних
app.post('/api/reset-db', (req, res) => {
    db.run('DELETE FROM password_reset_tokens', (err) => {
        if (err) return res.json({ success: false, message: 'Помилка' });
        res.json({ success: true, message: 'База токенів очищена' });
    });
});

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log('============================================================');
    console.log('A04: Insecure Design — Розширена лабораторна робота');
    console.log('============================================================');
    console.log(`Сервер: http://localhost:${PORT}`);
    console.log('API:');
    console.log('  POST /register          - Реєстрація');
    console.log('  POST /login             - Вхід');
    console.log('  GET  /profile/:id       - Профіль (IDOR)');
    console.log('  GET  /api/users         - Всі користувачі');
    console.log('  GET  /api/tokens        - Всі токени');
    console.log('  POST /api/bruteforce-token - Підбір токена');
    console.log('  POST /api/reset-db      - Очистка токенів');
    console.log('Вразливості:');
    console.log('  - Прості токени (SHA256 від email + username)');
    console.log('  - Токени не прострочуються');
    console.log('  - Токени можна використовувати повторно');
    console.log('  - SQL Injection у логіні');
    console.log('  - IDOR у профілях');
    console.log('  - Відкритий доступ до API');
    console.log('  - Паролі у відкритому вигляді');
    console.log('============================================================');
});
