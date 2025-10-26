# 🔐 A01: Broken Access Control — Node.js Лабораторна робота

## 🎯 Мета
Навчитися виявляти, експлуатувати та виправляти **порушення контролю доступу (IDOR)** у веб-додатках на Node.js.


## 🚫 Вразливість (Умисно вставлена)

У додатку немає перевірки, **чи поточний користувач має право** доступу до ресурсу, який запитується.  
Доступ до `/profile/:id` та `/profile/:id/update` відбувається **тільки за ID**, без перевірки автентифікації чи авторизації.

### Приклад атаки:
1. Ви — користувач `alice` (ID=1).
2. Ви вводите `id=2` у форму — отримуєте профіль `bob`, який є **адміністратором**.
3. Ви змінюєте його email через POST-запит — і **успішно змінюєте дані адміна!**

Це — IDOR (Insecure Direct Object Reference) — одна з найпоширеніших вразливостей.

---

## 🔍 Як виявити?

- Використовуйте Burp Suite або DevTools (Network tab).
- Змінюйте `id` у URL:  
  `http://localhost:3001/profile/1` → `http://localhost:3001/profile/2` → `http://localhost:3001/profile/3`
- Перевірте, чи відповідає сервер змінами на POST-запити з іншими ID.
- **Питання:** Чи може звичайний користувач змінити профіль адміна? **Так — це вразливість!**

---

## ✅ Як виправити?

**ПРАВИЛЬНИЙ ПІДХІД:**  
**Завжди перевіряйте, чи запитувач має право доступу до цього об’єкта.**

### Виправлення (`server.js`):

```javascript
// ДОДАЙТЕ ЦЕ ПЕРЕД КОЖНИМ ЗАПИТОМ ДО profile/:id
const authenticateUser = (req, res, next) => {
  // У реальному додатку — це буде middleware з jwt.verify() або сесією
  // Тут — імітація: вважаємо, що користувач "alice" з ID=1 авторизований
  req.user = { id: 1 }; // ← Це має приходити з сесії/токена!
  next();
};

// Використовуйте middleware перед роутами:
app.get('/profile/:id', authenticateUser, (req, res) => {
  const userId = parseInt(req.params.id);
  // КЛЮЧОВА ПЕРЕВІРКА: чи має поточний користувач доступ до цього ID?
  if (req.user.id !== userId) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied: You do not have permission to view this profile.' 
    });
  }
  const user = users.find(u => u.id === userId);
  res.json({ success: true,  user });
});

// Аналогічно для update:
app.post('/profile/:id/update', authenticateUser, (req, res) => {
  const userId = parseInt(req.params.id);
  if (req.user.id !== userId) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied: You cannot modify another user.' 
    });
  }
  // ... інша логіка
});