# 🔒 A03: SQL Injection - OWASP Top 10 Lab

Лабораторна робота для вивчення вразливості SQL Injection з порівнянням вразливого та безпечного коду.

## 📋 Зміст

- [Встановлення](#встановлення)
- [Запуск](#запуск)
- [Завдання](#завдання)
- [Приклади атак](#приклади-атак)
- [Як це працює](#як-це-працює)
- [Захист](#захист)

## 🚀 Встановлення

```bash
npm install
```

## ▶️ Запуск

```bash
npm start
```

Або для розробки з auto-reload:

```bash
npm run dev
```

Відкрийте браузер: **http://localhost:3003**

## 📝 Завдання

### Завдання 1: Базове тестування
1. Введіть `alice` в обидва поля
2. Порівняйте результати
3. Подивіться на згенеровані SQL-запити

### Завдання 2: SQL Injection атака
1. У вразливому варіанті введіть: `' OR '1'='1`
2. Що відбувається? Скільки користувачів ви бачите?
3. Спробуйте те ж саме в безпечному варіанті

### Завдання 3: UNION атака
1. Спробуйте: `' UNION SELECT id, username, email, role FROM users --`
2. Чи можете ви отримати структуру таблиці?
3. Що станеться в безпечному варіанті?

### Завдання 4: Витяг секретних даних
1. Спробуйте: `' UNION SELECT id, secret_data, 'hacked', 'hacked' FROM secrets --`
2. Чи можете ви отримати API ключі та паролі?

### Завдання 5: Обхід аутентифікації
1. Спробуйте: `admin' --`
2. Чи знайдете ви адміністратора?

## 💉 Приклади атак

### 1. Базова ін'єкція
```sql
' OR '1'='1
```
**Що відбувається:**
```sql
SELECT * FROM users WHERE username LIKE '%' OR '1'='1%'
```
Умова завжди TRUE → повертає всіх користувачів

### 2. З коментарем
```sql
' OR '1'='1' --
```
**Що відбувається:**
```sql
SELECT * FROM users WHERE username LIKE '%' OR '1'='1' --%'
```
Все після `--` ігнорується → обхід решти запиту

### 3. UNION атака
```sql
' UNION SELECT id, username, email, role FROM users --
```
**Що відбувається:**
```sql
SELECT * FROM users WHERE username LIKE '%' UNION SELECT id, username, email, role FROM users --%'
```
Об'єднує результати двох запитів

### 4. Витяг з іншої таблиці
```sql
' UNION SELECT id, secret_data, 'hacked', 'hacked' FROM secrets --
```
**Результат:** Отримуєте API ключі, паролі, конфіденційні дані

### 5. Спроба видалення таблиці
```sql
'; DROP TABLE users; --
```
**Примітка:** В SQLite з Node.js це не працює через обмеження на множинні запити, але в інших БД це може спрацювати!

## 🔍 Як це працює

### ❌ Вразливий код
```javascript
const searchTerm = req.body.searchTerm;
const query = `SELECT * FROM users WHERE username LIKE '%${searchTerm}%'`;
db.all(query, callback);
```

**Проблема:** Пряма конкатенація рядків → атакувач може змінити логіку SQL-запиту

### ✅ Безпечний код
```javascript
const searchTerm = req.body.searchTerm;
const query = `SELECT * FROM users WHERE username LIKE ?`;
const params = [`%${searchTerm}%`];
db.all(query, params, callback);
```

**Рішення:** Параметризований запит → введення розглядається як дані, а не як SQL-код

## 🛡️ Захист від SQL Injection

### 1. Параметризовані запити (Prepared Statements) ✅
```javascript
// SQLite
db.all('SELECT * FROM users WHERE username = ?', [username], callback);

// MySQL
connection.query('SELECT * FROM users WHERE username = ?', [username], callback);

// PostgreSQL
client.query('SELECT * FROM users WHERE username = $1', [username], callback);
```

### 2. ORM (Sequelize, TypeORM, Prisma) ✅
```javascript
// Sequelize
User.findAll({ where: { username: searchTerm } });

// Prisma
prisma.user.findMany({ where: { username: searchTerm } });
```

### 3. Валідація вхідних даних ✅
```javascript
const validator = require('validator');

if (!validator.isAlphanumeric(username)) {
    return res.status(400).json({ error: 'Invalid input' });
}
```

### 4. Whitelist підхід ✅
```javascript
const allowedChars = /^[a-zA-Z0-9_-]+$/;
if (!allowedChars.test(searchTerm)) {
    return res.status(400).json({ error: 'Invalid characters' });
}
```

### 5. Принцип найменших привілеїв ✅
- Створюйте окремого користувача БД для додатку
- Надавайте тільки необхідні права (SELECT, INSERT)
- НЕ надавайте DROP, CREATE, ALTER

### 6. Escape-символи (менш надійно) ⚠️
```javascript
const mysql = require('mysql');
const escaped = mysql.escape(userInput);
```

## 🎯 Реальні наслідки SQL Injection

### Що може зробити атакувач:
- 🔓 Обхід аутентифікації (логін без пароля)
- 📊 Витяг всіх даних з БД (паролі, email, особиста інформація)
- 🗑️ Видалення даних або таблиць
- ✏️ Зміна даних (підвищення прав, зміна балансів)
- 💻 Виконання команд на сервері (в деяких СУБД)
- 🚪 Бек-дор для постійного доступу

### Відомі інциденти:
- **2017**: Equifax - 147 млн записів витекло через SQLi
- **2014**: Yahoo - 500 млн акаунтів скомпрометовано
- **2012**: LinkedIn - 6.5 млн паролів викрадено

## 📚 Додаткові матеріали

- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
