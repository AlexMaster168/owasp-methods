async function register() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    document.getElementById('regResult').innerHTML = `
                <div class="${data.success ? 'success' : 'error'}">
                    ${data.message}
                </div>
            `;
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    let html = `<div class="${data.success ? 'success' : 'error'}">`;
    html += `<strong>${data.message}</strong>`;
    if (data.success) {
        html += `<br><br><strong>Session ID:</strong> ${data.sessionId}`;
        html += `<br><strong>Користувач:</strong> ${data.user.username}`;
        html += `<br><strong>Роль:</strong> ${data.user.role}`;
    }
    html += `</div>`;

    document.getElementById('loginResult').innerHTML = html;
}

async function forgotPassword() {
    const email = document.getElementById('forgotEmail').value;

    const res = await fetch('/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const data = await res.json();

    let html = `<div class="${data.success ? 'info' : 'error'}">`;
    html += `<strong>${data.message}</strong>`;
    if (data.debug) {
        html += `<br><br><strong>Debug Info:</strong>`;
        html += `<br><strong>Token:</strong> <code>${data.debug.token}</code>`;
        html += `<br><strong>Username:</strong> ${data.debug.username}`;
        html += `<br><br><a href="/reset?token=${data.debug.token}" target="_blank">
                    <button>Перейти до скидання пароля</button></a>`;
    }
    html += `</div>`;

    document.getElementById('forgotResult').innerHTML = html;
}

async function bruteforceToken() {
    const email = document.getElementById('bruteEmail').value;
    const username = document.getElementById('bruteUsername').value;

    const res = await fetch('/api/bruteforce-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username })
    });
    const data = await res.json();

    let html = `<div class="${data.found ? 'success' : 'warning'}">`;
    html += `<strong>${data.message}</strong>`;
    html += `<br><br><strong>Згенерований токен:</strong><br><code>${data.token}</code>`;
    if (data.found) {
        html += `<br><br><a href="/reset?token=${data.token}" target="_blank">
                    <button>Використати токен</button></a>`;
    }
    html += `</div>`;

    document.getElementById('bruteResult').innerHTML = html;
}

async function getProfile() {
    const userId = document.getElementById('profileId').value;

    const res = await fetch(`/profile/${userId}`);
    const data = await res.json();

    let html = `<div class="${data.success ? 'success' : 'error'}">`;
    if (data.success) {
        html += `<strong>Профіль користувача:</strong>`;
        html += `<br><strong>Username:</strong> ${data.user.username}`;
        html += `<br><strong>Email:</strong> ${data.user.email}`;
        html += `<br><strong>Role:</strong> ${data.user.role}`;
    } else {
        html += data.message;
    }
    html += `</div>`;

    document.getElementById('profileResult').innerHTML = html;
}

async function getUsers() {
    const res = await fetch('/api/users');
    const data = await res.json();

    if (data.success) {
        let html = '<div class="warning"><strong>Всі користувачі бази даних:</strong>';
        html += '<table class="table"><tr><th>ID</th><th>Username</th><th>Email</th><th>Password</th><th>Role</th></tr>';
        data.users.forEach(user => {
            html += `<tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td><code>${user.password}</code></td>
                        <td>${user.role}</td>
                    </tr>`;
        });
        html += '</table></div>';
        document.getElementById('usersResult').innerHTML = html;
    }
}

async function getTokens() {
    const res = await fetch('/api/tokens');
    const data = await res.json();

    if (data.success) {
        let html = '<div class="info"><strong> Всі токени скидання:</strong>';
        html += '<table class="table"><tr><th>User ID</th><th>Token</th><th>Expires</th><th>Used</th></tr>';
        data.tokens.forEach(token => {
            const expired = Date.now() > token.expires_at;
            html += `<tr>
                        <td>${token.user_id}</td>
                        <td><code>${token.token.substr(0, 20)}...</code></td>
                        <td>${expired ? ' Прострочений' : ' Дійсний'}</td>
                        <td>${token.used ? ' Використаний' : ' Не використаний'}</td>
                    </tr>`;
        });
        html += '</table></div>';
        document.getElementById('usersResult').innerHTML = html;
    }
}