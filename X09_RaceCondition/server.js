const express = require('express');
const path = require('path');

const app = express();
const PORT = 3019;
const HOST = '127.0.0.1';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Імітація затримки БД / платіжного шлюзу
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dbLatency = () => sleep(100 + Math.random() * 100);

let state;
function reset() {
    state = {
        balance: 100,
        coupons: { BONUS50: { amount: 50, used: false } },
        log: []
    };
}
reset();

const log = msg => { state.log.push(`${new Date().toISOString().slice(11, 23)}  ${msg}`); };

// ============================================================
// ВРАЗЛИВО: check → await (вікно гонки) → act   (TOCTOU)
// ============================================================

// Одноразовий купон
app.post('/redeem', async (req, res) => {
    const code = req.body.code;
    const coupon = state.coupons[code];

    // CHECK
    if (!coupon || coupon.used) return res.status(400).json({ error: 'Купон недійсний або вже використаний' });

    await dbLatency(); // ← поки ми «ходимо в БД», паралельні запити теж пройшли перевірку

    // ACT
    coupon.used = true;
    state.balance += coupon.amount;
    log(`[VULN] Купон ${code} застосовано, баланс = ${state.balance}`);
    res.json({ success: true, balance: state.balance });
});

// Зняття коштів
app.post('/withdraw', async (req, res) => {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Bad amount' });

    // CHECK
    if (state.balance < amount) return res.status(400).json({ error: 'Недостатньо коштів' });

    await dbLatency();

    // ACT
    state.balance -= amount;
    log(`[VULN] Знято ${amount}, баланс = ${state.balance}`);
    res.json({ success: true, balance: state.balance });
});

// ============================================================
// БЕЗПЕЧНО: атомарна операція «перевірити-і-змінити» під м’ютексом
// (у реальній БД: UPDATE ... WHERE used = false / SELECT ... FOR UPDATE / транзакція)
// ============================================================
class Mutex {
    constructor() { this.tail = Promise.resolve(); }
    run(fn) {
        const result = this.tail.then(fn);
        this.tail = result.catch(() => {});
        return result;
    }
}
const accountLock = new Mutex();

app.post('/redeem-secure', (req, res) => {
    accountLock.run(async () => {
        const coupon = state.coupons[req.body.code];
        if (!coupon || coupon.used) return res.status(400).json({ error: 'Купон недійсний або вже використаний' });
        coupon.used = true; // резервуємо ДО будь-якого await
        await dbLatency();
        state.balance += coupon.amount;
        log(`[SECURE] Купон застосовано, баланс = ${state.balance}`);
        res.json({ success: true, balance: state.balance });
    });
});

app.post('/withdraw-secure', (req, res) => {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Bad amount' });
    accountLock.run(async () => {
        if (state.balance < amount) return res.status(400).json({ error: 'Недостатньо коштів' });
        await dbLatency();
        state.balance -= amount;
        log(`[SECURE] Знято ${amount}, баланс = ${state.balance}`);
        res.json({ success: true, balance: state.balance });
    });
});

app.get('/api/state', (req, res) => res.json(state));
app.post('/api/reset', (req, res) => { reset(); res.json(state); });

app.listen(PORT, HOST, () => {
    console.log('============================================================');
    console.log('X09: Race Condition Lab — OWASP A06:2025 / A04:2021');
    console.log('============================================================');
    console.log(`URL: http://${HOST}:${PORT}`);
    console.log('');
    console.log('Стартовий баланс: 100, купон BONUS50 (одноразовий, +50)');
    console.log('Вразливо : POST /redeem, /withdraw');
    console.log('Безпечно : POST /redeem-secure, /withdraw-secure');
    console.log('Атака    : 20 паралельних запитів → node attack.js');
    console.log('============================================================');
});
