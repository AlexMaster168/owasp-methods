const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3005;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// === ПОЛІТИКА БЕЗПЕКИ: УМІСНО ПОГАНА — НЕМАЄ ОБМЕЖЕНЬ НА СПРОБИ! ===

// Форма скидання пароля
app.get('/forgot', (req, res) => {
    res.sendFile(__dirname + '/public/reset.html');
});

// Обробка запиту на скидання — БЕЗ ЛІМІТІВ!
app.post('/forgot', (req, res) => {
    const { email } = req.body;

    // ПЕРЕВІРКА: чи існує email — але НЕ ОБМЕЖУЄМО кількість запитів!
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return res.status(500).send('Server error');

        if (row) {
            // ВРАЗЛИВІСТЬ: НІЯКИХ ОБМЕЖЕНЬ — можна надсилати 1000 разів за хвилину!
            // Ніякого rate-limit, ніякого CAPTCHA, ніякого блокування IP
            const attemptTime = Date.now();
            db.run(
                'INSERT INTO reset_attempts (email, ip_address, attempt_time) VALUES (?, ?, ?)',
                [email, req.ip || 'unknown', attemptTime],
                (err) => {
                    if (err) console.error('Помилка запису спроби:', err.message);
                    res.send('<h3>Якщо адреса існує, лист надіслано.</h3>');
                }
            );
        } else {
            res.send('<h3>Якщо адреса існує, лист надіслано.</h3>'); // Щоб не витікати інформація
        }
    });
});

// Простий endpoint для демонстрації атаки
app.get('/api/attempts', (req, res) => {
    // ВРАЗЛИВІСТЬ: Відкритий API, що показує всі спроби — це необхідно для атаки!
    db.all('SELECT email, ip_address, attempt_time FROM reset_attempts ORDER BY attempt_time DESC LIMIT 10', (err, rows) => {
        if (err) return res.status(500).send('Server error');
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`A05: Security Misconfiguration (Rate Limit) lab is running on http://localhost:${PORT}`);
    console.log(`Forgot password: http://localhost:${PORT}/forgot`);
    console.log(`Перегляд спроб: http://localhost:${PORT}/api/attempts`);
    console.log(`Вразливість: Немає обмеження на кількість запитів скидання пароля — можна брутфорсити email!`);
});