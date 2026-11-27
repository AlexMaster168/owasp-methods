const express = require('express');
const path = require('path');
const { exec, execFile } = require('child_process');

const app = express();
const PORT = 3012;
const HOST = '127.0.0.1';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const isWin = process.platform === 'win32';
const countFlag = isWin ? '-n' : '-c';

// Консоль Windows віддає вивід в OEM-кодуванні (CP866 для кириличних систем) — декодуємо коректно
const decoder = new TextDecoder(isWin ? 'ibm866' : 'utf-8');
const decode = buf => decoder.decode(buf);

// ============================================================
// ВРАЗЛИВО: користувацький ввід конкатенується в shell-команду
// ============================================================
app.post('/ping', (req, res) => {
    const host = req.body.host || '';

    // exec() запускає рядок через shell (cmd.exe / /bin/sh),
    // тому метасимволи ; & | && || ` $() інтерпретуються!
    const command = `ping ${countFlag} 1 ${host}`;
    console.log('[VULN] Виконується:', command);

    exec(command, { timeout: 10000, windowsHide: true, encoding: 'buffer' }, (err, stdout, stderr) => {
        res.json({
            vulnerable: true,
            command,
            output: decode(stdout) + decode(stderr),
            error: err ? err.message : null
        });
    });
});

// ============================================================
// БЕЗПЕЧНО: allowlist-валідація + execFile без shell
// ============================================================
const HOST_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

app.post('/ping-secure', (req, res) => {
    const host = String(req.body.host || '').trim();

    // 1) Allowlist: лише IPv4 або hostname
    if (!HOST_RE.test(host)) {
        return res.status(400).json({ secure: true, error: 'Невалідний хост. Дозволено тільки IPv4 або доменне ім’я.' });
    }

    // 2) execFile передає аргументи масивом, БЕЗ shell — метасимволи не працюють
    execFile('ping', [countFlag, '1', host], { timeout: 10000, windowsHide: true, encoding: 'buffer' }, (err, stdout, stderr) => {
        res.json({
            secure: true,
            command: ['ping', countFlag, '1', host],
            output: decode(stdout) + decode(stderr),
            error: err ? err.message : null
        });
    });
});

app.get('/api/info', (req, res) => {
    res.json({ platform: process.platform, separatorExamples: isWin ? ['&', '&&', '||', '|'] : [';', '&&', '||', '|', '$(...)', '`...`'] });
});

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X02: OS Command Injection Lab — OWASP A05:2025 / A03:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Вразливо  : POST /ping        { host }');
    console.log('Безпечно  : POST /ping-secure { host }');
    console.log('');
    console.log('Приклади атак:');
    if (isWin) {
        console.log('   127.0.0.1 & whoami');
        console.log('   127.0.0.1 && dir');
        console.log('   127.0.0.1 | type server.js');
    } else {
        console.log('   127.0.0.1; id');
        console.log('   127.0.0.1 && cat /etc/passwd');
        console.log('   127.0.0.1 | ls -la');
    }
    console.log('============================================================');
});
