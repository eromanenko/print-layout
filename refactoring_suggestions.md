# Пропозиції рефакторингу: cut-image (Image & PDF Slicer)

## Огляд проєкту

Три вкладки: **Grid Slicing**, **Card Extraction** (Freeform + Rect mode), **Descreen**.  
JS добре організований по підпапках: `js/grid/`, `js/cards/`, `js/descreen/`.  
CSS використовує Design Tokens (`:root`). Проєкт в цілому якісний — але є конкретні проблеми.

---

## 🔴 Баги / Критичні проблеми

### 1. Зламане кодування рядків у `renderer.js`

**Файл:** [js/cards/renderer.js](file:///c:/Projects/cut-image/js/cards/renderer.js#L220-L223)

```js
// Рядок 220 — зламаний текст замість "×" та "·":
const info = [
    `${state.rectWidth} Ãƒâ€" ${state.rectHeight} px`,   // повинно бути "×"
    state.rectSkew !== 0 ? `skew ${state.rectSkew} px` : null,
    card.angle !== 0 ? `${card.angle.toFixed(1)}\u00B0` : null,
].filter(Boolean).join('  Ã‚Â·  ');  // повинно бути "·"
```

**Причина:** файл збережений в UTF-8 але певний рядок потрапив як double-encoded latin1.  
**Виправлення:** замінити `Ãƒâ€"` → `×` (U+00D7) та `Ã‚Â·` → `·` (U+00B7).

Аналогічна проблема в коментарях (рядки 267, 327, 359-375) — там `Ã¢â€â‚¬` замість `──`.

---

### 2. `confirm()` для видалення картки — погана UX практика

