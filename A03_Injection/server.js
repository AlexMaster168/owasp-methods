const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3003;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Вразливий endpoint (демонстрація)
app.post('/search-vulnerable', (req, res) => {
    const searchTerm = req.body.searchTerm;

    // Вразливість: конкатенація рядків → SQLi
    const query = `SELECT id, username, email, role FROM users WHERE username LIKE '%${searchTerm}%'`;

    console.log('Вразливий запит:', query);

    db.all(query, (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({
                error: 'Database error',
                details: err.message,
                query: query
            });
        }

        res.json({
            success: true,
            results: rows,
            query: query,
            vulnerable: true,
            count: rows.length
        });
    });
});

// Безпечний endpoint (правильна реалізація)
app.post('/search-secure', (req, res) => {
    const searchTerm = req.body.searchTerm;

    // Безпечно: параметризований запит
    const query = `SELECT id, username, email, role FROM users WHERE username LIKE ?`;
    const params = [`%${searchTerm}%`];

    console.log('Безпечний запит:', query, 'Параметри:', params);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({
                error: 'Database error'
            });
        }

        res.json({
            success: true,
            results: rows,
            query: query,
            params: params,
            secure: true,
            count: rows.length
        });
    });
});

// Endpoint для отримання всіх користувачів (для порівняння)
app.get('/users', (req, res) => {
    db.all('SELECT id, username, email, role FROM users', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ users: rows });
    });
});

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/search.html');
});

// Статистика атак
app.get('/stats', (req, res) => {
    res.sendFile(__dirname + '/public/stats.html');
});

app.listen(PORT, () => {
    console.log('============================================================');
    console.log('A03: SQL Injection Lab');
    console.log('============================================================');
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Статистика: http://localhost:${PORT}/stats`);
    console.log('');
    console.log('Вразливість: /search-vulnerable');
    console.log('Безпечно: /search-secure');
    console.log('');
    console.log('Приклади атак:');
    console.log("   ' OR '1'='1");
    console.log("   ' OR '1'='1' --");
    console.log("   ' UNION SELECT 1,2,3,4 --");
    console.log("   '; DROP TABLE users; --");
    console.log('============================================================');
});
