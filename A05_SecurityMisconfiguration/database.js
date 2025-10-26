const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('Помилка підключення до бази даних:', err.message);
    } else {
        console.log('Підключено до бази даних users.db');

        // Таблиця користувачів
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      )
    `);

        // Таблиця спроб скидання пароля
        db.run(`
      CREATE TABLE IF NOT EXISTS reset_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        ip_address TEXT,
        attempt_time INTEGER,
        success BOOLEAN DEFAULT FALSE
      )
    `);

        // Додаємо тестових користувачів
        const users = [
            { username: 'alice', email: 'alice@example.com', password: 'alice123', role: 'user' },
            { username: 'bob', email: 'bob@example.com', password: 'bobpass', role: 'admin' }
        ];

        users.forEach(user => {
            db.run(
                'INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                [user.username, user.email, user.password, user.role],
                (err) => {
                    if (err) console.error('Помилка додавання користувача:', err.message);
                }
            );
        });
    }
});

module.exports = db;