**Файл:** [js/cards/events.js](file:///c:/Projects/cut-image/js/cards/events.js#L241-L258)

```js
if (!confirm("Are you sure you want to unselect this card?")) return;
```

- Текст "unselect" є хибним — насправді картка **видаляється** (delete).
- Блокуючий `confirm()` — браузерний діалог виглядає не нативно, не стилізований.
- Краще: невелике toast-попередження з кнопкою "Undo" або CSS-стилізований діалог.

---

## 🟡 Важливі (якість коду)

### 3. Дублювання логіки snap у `events.js`

**Файл:** [js/cards/events.js](file:///c:/Projects/cut-image/js/cards/events.js)

Функції `snapFreeformPosition` (L72-L131) та `snapRectPosition` (L164-L210) майже ідентичні — обидві:
- Будують масив `boxes` з bounding boxes
- Знаходять лівого/правого сусіда по X
- Знаходять сусідів по рядку по Y
- Повертають снапнуту позицію

**Рішення:** Витягти загальну логіку в одну функцію:
```js
function snapToGrid(cx, cy, boxes, cardH) { ... }
```

---

### 4. `events.js` — 1107 рядків, забагато обов'язків

Один файл містить: placement helpers, snap logic, auto-scroll, zoom drag, dimension sync, `bindEvents` (~300 рядків), freeform mouse handlers, rect mouse handlers, freeform keyboard handlers, rect keyboard handlers.

**Рекомендація:** розбити хоча б на:
- `events-freeform.js` — mouse/keyboard для freeform mode
- `events-rect.js` — mouse/keyboard для rect mode
- Залишити `events.js` тільки як `bindEvents` + shared utilities

---

### 5. Inline стилі в `index.html` — кілька місць

**Файл:** [index.html](file:///c:/Projects/cut-image/index.html)

```html
<!-- Рядок 88 -->
<input type="text" id="prefixInput" placeholder="Prefix (e.g. name-)" style="width: 150px;">

<!-- Рядок 125 -->
<input type="number" id="minSizeInput" value="10" style="width: 50px;">

<!-- Рядок 134 — display:none і margin-bottom через inline -->
<div class="controls" id="pdfControls" style="display: none; margin-bottom: 20px; align-items: center;">

<!-- Рядок 137 — використання CSS змінної через inline style -->
<span style="line-height: var(--control-height); font-weight: bold; width: 120px;">
```

`width: 50px` / `width: 60px` / `width: 80px` для числових інпутів повторюються **~12 разів** в HTML.  
Краще: додати CSS клас `.input-narrow { width: 55px; }` або задати через CSS атрибутний селектор.

---

### 6. Видимість елементів управляється через JS `style.display`

**Файли:** `js/descreen/events.js`, `js/cards/events.js`

```js
// Переключення між методами filter в descreen:
document.getElementById('dsBilateralControls').style.display = 'inline-flex';
document.getElementById('dsGaussianControls').style.display = 'none';
document.getElementById('dsMedianControls').style.display = 'none';
```

**Рішення:** Використати CSS + data-атрибути:
```css
#dsMethodControls [data-method] { display: none; }
#dsMethodControls [data-method].active { display: inline-flex; }
```

---

### 7. Дублювання `file-loader.js` між `grid/` і `cards/`

**Файли:**
- [js/grid/file-loader.js](file:///c:/Projects/cut-image/js/grid/file-loader.js) — 5980 байт
- [js/cards/file-loader.js](file:///c:/Projects/cut-image/js/cards/file-loader.js) — 5982 байт

Обидва файли майже однакового розміру і схожі за призначенням (завантаження image/PDF/TIFF). Варто виділити спільну логіку (декодування TIFF, рендеринг PDF сторінки, нормалізацію canvas) в `js/shared/file-loader-core.js`, а специфічну — залишити в кожному модулі.

---

### 8. `tabs.js` — використовує `onclick` в HTML замість JS listeners

**Файл:** [index.html](file:///c:/Projects/cut-image/index.html#L71-L73)

```html
<button class="tab-btn active" onclick="switchTab('grid')">Grid Slicing</button>
<button class="tab-btn" onclick="switchTab('cards')">Card Extraction</button>
<button class="tab-btn" onclick="switchTab('descreen')">Descreen [BETA]</button>
```

Функція `switchTab` — глобальна. Краще використовувати `data-tab="grid"` атрибут і приєднувати listeners в `tabs.js` замість `onclick=""`.

---

### 9. Magic numbers у `renderer.js`

```js
dom.ctx.font = "bold 30px Arial";  // рядок 85
dom.ctx.font = "bold 14px Arial";  // рядки 90, 215
dom.ctx.font = 'bold 28px Arial';  // рядок 205
dom.ctx.font = 'bold 11px Arial';  // рядок 408
```

5 різних розмірів шрифту для canvas renderng — не задокументовані, не константи. Варто:
```js
const FONT = { LABEL_LARGE: 'bold 30px Arial', LABEL: 'bold 14px Arial', ... };
```

---

## 🟢 Покращення та нові можливості

### 10. Undo/Redo для переміщення карток

Зараз `state.hasUnsavedChanges` відстежує чи є зміни, але немає можливості відмінити переміщення кута/картки. `Ctrl+Z` ніяк не підключений. Варто додати простий стек History:
```js
const history = { past: [], future: [] };
function pushHistory() { history.past.push(deepClone(state)); history.future = []; }
function undo() { if (history.past.length) { state = history.past.pop(); redraw(); } }
```

---

### 11. localStorage для параметрів між сесіями

Зараз `coordsDatabase` зберігається в пам'яті — при перезавантаженні губиться. Координати вже можна зберегти/завантажити через INI-файл, але параметри налаштувань (DPI, prefix, min-size, pairing mode) не зберігаються між сесіями.

Легке покращення:
```js
// При зміні inputs — зберігати в localStorage
// При завантаженні сторінки — відновлювати
```

---

### 12. Відсутня підтримка Touch (мобільних пристроїв)

Canvas має `touch-action: none` в CSS, але обробники `touchstart` / `touchmove` / `touchend` відсутні. Додавання базової touch-підтримки (одним пальцем = drag corner) зробило б інструмент придатним для планшетів.

---

### 13. OpenCV завантажується завжди, навіть без потреби

**Файл:** [index.html](file:///c:/Projects/cut-image/index.html#L58-L59)

```html
<script async src="https://docs.opencv.org/4.8.0/opencv.js" ...>
```

OpenCV (~8 MB) завантажується для **всіх** вкладок, хоча потрібний тільки для **Card Extraction** і **Descreen**. Це уповільнює першу завантаженість для користувачів **Grid Slicing**.

**Рішення:** ліниве завантаження OpenCV при першому переході на відповідні вкладки (або при першому натисканні "Auto-Detect").

---

## 📋 Пріоритизований план дій

| # | Задача | Складність | Вплив |
|---|--------|-----------|-------|
| 1 | Виправити зламане кодування в `renderer.js` | Низька | Висока |
| 2 | Виправити текст "unselect" → "delete" в confirm | Низька | Середня |
| 3 | Замінити `onclick=""` на JS listeners у `tabs.js` | Низька | Середня |
| 4 | Додати CSS клас для вузьких числових інпутів | Низька | Низька |
| 5 | Винести canvas font-константи | Низька | Низька |
| 6 | Замінити JS `style.display` на CSS клас у descreen | Середня | Середня |
| 7 | Спільна логіка `snap` — рефакторинг | Середня | Середня |
| 8 | localStorage для налаштувань між сесіями | Середня | Висока |
| 9 | Ліниве завантаження OpenCV | Середня | Висока |
| 10 | Undo/Redo стек | Висока | Висока |
| 11 | Розбити `events.js` на freeform/rect | Висока | Середня |
| 12 | Виділити спільний `file-loader-core.js` | Висока | Середня |
| 13 | Touch підтримка | Висока | Середня |
