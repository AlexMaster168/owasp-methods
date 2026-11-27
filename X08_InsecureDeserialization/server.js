const express = require('express');
const path = require('path');
const crypto = require('crypto');
const serialize = require('node-serialize'); // 0.0.4 — CVE-2017-5941 (RCE через unserialize)

const app = express();
const PORT = 3018;
const HOST = '127.0.0.1';
const HMAC_KEY = crypto.randomBytes(32); // для безпечної версії

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getCookie(req, name) {
    const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}

// ============================================================
// ВРАЗЛИВО: профіль зберігається в cookie як серіалізований об’єкт
// і десеріалізується через node-serialize.unserialize(), який виконує eval()
// для значень з префіксом _$$ND_FUNC$$_ → IIFE = віддалене виконання коду
// ============================================================
app.post('/login', (req, res) => {
    const profile = { username: req.body.username || 'guest', theme: 'dark', lang: 'uk' };
    const cookie = Buffer.from(serialize.serialize(profile)).toString('base64');
    res.setHeader('Set-Cookie', `profile=${encodeURIComponent(cookie)}; Path=/`);
    res.json({ success: true, cookie });
});

app.get('/api/profile', (req, res) => {
    const raw = getCookie(req, 'profile');
    if (!raw) return res.status(401).json({ error: 'Немає cookie profile' });

    try {
        const json = Buffer.from(raw, 'base64').toString('utf8');
        const profile = serialize.unserialize(json); // ← RCE тут
        res.json({ vulnerable: true, greeting: `Привіт, ${profile.username}!`, profile });
    } catch (e) {
        res.status(400).json({ error: 'Deserialization error: ' + e.message });
    }
});

// ============================================================
// БЕЗПЕЧНО:
//  - JSON.parse (дані, не код) замість unserialize
//  - HMAC-підпис cookie → клієнт не може її підробити
//  - валідація схеми (лише очікувані поля і типи)
// ============================================================
function sign(data) {
    return crypto.createHmac('sha256', HMAC_KEY).update(data).digest('base64url');
}

app.post('/login-secure', (req, res) => {
    const username = String(req.body.username || 'guest').slice(0, 32);
    const payload = Buffer.from(JSON.stringify({ username, theme: 'dark', lang: 'uk' })).toString('base64url');
    const cookie = payload + '.' + sign(payload);
    res.setHeader('Set-Cookie', `profile_secure=${cookie}; Path=/; HttpOnly; SameSite=Strict`);
    res.json({ success: true, cookie });
});

app.get('/api/profile-secure', (req, res) => {
    const raw = getCookie(req, 'profile_secure');
    if (!raw || !raw.includes('.')) return res.status(401).json({ error: 'Немає cookie profile_secure' });

    const [payload, sig] = raw.split('.');
    const expected = sign(payload);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.status(403).json({ error: 'Невалідний підпис cookie — дані підроблено' });
    }

    let profile;
    try {
        profile = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'Bad JSON' });
    }
    if (typeof profile.username !== 'string' || !['dark', 'light'].includes(profile.theme)) {
        return res.status(400).json({ error: 'Схема не відповідає' });
    }
    res.json({ secure: true, greeting: `Привіт, ${profile.username}!`, profile });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X08: Insecure Deserialization Lab — OWASP A08:2025 / A08:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Вразливо : cookie profile        → node-serialize.unserialize()');
    console.log('Безпечно : cookie profile_secure → HMAC + JSON.parse + схема');
    console.log('');
    console.log('Пейлоад (до base64):');
    console.log(`  {"username":"_$$ND_FUNC$$_function(){return require('child_process').execSync('whoami').toString()}()"}`);
    console.log('============================================================');
});
