const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 3020;
const ATTACKER_PORT = 4020;
const HOST = '127.0.0.1';
const SELF_ORIGIN = `http://${HOST}:${PORT}`;

// Режим запуску: npm start (вразливо) або npm run start:secure (виправлено)
const SECURE = process.argv.includes('--secure');

const app = express();
app.use(express.json());

// Підставні «секрети» в оточенні, які витікають через /debug
process.env.APP_DB_PASSWORD = 'Pr0d_DB_P@ss';
process.env.APP_AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
process.env.APP_JWT_SECRET = 'change-me-later';

const sessions = {};
// БЕЗПЕЧНО: замість дефолтного admin/admin — випадковий пароль (або з ADMIN_PASSWORD)
const ADMIN_PASSWORD = SECURE ? (process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')) : 'admin';
const account = { username: 'admin', email: 'admin@corp.local', apiKey: 'AKIA-' + crypto.randomBytes(8).toString('hex').toUpperCase(), deleted: false };

const sid = req => ((req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/) || [])[1];
const authed = req => Boolean(sessions[sid(req)]);

// ============================================================
// 1. Заголовки безпеки
// ============================================================
if (SECURE) {
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.set({
            'X-Frame-Options': 'DENY',                                              // анти-clickjacking (legacy)
            'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", // анти-clickjacking (сучасний)
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        });
        next();
    });
} else {
    // ВРАЗЛИВО: X-Powered-By: Express (за замовчуванням) + розкриття версій
    app.use((req, res, next) => {
        res.set('Server', `Node.js/${process.version}`);
        next();
    });
}

// ============================================================
// 2. CORS
// ============================================================
const ALLOWED_ORIGINS = new Set([SELF_ORIGIN]);

app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();

    if (SECURE) {
        // БЕЗПЕЧНО: точний allowlist
        if (ALLOWED_ORIGINS.has(origin)) {
            res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' });
        }
    } else {
        // ВРАЗЛИВО: віддзеркалюємо БУДЬ-ЯКИЙ Origin (навіть "null") + дозволяємо cookie
        res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' });
    }
    if (req.method === 'OPTIONS') {
        res.set({ 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
        return res.status(204).end();
    }
    next();
});

// ============================================================
// Функціонал «адмін-панелі»
// ============================================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // ВРАЗЛИВО (у вразливому режимі): дефолтні облікові дані admin/admin
    if (username !== 'admin' || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Невірні дані' });

    const id = crypto.randomBytes(16).toString('hex');
    sessions[id] = true;
    res.setHeader('Set-Cookie', `sid=${id}; Path=/; HttpOnly; SameSite=Lax`);
    res.json({ success: true });
});

app.get('/api/account', (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Not logged in' });
    res.json(account);
});

app.post('/api/delete-account', (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Not logged in' });
    account.deleted = true;
    console.log('[!] Акаунт видалено (можливо, через clickjacking)');
    res.json({ success: true });
});

app.post('/api/restore', (req, res) => { account.deleted = false; res.json({ success: true }); });

// ============================================================
// 3. Витік інформації: debug-ендпоінт і лістинг директорії з бекапами
// ============================================================
if (!SECURE) {
    // ВРАЗЛИВО: відкритий debug-ендпоінт, залишений «з розробки»
    app.get('/debug', (req, res) => {
        res.json({
            node: process.version,
            platform: process.platform,
            cwd: process.cwd(),
            memory: process.memoryUsage(),
            // ← у реальних додатках тут часто віддають увесь process.env.
            // У лабораторній показуємо лише підставні APP_*, щоб не світити справжні змінні твоєї машини.
            env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('APP_') || k === 'NODE_ENV')),
            sessions
        });
    });

    // ВРАЗЛИВО: лістинг директорії
    app.get('/backup/', (req, res) => {
        const files = fs.readdirSync(path.join(__dirname, 'backup'));
        res.send(`<h1>Index of /backup/</h1><ul>${files.map(f => `<li><a href="/backup/${f}">${f}</a></li>`).join('')}</ul>`);
    });
    app.use('/backup', express.static(path.join(__dirname, 'backup')));
}

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X10: CORS / Clickjacking / Info Leak — OWASP A02:2025 / A05:2021');
    console.log('============================================================');
    console.log(`Режим: ${SECURE ? '🟢 SECURE' : '🔴 VULNERABLE'}`);
    console.log(`Адмінка            : ${SELF_ORIGIN}   (admin / ${ADMIN_PASSWORD})`);
    console.log(`Сайт атакувальника : http://${HOST}:${ATTACKER_PORT}`);
    if (!SECURE) {
        console.log(`Debug              : ${SELF_ORIGIN}/debug`);
        console.log(`Бекапи             : ${SELF_ORIGIN}/backup/`);
    }
    console.log('============================================================');
});

// Сайт атакувальника
const evil = express();
evil.use(express.static(path.join(__dirname, 'attacker')));
evil.listen(ATTACKER_PORT, HOST);
