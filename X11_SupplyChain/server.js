const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 3021;
const CDN_PORT = 4021;
const HOST = '127.0.0.1';

// «Секрети» додатку в оточенні — ціль шкідливої залежності
process.env.APP_STRIPE_KEY = 'sk_live_supply_chain_demo';
process.env.APP_DB_PASSWORD = 'Pr0d_DB_P@ss';

// ============================================================
// «Сторонній CDN» + сервер атакувальника (порт 4021)
// ============================================================
const cdn = express();
cdn.use(express.json());

const WIDGET_ORIGINAL = fs.readFileSync(path.join(__dirname, 'cdn', 'widget.js'), 'utf8');
const WIDGET_MALICIOUS = fs.readFileSync(path.join(__dirname, 'cdn', 'widget.compromised.js'), 'utf8');
let compromised = false;
const loot = [];

// SRI-хеш ОРИГІНАЛЬНОЇ версії, зафіксований розробником під час інтеграції
const WIDGET_SRI = 'sha384-' + crypto.createHash('sha384').update(WIDGET_ORIGINAL).digest('base64');

cdn.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*'); // CDN віддає скрипти будь-кому (потрібно для SRI з crossorigin)
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }
    next();
});
cdn.get('/widget.js', (req, res) => {
    res.type('application/javascript').send(compromised ? WIDGET_MALICIOUS : WIDGET_ORIGINAL);
});
cdn.post('/collect', (req, res) => {
    loot.push({ time: new Date().toISOString(), ...req.body });
    console.log('[ATTACKER] Отримано:', JSON.stringify(req.body));
    res.status(204).end();
});
cdn.listen(CDN_PORT, HOST, () => {
    console.log(`[CDN/ATTACKER] http://${HOST}:${CDN_PORT}`);

    // ВРАЗЛИВО: залежність з тайпсквотингом (lodahs замість lodash).
    // Підключаємо після старту «атакувальника», щоб показати ексфільтрацію.
    const _ = require('lodahs');
    console.log('[app] lodahs.chunk([1,2,3,4], 2) =', JSON.stringify(_.chunk([1, 2, 3, 4], 2)));
});

// ============================================================
// Основний додаток (порт 3021)
// ============================================================
const app = express();
app.use(express.json());

// Безпечна сторінка: той самий віджет, але з integrity + crossorigin
app.get('/secure.html', (req, res) => {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'secure.html'), 'utf8')
        .replaceAll('__WIDGET_SRI__', WIDGET_SRI);
    res.type('html').send(html);
});

app.use(express.static(path.join(__dirname, 'public')));

// Керування лабораторною
app.post('/lab/compromise', (req, res) => {
    compromised = Boolean(req.body.on);
    console.log(compromised ? '[!] CDN скомпрометовано — widget.js підмінено' : '[i] CDN відновлено');
    res.json({ compromised });
});
app.get('/lab/state', (req, res) => {
    res.json({
        compromised,
        sri: WIDGET_SRI,
        loot,
        postinstallMarker: fs.existsSync(path.join(__dirname, 'PWNED_BY_POSTINSTALL.txt'))
            ? fs.readFileSync(path.join(__dirname, 'PWNED_BY_POSTINSTALL.txt'), 'utf8')
            : null
    });
});
app.post('/lab/reset', (req, res) => { loot.length = 0; compromised = false; res.json({ ok: true }); });

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X11: Software Supply Chain Failures — OWASP A03:2025 (≈ A06:2021)');
    console.log('============================================================');
    console.log(`URL                : http://${HOST}:${PORT}`);
    console.log(`Без SRI (вразливо) : http://${HOST}:${PORT}/checkout.html`);
    console.log(`З SRI (безпечно)   : http://${HOST}:${PORT}/secure.html`);
    console.log('');
    console.log('Вектори:');
    console.log('  1. Тайпсквотинг: package.json → "lodahs" (а не "lodash")');
    console.log('     - postinstall-скрипт під час npm install');
    console.log('     - ексфільтрація APP_* змінних при require()');
    console.log('  2. Скомпрометований CDN: <script src> без integrity');
    console.log('============================================================');
});
