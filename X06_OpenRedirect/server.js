const express = require('express');
const path = require('path');

const app = express();
const PORT = 3016;
const PHISH_PORT = 4016;
const HOST = '127.0.0.1';
const SELF_ORIGIN = `http://${HOST}:${PORT}`;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// 1. ВРАЗЛИВО: редірект на будь-яку адресу з параметра
// ============================================================
app.get('/go', (req, res) => {
    const url = req.query.url || '/';
    console.log('[VULN] redirect →', url);
    res.redirect(url);
});

// ============================================================
// 2. ВРАЗЛИВО: «перевірка», що шлях відносний — startsWith('/')
//    Обхід: //evil.com  або  /\evil.com  (браузер трактує як protocol-relative URL)
// ============================================================
app.get('/go-startswith', (req, res) => {
    const url = String(req.query.url || '/');
    if (!url.startsWith('/')) return res.status(400).send('Дозволені лише відносні шляхи');
    console.log('[NAIVE startsWith] redirect →', url);
    res.redirect(url);
});

// ============================================================
// 3. ВРАЗЛИВО: «перевірка» підрядка з довіреним доменом
//    Обхід: http://127.0.0.1:4016/?127.0.0.1:3016  або  http://127.0.0.1:3016@127.0.0.1:4016
// ============================================================
app.get('/go-includes', (req, res) => {
    const url = String(req.query.url || '/');
    if (!url.includes(`${HOST}:${PORT}`)) return res.status(400).send('Дозволено лише наш домен');
    console.log('[NAIVE includes] redirect →', url);
    res.redirect(url);
});

// Логін з параметром next — класичний вектор фішингу
app.post('/login', (req, res) => {
    const next = req.body.next || '/';
    // ВРАЗЛИВО: після успішного логіну — на будь-яку адресу з next
    res.redirect(next);
});

// ============================================================
// БЕЗПЕЧНО: парсимо URL відносно власного origin і дозволяємо лише свій origin
// ============================================================
function safeTarget(raw) {
    try {
        const target = new URL(String(raw || '/'), SELF_ORIGIN);
        if (target.origin !== SELF_ORIGIN) return null;
        return target.pathname + target.search + target.hash;
    } catch {
        return null;
    }
}

app.get('/go-secure', (req, res) => {
    const target = safeTarget(req.query.url);
    if (!target) {
        console.log('[SECURE] Заблоковано:', req.query.url);
        return res.status(400).send(`Заблоковано зовнішній редірект: ${String(req.query.url).replace(/[<>&"]/g, '')}`);
    }
    res.redirect(target);
});

app.post('/login-secure', (req, res) => {
    res.redirect(safeTarget(req.body.next) || '/');
});

app.get('/dashboard', (req, res) => res.send('<h1>Особистий кабінет</h1><a href="/">← Назад</a>'));

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X06: Open Redirect Lab — OWASP A01:2025 / A01:2021');
    console.log('============================================================');
    console.log(`URL: ${SELF_ORIGIN}`);
    console.log(`Фішинговий сайт: http://${HOST}:${PHISH_PORT}`);
    console.log('');
    console.log(`/go?url=http://${HOST}:${PHISH_PORT}`);
    console.log(`/go-startswith?url=//${HOST}:${PHISH_PORT}`);
    console.log(`/go-includes?url=http://${HOST}:${PHISH_PORT}/?${HOST}:${PORT}`);
    console.log(`/go-secure?url=http://${HOST}:${PHISH_PORT}   → 400`);
    console.log('============================================================');
});

// «Фішинговий» клон сторінки логіну
const phish = express();
phish.use(express.urlencoded({ extended: true }));
phish.get('/', (req, res) => {
    res.send(`<!doctype html><meta charset="utf-8"><title>Вхід</title>
<body style="font-family:system-ui;background:#fff0f0;padding:40px;text-align:center">
<h1>🎣 Фішингова сторінка (127.0.0.1:${PHISH_PORT})</h1>
<p>Користувач клікнув на посилання з <b>довіреного</b> домену 127.0.0.1:${PORT}, але опинився тут.</p>
<form method="post" action="/steal"><input name="login" placeholder="Логін"><br><br>
<input name="password" type="password" placeholder="Пароль"><br><br><button>Увійти</button></form></body>`);
});
phish.post('/steal', (req, res) => {
    console.log('[PHISH] Вкрадено облікові дані:', req.body);
    res.send(`<meta charset="utf-8"><p>Вкрадено: <code>${JSON.stringify(req.body).replace(/</g, '&lt;')}</code></p>`);
});
phish.listen(PHISH_PORT, HOST);
