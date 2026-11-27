const express = require('express');
const path = require('path');

const app = express();
const PORT = 3011;
const HOST = '127.0.0.1';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ВРАЗЛИВІСТЬ: сесійна cookie БЕЗ HttpOnly — JavaScript (і XSS-пейлоад) може її прочитати
app.use((req, res, next) => {
    if (!/session=/.test(req.headers.cookie || '')) {
        res.cookie('session', 'admin-session-' + Math.random().toString(36).slice(2), {
            httpOnly: false, // ← погано
            sameSite: 'lax'
        });
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Безпечне екранування HTML
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function page(title, body) {
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="/style.css"></head>
<body><div class="container">${body}<p><a href="/">← Назад</a></p></div></body></html>`;
}

// ============================================================
// 1. REFLECTED XSS
// ============================================================

// ВРАЗЛИВО: параметр q вставляється в HTML без екранування
app.get('/search', (req, res) => {
    const q = req.query.q || '';
    res.send(page('Пошук', `
        <h1>Результати пошуку</h1>
        <p>Ви шукали: <b>${q}</b></p>
        <p class="hint">Нічого не знайдено.</p>`));
});

// БЕЗПЕЧНО: екранування + Content-Security-Policy
app.get('/search-secure', (req, res) => {
    const q = req.query.q || '';
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
    res.send(page('Пошук (безпечно)', `
        <h1>Результати пошуку (безпечно)</h1>
        <p>Ви шукали: <b>${escapeHtml(q)}</b></p>
        <p class="hint">Нічого не знайдено.</p>`));
});

// ============================================================
// 2. STORED XSS — гостьова книга
// ============================================================

const comments = [
    { author: 'alice', text: 'Чудовий сайт!' },
    { author: 'bob', text: 'Дякую за статтю 👍' }
];

// ВРАЗЛИВО: зберігаємо будь-що без валідації, а клієнт рендерить через innerHTML
app.post('/api/comments', (req, res) => {
    const { author, text } = req.body;
    if (!author || !text) {
        return res.status(400).json({ success: false, error: 'author і text обов’язкові' });
    }
    comments.push({ author, text });
    res.json({ success: true, count: comments.length });
});

app.get('/api/comments', (req, res) => {
    res.json(comments);
});

app.post('/api/comments/reset', (req, res) => {
    comments.splice(2);
    res.json({ success: true });
});

// ВРАЗЛИВО: сторінка гостьової книги, яку рендерить сервер (без екранування)
app.get('/guestbook', (req, res) => {
    const list = comments.map(c => `<div class="card"><b>${c.author}</b>: ${c.text}</div>`).join('');
    res.send(page('Гостьова книга', `<h1>Гостьова книга</h1>${list}`));
});

// БЕЗПЕЧНО: та сама сторінка з екрануванням
app.get('/guestbook-secure', (req, res) => {
    const list = comments
        .map(c => `<div class="card"><b>${escapeHtml(c.author)}</b>: ${escapeHtml(c.text)}</div>`)
        .join('');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
    res.send(page('Гостьова книга (безпечно)', `<h1>Гостьова книга (безпечно)</h1>${list}`));
});

// ============================================================
// 3. «Сервер атакувальника» — збирає вкрадені cookie
// ============================================================
const stolen = [];
app.get('/steal', (req, res) => {
    stolen.push({ time: new Date().toISOString(), data: req.query.c || '' });
    console.log('[ATTACKER] Отримано:', req.query.c);
    res.status(204).end();
});
app.get('/api/stolen', (req, res) => res.json(stolen));

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X01: Cross-Site Scripting (XSS) Lab — OWASP A05:2025 / A03:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Reflected XSS : /search?q=<img src=x onerror=alert(1)>');
    console.log('Stored XSS    : POST /api/comments → /guestbook');
    console.log('DOM XSS       : /dom.html#<img src=x onerror=alert(document.domain)>');
    console.log('Безпечні версії: /search-secure, /guestbook-secure, /dom.html?safe=1');
    console.log('============================================================');
});
