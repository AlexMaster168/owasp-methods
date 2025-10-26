const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('Помилка підключення до бази даних:', err.message);
    } else {
        console.log('Підключено до бази даних users.db');

        // Створюємо таблицю з plaintext-паролями
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      )
    `);

        const users = [
            { username: 'alice', email: 'alice@example.com', password: 'alice123', role: 'user' },
            { username: 'bob', email: 'bob@example.com', password: 'bobpass', role: 'admin' },
            { username: 'charlie', email: 'charlie@example.com', password: 'charlie123', role: 'user' }
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