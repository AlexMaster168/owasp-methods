const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = 3008;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));


function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('<h3>Введіть ім’я та пароль</h3><a href="/login">Назад</a>');
    }

    db.get('SELECT id, username, email, role FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
            if (err) {
                return res.status(500).send('Помилка сервера');
            }
            if (!row) {
                return res.send('<h3>Неправильне ім’я або пароль.</h3><a href="/login">Спробувати знову</a>');
            }

            req.session.user = {
                id: row.id,
                username: row.username,
                email: row.email,
                role: row.role
            };

            res.redirect('/profile');
        }
    );
});

app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const profileDataParam = req.query.profileData;
    let profileData = {};
    let rawProfileData = null;

    if (profileDataParam) {
        try {
            rawProfileData = decodeURIComponent(profileDataParam);
            profileData = JSON.parse(rawProfileData);
        } catch (e) {
            return res.status(400).send('Неправильний формат даних');
        }
    }

    // Створюємо об’єкт користувача з даних сесії
    let user = {
        id: req.session.user.id,
        username: req.session.user.username,
        email: req.session.user.email,
        role: req.session.user.role
    };

    // Атака Prototype Pollution — як у PortSwigger
    if (rawProfileData && rawProfileData.includes('"__proto__"')) {
        try {
            const protoMatch = rawProfileData.match(/"__proto__"\s*:\s*(\{[^}]+\})/);
            if (protoMatch) {
                const protoData = JSON.parse(protoMatch[1]);
                delete user.role; // Видаляємо власну роль — щоб брати з прототипу
                Object.setPrototypeOf(user, protoData); // Встановлюємо зловмисний прототип
            }
        } catch (e) {}
    }


    const keys = Object.keys(profileData);
    for (const key of keys) {
        if (key !== '__proto__') {
            user[key] = profileData[key];
        }
    }


    const safeUsername = escapeHtml(user.username);
    const safeEmail = escapeHtml(user.email || 'Не вказано');
    const safeRole = escapeHtml(user.role || 'undefined');
    const safeProfileData = escapeHtml(JSON.stringify(profileData, null, 2));

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ваш профіль</title>
        <link rel="stylesheet" href="/style.css">
        <meta charset="UTF-8">
    </head>
    <body>
      <div class="container">
        <h1>Ваш профіль</h1>
        <p><strong>Ім’я:</strong> ${safeUsername}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Роль:</strong> <span style="color:${user.role === 'admin' ? 'red' : 'black'}">${safeRole}</span></p>
        <p><strong>Дані профілю:</strong> <pre>${safeProfileData}</pre></p>

        <hr>
        <h3>Завдання:</h3>
        <ol>
          <li>Увійдіть як <code>alice</code> (пароль: <code>alice123</code>).</li>
          <li>Перейдіть за посиланням:  
            <a href="/profile?profileData=%7B%22__proto__%22%3A%7B%22role%22%3A%22admin%22%7D%7D">Змінити роль на admin</a></li>
          <li>Чи отримали ви роль <code>admin</code>?</li>
          <li>Спробуйте змінити email:  
            <a href="/profile?profileData=%7B%22__proto__%22%3A%7B%22role%22%3A%22admin%22%7D%2C%22email%22%3A%22hacked%40evil.com%22%7D">Змінити email і роль</a></li>
          <li>Чому це можливо? Як це виправити?</li>
        </ol>

        <h4>Пояснення:</h4>
        <p>Це — <em>Prototype Pollution</em>. Ви не змінюєте властивість <code>user.role</code>, а змінюєте <code>Object.prototype.role</code>.  
        Якщо в об’єкта <code>user</code> немає власної властивості <code>role</code>, він "наслідує" її з прототипу.</p>
        
        <h4>Як виправити:</h4>
        <ol>
          <li>Не використовуйте <code>Object.setPrototypeOf()</code> з даними з клієнта</li>
          <li>Перевіряйте наявність <code>__proto__</code>, <code>constructor</code>, <code>prototype</code> в JSON</li>
          <li>Ніколи не десеріалізуйте довірений JSON без валідації</li>
        </ol>
        
        <a href="/logout" style="display:inline-block;margin-top:20px;padding:10px;background:#dc3545;color:white;text-decoration:none;border-radius:5px;">Вийти</a>
      </div>
    </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Помилка виходу:', err);
        res.redirect('/login');
    });
});

app.listen(PORT, () => {
    console.log('A08: Помилки цілісності даних — лабораторна робота запущена на http://localhost:' + PORT);
    console.log('Логін: http://localhost:' + PORT + '/login');
    console.log('Вразливість: Десеріалізація JSON з параметром profileData дозволяє атаку через __proto__!');
    console.log('Приклад атаки: /profile?profileData=%7B%22__proto__%22%3A%7B%22role%22%3A%22admin%22%7D%7D');
    console.log('Це навчальний додаток з умисними вразливостями! НЕ використовуйте в продакшні.');
});