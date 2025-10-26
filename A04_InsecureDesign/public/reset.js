// Отримуємо токен з URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

document.getElementById('tokenInput').value = token;
document.getElementById('displayToken').textContent = token ?
    token.substr(0, 40) + '...' : 'Токен не знайдено';

document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const resultDiv = document.getElementById('result');

    // Клієнтська валідація
    if (newPassword !== confirmPassword) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Паролі не співпадають!';
        return;
    }

    if (newPassword.length < 3) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Пароль занадто короткий (мін. 3 символи)';
        return;
    }

    try {
        const res = await fetch('/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        if (data.success) {
            resultDiv.className = 'result success';
            let html = `<strong> ${data.message}</strong><br><br>`;

            if (data.vulnerabilities) {
                html += '<strong> Виявлені проблеми безпеки:</strong><ul style="margin-top: 10px;">';
                if (data.vulnerabilities.tokenReused) {
                    html += '<li>Токен не було позначено як використаний</li>';
                }
                if (data.vulnerabilities.tokenExpired) {
                    html += '<li>Токен прострочений, але все одно працює</li>';
                }
                if (data.vulnerabilities.stillValid) {
                    html += '<li>Токен залишається дійсним для повторного використання</li>';
                }
                html += '</ul>';
            }

            html += '<br><strong> Експеримент:</strong><br>';
            html += 'Спробуйте використати цей токен ще раз!';

            resultDiv.innerHTML = html;
        } else {
            resultDiv.className = 'result error';
            resultDiv.textContent = ` ${data.message}`;
        }
    } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Помилка з\'єднання з сервером';
    }
});

// Показати/приховати пароль
document.getElementById('newPassword').addEventListener('dblclick', function() {
    this.type = this.type === 'password' ? 'text' : 'password';
});
document.getElementById('confirmPassword').addEventListener('dblclick', function() {
    this.type = this.type === 'password' ? 'text' : 'password';
});