const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

// Ініціалізація бази даних
db.serialize(() => {
    // Створення таблиці користувачів
    db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Додавання тестових користувачів
    const users = [
        { username: 'admin', email: 'admin@example.com', role: 'administrator', password: 'super_secret_admin_pass' },
        { username: 'alice', email: 'alice@example.com', role: 'user', password: 'alice123' },
        { username: 'bob', email: 'bob@example.com', role: 'user', password: 'bob456' },
        { username: 'charlie', email: 'charlie@example.com', role: 'moderator', password: 'charlie789' },
        { username: 'david', email: 'david@example.com', role: 'user', password: 'david000' },
        { username: 'eve', email: 'eve@example.com', role: 'user', password: 'eve111' },
        { username: 'frank', email: 'frank@example.com', role: 'moderator', password: 'frank222' },
        { username: 'grace', email: 'grace@example.com', role: 'user', password: 'grace333' },
    ];

    const stmt = db.prepare('INSERT INTO users (username, email, role, password) VALUES (?, ?, ?, ?)');

    users.forEach(user => {
        stmt.run(user.username, user.email, user.role, user.password);
    });

    stmt.finalize();

    // Створення таблиці з конфіденційними даними
    db.run(`
        CREATE TABLE secrets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            secret_data TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    const secretStmt = db.prepare('INSERT INTO secrets (user_id, secret_data) VALUES (?, ?)');
    secretStmt.run(1, 'API_KEY: sk-proj-abc123xyz789');
    secretStmt.run(1, 'DATABASE_PASSWORD: P@ssw0rd!2024');
    secretStmt.run(2, 'Credit Card: 4532-1234-5678-9012');
    secretStmt.finalize();

    console.log('База даних ініціалізована');
    console.log('Користувачі:', users.length);
    console.log('Секрети додано до БД');
});

module.exports = db;