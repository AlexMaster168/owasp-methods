function setAttack(value) {
    document.getElementById('searchVulnerable').value = value;
    document.getElementById('searchSecure').value = value;
}

async function searchVulnerable() {
    const searchTerm = document.getElementById('searchVulnerable').value;
    const resultDiv = document.getElementById('resultVulnerable');

    resultDiv.innerHTML = '<p style="color: #666;">Виконується запит...</p>';

    try {
        const response = await fetch('/search-vulnerable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm })
        });

        const data = await response.json();

        let html = '<div style="color: #dc3545; font-weight: bold; margin-bottom: 10px;">Вразливий запит</div>';
        html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';

        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = '<p style="color: red;">Помилка: ' + error.message + '</p>';
    }
}

async function searchSecure() {
    const searchTerm = document.getElementById('searchSecure').value;
    const resultDiv = document.getElementById('resultSecure');

    resultDiv.innerHTML = '<p style="color: #666;">Виконується запит...</p>';

    try {
        const response = await fetch('/search-secure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm })
        });

        const data = await response.json();

        let html = '<div style="color: #28a745; font-weight: bold; margin-bottom: 10px;">Безпечний запит</div>';
        html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';

        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = '<p style="color: red;">Помилка: ' + error.message + '</p>';
    }
}

window.onload = () => {
    searchVulnerable();
    searchSecure();
};
