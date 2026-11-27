const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3015;
const ATTACKER_PORT = 4015;
const HOST = '127.0.0.1';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Простий session-механізм на cookie ----------
const sessions = {}; // sid -> { username, csrfToken }
const accounts = {
    alice: { password: 'alice123', balance: 10000 },
    hacker: { password: 'hacker', balance: 0 }
};
const history = [];

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => {
        const i = c.indexOf('=');
        return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    }));
}

app.use((req, res, next) => {
    const sid = parseCookies(req).sid;
    req.session = sid && sessions[sid] ? sessions[sid] : null;
    req.sid = sid;
    next();
});

function requireLogin(req, res, next) {
    if (!req.session) return res.status(401).json({ error: 'Not logged in' });
    next();
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const acc = accounts[username];
    if (!acc || acc.password !== password) return res.status(401).json({ error: 'Невірні дані' });

    const sid = crypto.randomBytes(16).toString('hex');
    sessions[sid] = { username, csrfToken: crypto.randomBytes(24).toString('hex') };

    // ВРАЗЛИВІСТЬ: SameSite=Lax (дефолт браузерів) не захищає від same-site атак
    // (інший порт / піддомен вважаються тим самим «сайтом»), а GET-переходи Lax пропускає завжди.
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
    res.json({ success: true });
});

app.post('/logout', (req, res) => {
    if (req.sid) delete sessions[req.sid];
    res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
    res.json({ success: true });
});

app.get('/api/me', requireLogin, (req, res) => {
    const acc = accounts[req.session.username];
    res.json({ username: req.session.username, balance: acc.balance, csrfToken: req.session.csrfToken, history });
});

function doTransfer(from, to, amount, via) {
    amount = Number(amount);
    if (!accounts[to] || !(amount > 0) || accounts[from].balance < amount) return false;
    accounts[from].balance -= amount;
    accounts[to].balance += amount;
    history.push({ time: new Date().toLocaleTimeString(), from, to, amount, via });
    console.log(`[TRANSFER/${via}] ${from} → ${to}: ${amount}`);
    return true;
}

// ============================================================
// ВРАЗЛИВО: зміна стану лише на основі cookie, без CSRF-токена
// і навіть через GET (працює з <img src=...>)
// ============================================================
app.all('/transfer', requireLogin, (req, res) => {
    const { to, amount } = { ...req.query, ...req.body };
    const ok = doTransfer(req.session.username, to, amount, 'vulnerable ' + req.method);
    res.json({ success: ok });
});

// ============================================================
// БЕЗПЕЧНО: тільки POST + synchronizer CSRF token + перевірка Origin
// ============================================================
app.post('/transfer-secure', requireLogin, (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== `http://${HOST}:${PORT}`) {
        return res.status(403).json({ error: 'Bad Origin: ' + origin });
    }
    const token = req.headers['x-csrf-token'] || req.body.csrfToken;
    const expected = req.session.csrfToken;
    if (!token || token.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    const ok = doTransfer(req.session.username, req.body.to, req.body.amount, 'secure');
    res.json({ success: ok });
});

app.post('/api/reset', (req, res) => {
    accounts.alice.balance = 10000;
    accounts.hacker.balance = 0;
    history.length = 0;
    res.json({ success: true });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X05: Cross-Site Request Forgery Lab — OWASP A01:2025 / A01:2021');
    console.log('============================================================');
    console.log(`Банк (жертва)       : http://${HOST}:${PORT}   (alice / alice123)`);
    console.log(`Сайт атакувальника  : http://${HOST}:${ATTACKER_PORT}`);
    console.log('');
    console.log('Вразливо : /transfer         (GET або POST, тільки cookie)');
    console.log('Безпечно : /transfer-secure  (POST + X-CSRF-Token + Origin)');
    console.log('============================================================');
});

// ============================================================
// Окремий «зловмисний» сайт на іншому порту
// ============================================================
const evil = express();
evil.use(express.static(path.join(__dirname, 'attacker')));
evil.listen(ATTACKER_PORT, HOST, () => {
    console.log(`[ATTACKER] Зловмисна сторінка: http://${HOST}:${ATTACKER_PORT}`);
});
