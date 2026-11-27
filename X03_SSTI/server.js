const express = require('express');
const path = require('path');

const app = express();
const PORT = 3013;
const HOST = '127.0.0.1';

// «Секрети» в оточенні процесу — ціль для атакувальника
process.env.APP_SECRET = 'sk_live_51H_ssti_demo_secret';
process.env.DB_PASSWORD = 'P@ssw0rd_from_env';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Дані, доступні у шаблоні листа
const context = {
    name: 'Олексій',
    order: 'A-1024',
    total: 1499.99
};

// ============================================================
// ВРАЗЛИВО: «шаблонізатор» на основі JS template literals
// Користувач (маркетолог) надсилає ТЕКСТ шаблону, а сервер його ВИКОНУЄ як код
// ============================================================
function renderUnsafe(template, data) {
    // Будь-який ${...} всередині шаблону виконується як JavaScript на сервері!
    const fn = new Function(...Object.keys(data), 'return `' + template + '`;');
    return fn(...Object.values(data));
}

app.post('/preview', (req, res) => {
    const template = req.body.template || '';
    try {
        const output = renderUnsafe(template, context);
        res.json({ vulnerable: true, output });
    } catch (e) {
        res.status(500).json({ vulnerable: true, error: e.message });
    }
});

// ============================================================
// БЕЗПЕЧНО: логіко-вільні плейсхолдери {{field}} з allowlist полів
// Шаблон — це ДАНІ, а не код
// ============================================================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderSafe(template, data) {
    const allowed = new Set(Object.keys(data));
    return String(template).replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key) =>
        allowed.has(key) ? escapeHtml(data[key]) : match
    );
}

app.post('/preview-secure', (req, res) => {
    const template = req.body.template || '';
    res.json({ secure: true, output: renderSafe(template, context) });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X03: Server-Side Template Injection Lab — OWASP A05:2025 / A03:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Вразливо : POST /preview        { template }   — синтаксис ${...}');
    console.log('Безпечно : POST /preview-secure { template }   — синтаксис {{name}}');
    console.log('');
    console.log('Приклади атак:');
    console.log('   ${7*7}');
    console.log('   ${JSON.stringify(process.env)}');
    console.log("   ${process.mainModule.require('child_process').execSync('whoami')}");
    console.log('============================================================');
});
