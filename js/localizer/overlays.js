// ============================================================
// Localizer — HTML Overlays (text blocks & patches)
// Renders interactive overlays on top of the canvas and handles
// drag / resize / rotate interactions.
// ============================================================

import { state, els } from './state.js';
import { redrawCanvas, getShrunkFontSize } from './renderer.js';
import { updateFontsList } from './ui.js';
// Circular import — safe because called only inside function bodies
import { autosaveConfig } from './io.js';

// ── Active-element helpers ──────────────────────────────────

export function setActiveText(id) {
    if (state.activeTextId === id && state.activePatchId === null) return;
    autosaveConfig();
    state.activeTextId = id;
    state.activePatchId = null;
    els.patchColorBtn.style.display = 'none';
    els.colorPaletteModal.style.display = 'none';

    updateOverlaysVisualState();
    updateFontsList();
}

export function setActivePatch(id) {
    if (state.activePatchId === id && state.activeTextId === null) return;
    autosaveConfig();
    state.activePatchId = id;
    state.activeTextId = null;

    if (id) {
        els.patchColorBtn.style.display = 'block';
        const cardConfig = state.config.cards[state.images[state.currentIndex].name];
        if (cardConfig && cardConfig.patches) {
            const patch = cardConfig.patches.find(p => p.id === id);
            if (patch) {
                els.patchColorBtn.style.background = patch.color || '#ffffff';
                els.patchColorPicker.value = patch.color || '#ffffff';
            }
        }
    } else {
        els.patchColorBtn.style.display = 'none';
        els.colorPaletteModal.style.display = 'none';
    }

    updateOverlaysVisualState();
    updateFontsList();
}

// ── Visual state sync — just toggle CSS class ───────────────

export function updateOverlaysVisualState() {
    const allOverlays = els.overlaysContainer.querySelectorAll('.loc-text-overlay, .loc-patch-overlay');
    allOverlays.forEach(el => {
        const id = el.dataset.id;
        const isActive = (id === state.activeTextId) || (id === state.activePatchId);
        el.classList.toggle('is-active', isActive);
    });
}

// ── Full overlay rebuild ────────────────────────────────────

