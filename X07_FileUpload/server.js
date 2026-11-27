const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3017;
const HOST = '127.0.0.1';

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');           // ВРАЗЛИВО: всередині static-директорії
const SAFE_DIR = path.join(__dirname, 'storage');               // БЕЗПЕЧНО: поза webroot
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SAFE_DIR, { recursive: true });

// Файл приходить «сирим» тілом запиту, ім’я — у заголовку X-File-Name
const rawBody = express.raw({ type: () => true, limit: '5mb' });

// ============================================================
// ВРАЗЛИВО:
//  - ім’я файлу від клієнта без санітизації (../ → перезапис файлів поза uploads/)
//  - немає перевірки типу/розширення (.html, .svg, .js — усе приймається)
//  - файл одразу доступний з того ж origin → Stored XSS
// ============================================================
app.post('/upload', rawBody, (req, res) => {
    const name = decodeURIComponent(req.headers['x-file-name'] || 'file.bin');
    const dest = path.join(UPLOAD_DIR, name);

    console.log('[VULN] Записуємо:', dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, req.body);

    res.json({ vulnerable: true, savedTo: dest, url: '/uploads/' + name.replace(/\\/g, '/') });
});

// ============================================================
// БЕЗПЕЧНО:
//  - allowlist розширень + перевірка magic bytes (реальний вміст)
//  - випадкове ім’я файлу на сервері
//  - зберігання поза webroot, віддача з nosniff і Content-Disposition: attachment
// ============================================================
const ALLOWED = {
    png: { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
    jpg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
    gif: { mime: 'image/gif', magic: [0x47, 0x49, 0x46, 0x38] }
};

app.post('/upload-secure', rawBody, (req, res) => {
    const original = path.basename(decodeURIComponent(req.headers['x-file-name'] || ''));
    const ext = original.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
    const rule = ALLOWED[ext];

    if (!rule) return res.status(400).json({ error: 'Дозволені лише png, jpg, gif' });
    if (!req.body.length || !rule.magic.every((b, i) => req.body[i] === b)) {
        return res.status(400).json({ error: 'Вміст файлу не відповідає розширенню (magic bytes)' });
    }

    const id = crypto.randomUUID() + '.' + ext;
    fs.writeFileSync(path.join(SAFE_DIR, id), req.body);
    res.json({ secure: true, url: '/files/' + id });
});

app.get('/files/:id', (req, res) => {
    const id = path.basename(req.params.id);
    const file = path.join(SAFE_DIR, id);
    const rule = ALLOWED[id.split('.').pop()];
    if (!rule || !fs.existsSync(file)) return res.status(404).end();

    res.set({
        'Content-Type': rule.mime,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${id}"`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
    });
    res.sendFile(file);
});

app.get('/api/uploads', (req, res) => {
    res.json({ vulnerable: fs.readdirSync(UPLOAD_DIR), secure: fs.readdirSync(SAFE_DIR) });
});

// static ПІСЛЯ API — файли з uploads/ віддаються як звичайний контент сайту (у т.ч. .html!)
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X07: Unrestricted File Upload Lab — OWASP A06:2025 / A04:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Вразливо : POST /upload         (X-File-Name: <ім’я>)');
    console.log('Безпечно : POST /upload-secure');
    console.log('');
    console.log('Атаки:');
    console.log('   1. Завантажити evil.html з <script> → /uploads/evil.html (Stored XSS)');
    console.log('   2. Завантажити SVG з onload=alert(1)');
    console.log('   3. Ім’я ../index.html → дефейс головної сторінки');
    console.log('============================================================');
});
