// НАВЧАЛЬНИЙ «шкідливий» postinstall-скрипт.
// Справжній шкідливий пакет тут би викрав ~/.npmrc, ~/.ssh, токени CI тощо.
// Цей — лише залишає файл-маркер у корені проєкту, щоб показати: код виконався під час `npm install`.
const fs = require('fs');
const path = require('path');

const root = process.env.INIT_CWD || process.cwd();
const marker = path.join(root, 'PWNED_BY_POSTINSTALL.txt');

fs.writeFileSync(marker, [
    'Цей файл створив postinstall-скрипт пакета "lodahs" під час npm install.',
    `Час: ${new Date().toISOString()}`,
    `Користувач ОС: ${require('os').userInfo().username}`,
    `Кількість змінних оточення, які можна було б викрасти: ${Object.keys(process.env).length}`,
    '',
    'Захист: npm install --ignore-scripts, npm config set ignore-scripts true, перевірка назв пакетів.'
].join('\n'));

console.log('\n[lodahs] 😈 postinstall виконано → ' + marker + '\n');
