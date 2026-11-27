const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3014;
const HOST = '127.0.0.1';

const FILES_DIR = path.join(__dirname, 'files');

app.use(express.static(path.join(__dirname, 'public')));

// Список публічних документів
app.get('/api/files', (req, res) => {
    res.json(fs.readdirSync(FILES_DIR));
});

// ============================================================
// ВРАЗЛИВО: ім’я файлу з query-параметра підставляється в шлях без перевірки
// ../ дозволяє вийти за межі директорії files/
// ============================================================
app.get('/download', (req, res) => {
    const file = req.query.file || '';
    const fullPath = path.join(FILES_DIR, file); // path.join НЕ захищає від ../

    console.log('[VULN] Читаємо:', fullPath);

    fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
            // Додатково: витік абсолютного шляху в помилці
            return res.status(404).json({ error: err.message });
        }
        res.type('text/plain').send(data);
    });
});

// ============================================================
// ВРАЗЛИВО (наївний фільтр): видаляємо "../" один раз — обходиться через "....//"
// ============================================================
app.get('/download-filtered', (req, res) => {
    const file = String(req.query.file || '').replace(/\.\.\//g, ''); // одноразова заміна
    const fullPath = path.join(FILES_DIR, file);

    console.log('[FILTERED] Читаємо:', fullPath);

    fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) return res.status(404).json({ error: 'File not found', after_filter: file });
        res.type('text/plain').send(data);
    });
});

// ============================================================
// БЕЗПЕЧНО: канонізація шляху + перевірка, що він усередині базової директорії
// ============================================================
app.get('/download-secure', (req, res) => {
    const file = String(req.query.file || '');

    // 1) Резолвимо абсолютний шлях
    const resolved = path.resolve(FILES_DIR, file);

    // 2) Перевіряємо, що результат лежить строго всередині FILES_DIR
    if (!resolved.startsWith(FILES_DIR + path.sep)) {
        console.log('[SECURE] Заблоковано спробу traversal:', file);
        return res.status(403).json({ error: 'Access denied' });
    }

    fs.readFile(resolved, 'utf8', (err, data) => {
        if (err) return res.status(404).json({ error: 'File not found' }); // без деталей
        res.type('text/plain').send(data);
    });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X04: Path Traversal Lab — OWASP A01:2025 / A01:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Вразливо         : /download?file=welcome.txt');
    console.log('Наївний фільтр   : /download-filtered?file=welcome.txt');
    console.log('Безпечно         : /download-secure?file=welcome.txt');
    console.log('');
    console.log('Приклади атак:');
    console.log('   /download?file=../secret/db-config.txt');
    console.log('   /download?file=../server.js');
    console.log('   /download?file=..%2F..%2F..%2F..%2FWindows%2Fwin.ini');
    console.log('   /download-filtered?file=....//secret/db-config.txt');
    console.log('============================================================');
});
