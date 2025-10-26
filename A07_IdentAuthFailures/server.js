const express = require('express');
const session = require('express-session');
const db = require('./database');

const app = express();
const PORT = 3007;

// ПАРСИНГ ФОРМ (ОБОВ’ЯЗКОВО ПЕРЕД РОУТАМИ!)
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// СЕСІЇ
app.use(session({
    secret: 'my-secret-key-123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 година
}));

// ФОРМА ЛОГІНУ
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// ОБРОБНИК ЛОГІНУ — plaintext паролі!
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Логін спроба:', username, password);

    db.get('SELECT id, username, role FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
            if (err) {
                console.error('Помилка бази:', err);
                return res.status(500).send('Server error');
            }
            if (!row) {
                console.log('Неправильний логін/пароль:', username);
                return res.send('<h3>Неправильне ім’я або пароль.</h3><a href="/login">Спробувати знову</a>');
            }

            console.log('Успішний логін:', username);
            req.session.user = {
                id: row.id,
                username: row.username,
                role: row.role
            };

            res.redirect('/profile');
        }
    );
});

// ПРОФІЛЬ (тільки для авторизованих)
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(__dirname + '/public/profile.html');
});

// ВРАЗЛИВІСТЬ: ЗМІНА ПРОФІЛЮ — НЕ ПЕРЕВІРЯЄМО РОЛЬ!
app.post('/profile/update', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, role } = req.body;

    // ПОГАНИЙ ПІДХІД: Приймаємо role з клієнта і змінюємо в БД!
    db.run(
        'UPDATE users SET email = ?, role = ? WHERE id = ?',
        [email, role, req.session.user.id],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update profile' });
            }

            // ПОГАНИЙ ПІДХІД: Оновлюємо роль у сесії — атакувач стає admin!
            req.session.user.role = role;

            res.json({ success: true, message: 'Profile updated!' });
        }
    );
});

app.get('/api/user', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(req.session.user);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.listen(PORT, () => {
    console.log(`A07: Identification and Authentication Failures lab is running on http://localhost:${PORT}`);
    console.log(`Login: http://localhost:${PORT}/login`);
    console.log(`Profile: http://localhost:${PORT}/profile`);
    console.log(`Вразливість: Користувач може змінити свою роль з "user" на "admin" через POST /profile/update!`);
});