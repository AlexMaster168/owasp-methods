import requests
import time

TARGET_URL = "http://localhost:3005/forgot"
EMAIL = "bob@example.com"
TOTAL_REQUESTS = 100
DELAY = 0.1

print(f"Запуск атаки на {TARGET_URL}")
print(f"Відправляємо {TOTAL_REQUESTS} запитів з email: {EMAIL}\n")

success_count = 0
failed_count = 0

for i in range(1, TOTAL_REQUESTS + 1):
    try:
        response = requests.post(TARGET_URL, data={'email': EMAIL}, timeout=5)
        
        if response.status_code == 200:
            success_count += 1
            status = "Успішно"
        else:
            failed_count += 1
            status = f"Код {response.status_code}"
            
        print(f"[{i}/{TOTAL_REQUESTS}] {status} — {response.reason}")
        
    except requests.exceptions.RequestException as e:  # ← Це ПРАВИЛЬНО!
        failed_count += 1
        print(f"[{i}/{TOTAL_REQUESTS}] ❌ Помилка з'єднання: {e}")
    
    time.sleep(DELAY)

print("\n" + "="*50)
print(f"РЕЗУЛЬТАТ:")
print(f"   Успішних запитів: {success_count}")
print(f"   Неуспішних запитів: {failed_count}")
print("="*50)

if success_count == TOTAL_REQUESTS:
    print("\n ВИСНОВОК: Сервер НЕ має rate-limiting — це A05: Security Misconfiguration!")
else:
    print("\n ВИСНОВОК: Сервер блокує запити — вразливість усунена!")