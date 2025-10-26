# 🔐 OWASP A07: Identification and Authentication Failures

> **Лабораторна робота** з демонстрацією вразливості аутентифікації та ідентифікації (OWASP Top 10 2021)

## 📋 Опис

Цей проєкт демонструє небезпечну вразливість **Insecure Direct Object Reference (IDOR)** на рівні сесії, де користувач може змінити свою роль з `user` на `admin` через маніпуляцію даними форми.

**Увага:** Це навмисно вразливий додаток для освітніх цілей. **НЕ використовуйте цей код у production!**

## 🎯 Мета лабораторної роботи

Зрозуміти, як відбувається атака на систему аутентифікації через:
- Прийняття критичних параметрів (роль користувача) з клієнтської сторони
- Відсутність валідації та авторизації на сервері
- Небезпечне зберігання паролів у відкритому вигляді

## 🚀 Встановлення та запуск

### Вимоги
- Node.js >= 14.x
- npm >= 6.x

### Крок 1: Клонування та встановлення залежностей

```bash
git clone <repository-url>
cd owasp-a07-ident-auth-failures
npm install
```

### Крок 2: Запуск сервера

```bash
npm start
```

Або для режиму розробки з автоматичним перезапуском:

```bash
npm run dev
```

Сервер запуститься на `http://localhost:3007`

## 👥 Тестові користувачі

| Ім'я користувача | Пароль | Роль |
|------------------|---------|------|
| alice | alice123 | user |
| bob | bobpass | admin |
| charlie | charlie123 | user |

## 🧪 Сценарій експлуатації вразливості

### Крок 1: Авторизація
1. Відкрийте `http://localhost:3007/login`
2. Увійдіть як `alice` з паролем `alice123`
3. Ви потрапите на сторінку профілю з роллю `user`

### Крок 2: Експлуатація IDOR
1. Відкрийте DevTools (F12) → вкладка **Network**
2. На сторінці профілю змініть email та виберіть роль `Admin`
3. Натисніть "Оновити профіль"
4. У Network знайдіть запит `POST /profile/update`
5. Перевірте відповідь сервера — ви отримаєте `{"success": true}`

### Крок 3: Перевірка атаки
1. Перезавантажте сторінку профілю
2. Тепер ваша роль показується як `admin`
3. **Ви успішно підвищили свої привілеї!** 🎉

## 🐛 Вразливості в коді

### 1. Plaintext паролі в базі даних
```javascript
// database.js
password: 'alice123'  // ❌ Паролі зберігаються у відкритому вигляді
```

### 2. Прийняття ролі з клієнта
```javascript
// server.js - POST /profile/update
const { email, role } = req.body;  // ❌ Роль приходить від користувача!
db.run('UPDATE users SET email = ?, role = ? WHERE id = ?', [email, role, ...]);
```

### 3. Відсутність перевірки дозволів
```javascript
// ❌ Немає перевірки: чи має право користувач змінювати роль?
req.session.user.role = role;
```

## ✅ Як виправити вразливості

### 1. Хешування паролів
```javascript
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);
```

### 2. Видалити можливість зміни ролі
```javascript
// server.js
app.post('/profile/update', (req, res) => {
    const { email } = req.body;  // ✅ Роль не приймається!
    
    db.run('UPDATE users SET email = ? WHERE id = ?', 
        [email, req.session.user.id]);
});
```

### 3. Додати перевірку дозволів
```javascript
// Тільки admin може змінювати ролі
if (role && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
}
```

### 4. Використовувати RBAC (Role-Based Access Control)
```javascript
function requireRole(role) {
    return (req, res, next) => {
        if (req.session.user?.role !== role) {
            return res.status(403).send('Access denied');
        }
        next();
    };
}

app.get('/admin', requireRole('admin'), (req, res) => {
    // Тільки для адміністраторів
});
```

## 📚 Корисні посилання

- [OWASP Top 10 2021 - A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [OWASP IDOR](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## 📝 Структура проєкту

```
owasp-a07-ident-auth-failures/
├── server.js              # Головний файл сервера
├── database.js            # Ініціалізація SQLite бази
├── package.json           # Залежності проєкту
├── users.db              # SQLite база даних (створюється автоматично)
└── public/
    ├── login.html        # Сторінка логіну
    ├── profile.html      # Вразливий профіль користувача
    └── style.css         # Стилі інтерфейсу
```