async function fetchURL() {
    const url = document.getElementById('url').value;
    const loader = document.getElementById('loader');
    const result = document.getElementById('result');

    if (!url) {
        alert('Введи URL!');
        return;
    }

    loader.classList.add('active');
    result.style.display = 'none';

    try {
        const response = await fetch('/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();
        loader.classList.remove('active');

        if (data.success) {
            result.className = 'result-box success';
            result.innerHTML = `
                        <h3>Запит успішний!</h3>
                        <p><strong>URL:</strong> ${data.url}</p>
                        <p><strong>Статус:</strong> ${data.status}</p>
                        ${data.data.flag ? `<div class="flag">FLAG: ${data.data.flag}</div>` : ''}
                        <h4>Відповідь:</h4>
                        <pre>${JSON.stringify(data.data, null, 2)}</pre>
                    `;
        } else {
            result.className = 'result-box error';
            result.innerHTML = `
                        <h3>Помилка!</h3>
                        <p><strong>URL:</strong> ${data.url}</p>
                        <p><strong>Помилка:</strong> ${data.error}</p>
                    `;
        }
    } catch (error) {
        loader.classList.remove('active');
        result.className = 'result-box error';
        result.innerHTML = `
                    <h3>Помилка з'єднання</h3>
                    <p>${error.message}</p>
                `;
    }
}

function quickAttack(url) {
    document.getElementById('url').value = url;
    fetchURL();
}

// Enter для відправки
document.getElementById('url').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        fetchURL();
    }
});