document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const resultDiv = document.getElementById('result');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.className = 'success';
            resultDiv.textContent = 'Успішний вхід! Перенаправлення...';
            resultDiv.style.display = 'block';
            setTimeout(() => window.location.href = data.redirect, 1000);
        } else {
            resultDiv.className = 'error';
            resultDiv.textContent = '✗ ' + data.message;
            resultDiv.style.display = 'block';
        }
    } catch (error) {
        resultDiv.className = 'error';
        resultDiv.textContent = '✗ Помилка з\'єднання';
        resultDiv.style.display = 'block';
    }
});