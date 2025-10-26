const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3001;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// === ПОЛІТИКА БЕЗПЕКИ: УМІСНО ПОГАНА ===
// Користувачі (у реальному житті — в БД!)
const users = [
    { id: 1, username: 'alice', role: 'user', email: 'alice@example.com' },
    { id: 2, username: 'bob', role: 'admin', email: 'bob@example.com' },
    { id: 3, username: 'charlie', role: 'user', email: 'charlie@example.com' }
];

// Функція для отримання користувача за ID — НЕ ПЕРЕВІРЯЄМО, хто запитує!
app.get('/profile/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = users.find(u => u.id === userId);
    if (user) {
        res.json({
            success: true,
            user
        });
    } else {
        res.status(404).json({ success: false, error: 'User not found' });
    }
});

// Форма для перегляду профілю
app.get('/profile', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Підсвітка: Адміністратор може змінити будь-якого користувача
app.post('/profile/:id/update', (req, res) => {
    const userId = parseInt(req.params.id);
    const { email } = req.body;

    const user = users.find(u => u.id === userId);
    if (user) {
        user.email = email;
        res.json({ success: true, message: 'Profile updated!' });
    } else {
        res.status(404).json({ success: false, error: 'User not found' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`A01: Broken Access Control lab is running on http://localhost:${PORT}`);
    console.log(`Public files: http://localhost:${PORT}/profile`);
    console.log(`Вразливість: будь-який користувач може отримати доступ до профілю іншого через зміну ID в URL!`);
});