export async function renderOverlays() {
    await document.fonts.ready;
    els.overlaysContainer.innerHTML = '';
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const cardConfig = state.config.cards[card.name];
    if (!cardConfig) return;

    // --- Patches ---
    if (cardConfig.patches) {
        cardConfig.patches.forEach(p => {
            const isActive = p.id === state.activePatchId;
            const div = document.createElement('div');
            div.className = 'loc-patch-overlay' + (isActive ? ' is-active' : '');
            div.dataset.id = p.id;
            // Dynamic position/size only
            div.style.left = p.x + '%';
            div.style.top = p.y + '%';
            div.style.width = p.width + '%';
            div.style.height = p.height + '%';
            div.style.transform = `rotate(${p.rotation || 0}deg)`;

            div.innerHTML = `
                <div class="loc-patch-selector" title="Select patch"></div>
                <div class="loc-drag-handle loc-handle" title="Drag"></div>
                <div class="loc-rotate-handle loc-handle" title="Rotate"></div>
                <div class="loc-resize-handle loc-handle" title="Resize"></div>
                <button class="loc-del-patch loc-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;

            div.addEventListener('mousedown', () => setActivePatch(p.id));
            div.querySelector('.loc-patch-selector').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                setActivePatch(p.id);
            });
            div.querySelector('.loc-del-patch').addEventListener('click', (e) => {
                e.stopPropagation();
                cardConfig.patches = cardConfig.patches.filter(x => x.id !== p.id);
                if (state.activePatchId === p.id) setActivePatch(null);
                autosaveConfig();
                renderOverlays();
                redrawCanvas();
            });

            setupOverlayInteraction(div, p);
            els.overlaysContainer.appendChild(div);
        });
    }

    // --- Text blocks ---
    if (cardConfig.texts) {
        cardConfig.texts.forEach(t => {
            const isActive = t.id === state.activeTextId;
            const div = document.createElement('div');
            div.className = 'loc-text-overlay' + (isActive ? ' is-active' : '');
            div.dataset.id = t.id;
            // Dynamic position/size only
            div.style.left = t.x + '%';
            div.style.top = t.y + '%';
            div.style.width = t.width + '%';
            div.style.height = t.height + '%';
            div.style.transform = `rotate(${t.rotation || 0}deg)`;

            const font = state.config.fonts[t.fontId];
            const fontFamily = font ? font.family : 'sans-serif';
            const fontStyle = font ? (font.italic ? 'italic' : 'normal') : 'normal';
            const taAlign = t.align || 'center';

            const lang = state.config.currentLang;
            const textContent = t.content[lang] || '';

            const canvasW = els.canvas.width || 1000;
            const canvasH = els.canvas.height || 1000;
            const pxW = (t.width / 100) * canvasW;
            const pxH = (t.height / 100) * canvasH;
            const shrunkSize = getShrunkFontSize(els.ctx, textContent, font, pxW, pxH);

            // Build tooltip for other languages
            const otherLangs = state.config.languages.filter(l => l !== lang);
            let tooltipText = "Translations:\n";
            let hasOtherTexts = false;
            otherLangs.forEach(l => {
                if (t.content[l] && t.content[l].trim()) {
                    tooltipText += `[${l.toUpperCase()}]: ${t.content[l]}\n`;
                    hasOtherTexts = true;
                }
            });
            if (!hasOtherTexts) tooltipText += "No translations yet.";

            div.innerHTML = `
                <div class="loc-drag-handle loc-handle" title="Drag"></div>
                <div class="loc-rotate-handle loc-handle" title="Rotate"></div>
                <div class="loc-resize-handle loc-handle" title="Resize"></div>
                <div class="loc-info-icon loc-handle" title="${tooltipText.replace(/"/g, '&quot;')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <button class="loc-del-text loc-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <textarea class="loc-overlay-textarea" style="font-family:'${fontFamily}', sans-serif; font-size:${shrunkSize}px; text-align:${taAlign}; font-style:${fontStyle};">${textContent}</textarea>
            `;

            const ta = div.querySelector('textarea');
            ta.addEventListener('input', (e) => {
                t.content[lang] = e.target.value;
                const newShrunkSize = getShrunkFontSize(els.ctx, e.target.value, font, pxW, pxH);
                ta.style.fontSize = newShrunkSize + 'px';
                redrawCanvas();
            });
            ta.addEventListener('blur', () => autosaveConfig());
            ta.addEventListener('focus', () => setActiveText(t.id));
            div.addEventListener('mousedown', () => setActiveText(t.id));

            div.querySelector('.loc-del-text').addEventListener('click', (e) => {
                e.stopPropagation();
                cardConfig.texts = cardConfig.texts.filter(x => x.id !== t.id);
                if (state.activeTextId === t.id) state.activeTextId = null;
                autosaveConfig();
                renderOverlays();
                redrawCanvas();
                updateFontsList();
            });

            setupOverlayInteraction(div, t);
            els.overlaysContainer.appendChild(div);
        });
    }
}

// ── Drag / Resize / Rotate interaction ─────────────────────

export function setupOverlayInteraction(el, t) {
    const dragHandle = el.querySelector('.loc-drag-handle');
    const resizeHandle = el.querySelector('.loc-resize-handle');
    const rotateHandle = el.querySelector('.loc-rotate-handle');

    let mode = null; // 'drag' | 'resize' | 'rotate'
    let startX, startY;
    let startW, startH;
    let startLeft, startTop;

    const startInteraction = (e, m) => {
        e.preventDefault();
        e.stopPropagation();
        mode = m;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = t.x;
        startTop = t.y;
        startW = t.width;
        startH = t.height;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    dragHandle.addEventListener('mousedown', (e) => startInteraction(e, 'drag'));
    resizeHandle.addEventListener('mousedown', (e) => startInteraction(e, 'resize'));

    rotateHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mode = 'rotate';

        const parentRect = els.overlaysContainer.getBoundingClientRect();
        const cardRot = state.images[state.currentIndex].rotation || 0;
        const scale = state.currentScale || 1;

        const cardCenterX = parentRect.left + parentRect.width / 2;
        const cardCenterY = parentRect.top + parentRect.height / 2;

        const localX = (t.x / 100) * els.canvas.width;
        const localY = (t.y / 100) * els.canvas.height;
        const vX = localX - els.canvas.width / 2;
        const vY = localY - els.canvas.height / 2;

        const rad = cardRot * Math.PI / 180;
        const rvX = vX * Math.cos(rad) - vY * Math.sin(rad);
        const rvY = vX * Math.sin(rad) + vY * Math.cos(rad);

        state.rotOriginX = cardCenterX + rvX * scale;
        state.rotOriginY = cardCenterY + rvY * scale;

        const dx = e.clientX - state.rotOriginX;
        const dy = e.clientY - state.rotOriginY;
        state.startMouseAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        state.startTextRotation = t.rotation || 0;

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    const onMove = (e) => {
        if (!mode) return;

        const scale = state.currentScale || 1;
        const cardRot = state.images[state.currentIndex].rotation || 0;
        let dx = (e.clientX - startX) / scale;
        let dy = (e.clientY - startY) / scale;

        const rad = -cardRot * Math.PI / 180;
        const adjustedDx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const adjustedDy = dx * Math.sin(rad) + dy * Math.cos(rad);

        const netRot = cardRot + (t.rotation || 0);
        const radBox = -netRot * Math.PI / 180;
        const boxDx = dx * Math.cos(radBox) - dy * Math.sin(radBox);
        const boxDy = dx * Math.sin(radBox) + dy * Math.cos(radBox);

        if (mode === 'drag') {
            t.x = startLeft + (adjustedDx / els.canvas.width) * 100;
            t.y = startTop + (adjustedDy / els.canvas.height) * 100;
            el.style.left = t.x + '%';
            el.style.top = t.y + '%';
        } else if (mode === 'resize') {
            t.width = Math.max(2, startW + (boxDx / els.canvas.width) * 100);
            t.height = Math.max(2, startH + (boxDy / els.canvas.height) * 100);
            el.style.width = t.width + '%';
            el.style.height = t.height + '%';
        } else if (mode === 'rotate') {
            const dx2 = e.clientX - state.rotOriginX;
            const dy2 = e.clientY - state.rotOriginY;
            const currentMouseAngle = Math.atan2(dy2, dx2) * 180 / Math.PI;
            const delta = currentMouseAngle - state.startMouseAngle;
            t.rotation = (state.startTextRotation + delta) % 360;
            el.style.transform = `rotate(${t.rotation}deg)`;
        }

        redrawCanvas();
    };

    const onUp = () => {
        mode = null;
        autosaveConfig();
        redrawCanvas();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
}
