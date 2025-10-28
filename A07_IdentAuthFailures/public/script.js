fetch('/api/user')
    .then(res => res.json())
    .then(data => {
        document.getElementById('userRole').textContent = data.role;
        document.getElementById('username').textContent = data.username;
        document.getElementById('email').value = data.email;
    });

document.getElementById('updateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const role = document.getElementById('role').value;

    const response = await fetch('/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, role })
    });

    const result = await response.json();
    document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';

    if (result.success) {
        document.getElementById('userRole').textContent = role;
    }
});