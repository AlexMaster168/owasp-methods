const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3022;
const HOST = '127.0.0.1';
const SECRET = crypto.randomBytes(32);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Дані ----------
let accounts, wallet;
function reset() {
    accounts = { alice: 1000, bob: 500 };
    wallet = { balance: 100 };
}
reset();

// Токен формату base64url(JSON).HMAC
function issueToken(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function verifyToken(token) {
    const [body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    // ↓ кидає виняток, якщо довжини різні або sig === undefined
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
}

app.get('/api/token', (req, res) => res.json({ user: issueToken({ user: 'alice', role: 'user' }) }));

// ============================================================
// 1. FAIL-OPEN (CWE-636): помилка під час перевірки = доступ дозволено
// ============================================================
function authFailOpen(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try {
        const payload = verifyToken(token);
        if (!payload || payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        req.user = payload;
        next();
    } catch (e) {
        // ВРАЗЛИВО: «щоб не ламати UX» — при будь-якій помилці пропускаємо далі
        console.log('[FAIL-OPEN] Помилка перевірки токена, пропускаємо:', e.message);
        req.user = { user: 'unknown', role: 'admin' };
        next();
    }
}

function authFailClosed(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try {
        const payload = verifyToken(token);
        if (!payload || payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        req.user = payload;
        next();
    } catch {
        // БЕЗПЕЧНО: будь-яка помилка = відмова (fail closed)
        return res.status(401).json({ error: 'Invalid token' });
    }
}

const adminData = (req, res) => res.json({ secret: 'FLAG{fail_open_auth_bypass}', user: req.user });
app.get('/api/admin', authFailOpen, adminData);
app.get('/api/admin-secure', authFailClosed, adminData);

// ============================================================
// 2. НЕОБРОБЛЕНИЙ ВИНЯТОК У ASYNC-ХЕНДЛЕРІ (CWE-248) → падіння всього сервера
//    Express 4 не ловить відхилені проміси → unhandledRejection → процес завершується
// ============================================================
app.get('/api/report', async (req, res) => {
    await new Promise(r => setTimeout(r, 50));             // «запит до БД»
    const filter = JSON.parse(req.query.filter);           // ← кидає SyntaxError на кривому JSON
    res.json({ report: `Звіт за ${filter.year}`, rows: 42 });
});

app.get('/api/report-secure', async (req, res, next) => {
    try {
        await new Promise(r => setTimeout(r, 50));
        let filter;
        try { filter = JSON.parse(req.query.filter); } catch { return res.status(400).json({ error: 'filter має бути JSON' }); }
        if (!filter || !Number.isInteger(filter.year)) return res.status(400).json({ error: 'year має бути цілим числом' });
        res.json({ report: `Звіт за ${filter.year}`, rows: 42 });
    } catch (e) {
        next(e); // передаємо в централізований обробник
    }
});

// ============================================================
// 3. ВИТІК ДЕТАЛЕЙ ПОМИЛКИ (CWE-209)
// ============================================================
const DB_CONFIG = { host: '10.0.0.5', user: 'app', password: 'Pr0d_DB_P@ss', database: 'shop' };

function findUser(id) {
    const query = `SELECT * FROM users WHERE id = ${id}`;
    if (!/^\d+$/.test(id)) {
        const err = new Error(`SQLITE_ERROR: near "${id}": syntax error`);
        err.query = query;
        err.config = DB_CONFIG;
        throw err;
    }
    return { id: Number(id), username: 'user' + id };
}

app.get('/api/user/:id', (req, res) => {
    try {
        res.json(findUser(req.params.id));
    } catch (e) {
        // ВРАЗЛИВО: віддаємо клієнту stack trace, SQL-запит і конфіг БД
        res.status(500).json({ error: e.message, stack: e.stack, query: e.query, config: e.config });
    }
});

app.get('/api/user-secure/:id', (req, res) => {
    try {
        res.json(findUser(req.params.id));
    } catch (e) {
        // БЕЗПЕЧНО: деталі — тільки в серверний лог, клієнту — загальне повідомлення + ID інциденту
        const incident = crypto.randomUUID();
        console.error(`[ERROR ${incident}]`, e.message, e.query);
        res.status(500).json({ error: 'Внутрішня помилка сервера', incident });
    }
});

// ============================================================
// 4. НЕАТОМАРНА ОПЕРАЦІЯ БЕЗ ВІДКАТУ (CWE-460)
// ============================================================
function credit(to, amount) {
    if (!(to in accounts)) throw new Error('Отримувача не знайдено: ' + to);
    accounts[to] += amount;
}

app.post('/api/transfer', (req, res) => {
    const { from, to } = req.body;
    const amount = Number(req.body.amount);
    try {
        if (!(from in accounts) || !(amount > 0) || accounts[from] < amount) return res.status(400).json({ error: 'Bad request' });
        accounts[from] -= amount;   // 1) списали
        credit(to, amount);         // 2) кинуло виняток → кроку «повернути» немає
        res.json({ success: true, accounts });
    } catch (e) {
        // ВРАЗЛИВО: помилку «оброблено», але гроші вже списано і зникли
        res.status(500).json({ error: e.message, accounts });
    }
});

app.post('/api/transfer-secure', (req, res) => {
    const { from, to } = req.body;
    const amount = Number(req.body.amount);
    if (!(from in accounts) || !(to in accounts) || !(amount > 0) || accounts[from] < amount) {
        return res.status(400).json({ error: 'Bad request', accounts }); // валідація ДО зміни стану
    }
    const snapshot = { ...accounts };
    try {
        accounts[from] -= amount;
        credit(to, amount);
        res.json({ success: true, accounts });
    } catch (e) {
        accounts = snapshot;         // відкат (у БД — ROLLBACK транзакції)
        res.status(500).json({ error: 'Переказ скасовано', accounts });
    }
});

// ============================================================
// 5. NaN / Infinity обходять перевірки (CWE-754 / CWE-369)
// ============================================================
const PRICE = 30;

app.post('/api/buy', (req, res) => {
    const qty = Number(req.body.qty);          // "abc" → NaN, "1e309" → Infinity
    const total = PRICE * qty;

    // ВРАЗЛИВО: NaN > 100 === false → перевірка «пройдена»
    if (total > wallet.balance) return res.status(400).json({ error: 'Недостатньо коштів', wallet });
    wallet.balance -= total;                   // 100 - NaN = NaN → баланс зламано
    res.json({ success: true, qty, total, wallet });
});

app.post('/api/buy-secure', (req, res) => {
    const qty = Number(req.body.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) return res.status(400).json({ error: 'qty має бути цілим 1..100', wallet });
    const total = PRICE * qty;
    if (!(total <= wallet.balance)) return res.status(400).json({ error: 'Недостатньо коштів', wallet }); // позитивна перевірка
    wallet.balance -= total;
    res.json({ success: true, qty, total, wallet });
});

app.get('/api/state', (req, res) => res.json({ accounts, wallet }));
app.post('/api/reset', (req, res) => { reset(); res.json({ accounts, wallet }); });

// Централізований обробник помилок (для безпечних маршрутів)
app.use((err, req, res, next) => {
    const incident = crypto.randomUUID();
    console.error(`[ERROR ${incident}]`, err);
    res.status(500).json({ error: 'Внутрішня помилка сервера', incident });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X12: Mishandling of Exceptional Conditions — OWASP A10:2025 (нова)');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('1. Fail-open       : GET  /api/admin   (Authorization: Bearer garbage)');
    console.log('2. Crash (DoS)     : GET  /api/report?filter=oops   ← вбиває процес!');
    console.log('3. Stack trace     : GET  /api/user/1\'');
    console.log('4. Без відкату     : POST /api/transfer { from:"alice", to:"nobody", amount:100 }');
    console.log('5. NaN-обхід       : POST /api/buy { qty:"abc" }');
    console.log('Безпечні версії мають суфікс -secure');
    console.log('============================================================');
});
