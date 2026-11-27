[🏠 Головна](../README.md) · [⬅ X05 CSRF](../X05_CSRF/README.md) · [X07 File Upload ➡](../X07_FileUpload/README.md)

# ↪️ X06: Open Redirect

> **OWASP A01:2025 — Broken Access Control** · порти **3016** (сайт) та **4016** (фішинг) · CWE-601

![Інтерфейс лабораторної X06](screenshots/overview.png)

## 📋 Зміст

- [Мета](#-мета)
- [Запуск](#-запуск)
- [Вразливості](#-вразливості)
- [Експлуатація](#-експлуатація)
- [Виправлення](#-виправлення)
- [Завдання](#-завдання)
- [Джерела](#-джерела)

---

## 🎯 Мета

Зрозуміти, як параметр перенаправлення (`?url=`, `?next=`, `?returnTo=`) перетворює довірений домен на трамплін для фішингу, і чому перевірки «починається з `/`» чи «містить наш домен» не працюють.

## 🚀 Запуск

```bash
cd X06_OpenRedirect
npm install
npm start
```

| Сервіс | URL |
|---|---|
| Довірений сайт | http://127.0.0.1:3016 |
| Фішинговий клон логіну | http://127.0.0.1:4016 |

## 🚫 Вразливості

| Ендпоінт | Перевірка | Обхід |
|---|---|---|
| `GET /go?url=` | немає | будь-яка адреса |
| `GET /go-startswith?url=` | `url.startsWith('/')` | `//127.0.0.1:4016`, `/\127.0.0.1:4016` |
| `GET /go-includes?url=` | `url.includes('127.0.0.1:3016')` | `http://127.0.0.1:4016/?127.0.0.1:3016`, `http://127.0.0.1:3016@127.0.0.1:4016` |
| `POST /login` (`next`) | немає | редірект після логіну на фішинг |
| `GET /go-secure`, `POST /login-secure` | 🟢 `new URL()` + порівняння origin | — |

## 💣 Експлуатація

Атакувальник розсилає посилання, яке **виглядає довіреним**:

```
http://127.0.0.1:3016/go?url=http://127.0.0.1:4016
```

Жертва бачить знайомий домен, клікає й опиняється на копії сторінки входу, а введені дані атакувальник отримує (`POST /steal`, видно в консолі сервера).

```bash
curl -I "http://127.0.0.1:3016/go-startswith?url=//127.0.0.1:4016"
# Location: //127.0.0.1:4016   ← protocol-relative URL = зовнішній сайт

curl -I "http://127.0.0.1:3016/go-includes?url=http://127.0.0.1:3016@127.0.0.1:4016"
# 127.0.0.1:3016 тут — це userinfo, а хост — 127.0.0.1:4016
```

> Обхід `/\host` працює **у браузері**: за стандартом WHATWG URL `\` у http(s)-URL трактується як `/`. curl так не робить.

Open Redirect також часто підсилює інші атаки: крадіжку OAuth-кодів через `redirect_uri` і обхід allowlist у SSRF ([A10](../A10_SSRF/README.md)).

## ✅ Виправлення

```javascript
const SELF_ORIGIN = 'http://127.0.0.1:3016';

function safeTarget(raw) {
    try {
        const target = new URL(String(raw || '/'), SELF_ORIGIN);  // парсимо як браузер
        if (target.origin !== SELF_ORIGIN) return null;            // лише власний origin
        return target.pathname + target.search + target.hash;
    } catch {
        return null;
    }
}
```

Альтернативи: allowlist адрес або **ID-мапа** (`?to=dashboard` → `/dashboard`), сторінка-попередження «Ви залишаєте сайт» для зовнішніх посилань.

## 🧪 Завдання

1. Обійди кожен з трьох вразливих ендпоінтів.
2. Склади фішингове посилання через `POST /login` з `next`.
3. Перевір, що `/go-secure` пропускає `/dashboard`, але блокує всі твої обходи.

## 📚 Джерела

- [OWASP Top 10:2025 — A01 Broken Access Control](https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/)
- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)

---

[⬆ До змісту](#-зміст) · [🏠 Головна](../README.md)
