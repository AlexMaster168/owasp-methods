const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = 3002;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Користувачі
const users = [
    { id: 1, username: 'alice', role: 'user', password: 'password123' },
    { id: 2, username: 'bob', role: 'admin', password: 'adminpass' }
];

// Логін - генерує JWT
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'weak_secret_123',
            { algorithm: 'HS256', expiresIn: '1h' }
        );

        res.json({
            success: true,
            message: 'Login successful!',
            token: token
        });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

// Вразлива функція перевірки JWT - дозволяє алгоритм "none"
function verifyTokenVulnerable(token, secret) {
    try {
        // Парсимо токен вручну
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        // Декодуємо header і payload
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        console.log('Parsed token:');
        console.log('  Header:', header);
        console.log('  Payload:', payload);
        console.log('  Algorithm:', header.alg);

        // Вразливість: Якщо алгоритм "none", не перевіряємо підпис
        if (header.alg === 'none') {
            console.log('Algorithm is "none" - skipping signature verification');
            return payload;
        }

        // Для інших алгоритмів використовуємо стандартну перевірку
        return jwt.verify(token, secret);
    } catch (err) {
        console.error('Token verification failed:', err.message);
        throw err;
    }
}

// Профіль з вразливою перевіркою
app.get('/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token required' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = verifyTokenVulnerable(token, process.env.JWT_SECRET || 'weak_secret_123');

        res.json({
            success: true,
            message: 'Token verified successfully',
            user: {
                id: decoded.userId,
                username: decoded.username,
                role: decoded.role
            }
        });
    } catch (err) {
        res.status(403).json({
            success: false,
            error: 'Invalid or expired token',
            details: err.message
        });
    }
});

// Адмін-панель з тією ж вразливістю
app.get('/admin', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token required' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = verifyTokenVulnerable(token, process.env.JWT_SECRET || 'weak_secret_123');

        console.log('Admin access attempt:');
        console.log('  Username:', decoded.username);
        console.log('  Role:', decoded.role);

        if (decoded.role === 'admin') {
            console.log('Admin access granted');
            res.json({
                success: true,
                message: 'Вітаємо! Ви отримали доступ до адмін-панелі!',
                flag: 'OWASP{JWT_N0N3_4LG0R1THM_BYP4SS_SUCCESS}',
                adminData: {
                    message: 'Секретна інформація адміністратора',
                    users: users.map(u => ({ id: u.id, username: u.username, role: u.role })),
                    dbConnection: 'mongodb://admin:password@localhost:27017',
                    apiKeys: ['sk_live_51234567890abcdef']
                }
            });
        } else {
            console.log('Admin access denied - role is:', decoded.role);
            res.status(403).json({
                error: 'Admin access required',
                yourRole: decoded.role,
                requiredRole: 'admin'
            });
        }
    } catch (err) {
        console.error('Token verification failed:', err.message);
        res.status(403).json({
            success: false,
            error: 'Invalid token',
            details: err.message
        });
    }
});

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('A02: Cryptographic Failures Lab');
    console.log('='.repeat(60));
    console.log('URL: http://localhost:' + PORT);
    console.log('Вразливість: JWT з алгоритмом "none" дозволений');
    console.log('Мета: змінити role на "admin" і отримати доступ');
    console.log('Credentials: alice/password123 або bob/adminpass');
    console.log('='.repeat(60) + '\n');
});
