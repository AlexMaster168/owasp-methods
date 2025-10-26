const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3006;

// Middleware — з вразливими версіями!
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public')); // Вразливість: express@4.16.0 дозволяє обійти шлях до файлів

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Простий API для демонстрації
app.get('/api/info', (req, res) => {
    res.json({
        app: "MyApp",
        version: "1.0",
        express: require('express').version,
        message: "Цей додаток використовує застарілу версію Express — вияви це!"
    });
});

app.listen(PORT, () => {
    console.log(`A06: Vulnerable and Outdated Components lab is running on http://localhost:${PORT}`);
    console.log(`Main page: http://localhost:${PORT}`);
    console.log(`API info: http://localhost:${PORT}/api/info`);
    console.log(`Вразливість: Використовується express@4.16.0 — відома вразливість CVE-2018-12078 (Directory Traversal)!`);
    console.log(`Виявити: запустіть 'npm audit' або 'npx npm-audit-resolver'`);
});