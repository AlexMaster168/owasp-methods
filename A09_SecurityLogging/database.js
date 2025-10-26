const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('Помилка підключення до бази даних:', err.message);
        return;
    }

    console.log('Підключено до бази даних users.db');

    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    )
  `, (err) => {
        if (err) {
            console.error('Помилка створення таблиці:', err.message);
            return;
        }

        console.log('Таблиця "users" створена або вже існує.');

        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) {
                console.error('Помилка перевірки користувачів:', err.message);
                return;
            }

            if (row.count > 0) {
                console.log(`У базі вже є ${row.count} користувачів. Пропускаємо ініціалізацію.`);
                return;
            }

            const users = [
                { username: 'alice', email: 'alice@example.com', password: 'alice123', role: 'user' },
                { username: 'bob', email: 'bob@example.com', password: 'bobpass', role: 'admin' },
                { username: 'charlie', email: 'charlie@example.com', password: 'charlie123', role: 'user' }
            ];

            const stmt = db.prepare(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
            );

            users.forEach(user => {
                stmt.run(
                    user.username,
                    user.email,
                    user.password,
                    user.role,
                    (err) => {
                        if (err) {
                            console.error(`Помилка додавання ${user.username}:`, err.message);
                        } else {
                            console.log(`Додано користувача: ${user.username} (${user.role})`);
                        }
                    }
                );
            });

            stmt.finalize((err) => {
                if (err) {
                    console.error('Помилка завершення:', err.message);
                } else {
                    console.log('\nІніціалізація бази даних завершена!\n');
                    console.log('Тестові облікові дані:');
                    console.log('   alice / alice123 — звичайний користувач');
                    console.log('   bob / bobpass — адміністратор');
                    console.log('   charlie / charlie123 — звичайний користувач\n');
                }
            });
        });
    });
});

module.exports = db;