// ============================================================
// Localizer — UI Utilities
// Pure UI rendering, form helpers, language & font list updates.
// ============================================================

import { showToast } from '../utils/toast.js';
import { state, els } from './state.js';
import { redrawCanvas } from './renderer.js';
import { renderOverlays } from './overlays.js';
// Circular imports — safe (called only inside function bodies)
import { autosaveConfig } from './io.js';
import { renderCurrentCard } from './index.js';

// ── Placeholder ─────────────────────────────────────────────

export function setPlaceholderState(html, isVisible = true) {
    const el = els.locPlaceholder || document.getElementById('locPlaceholder');
    if (!el) return;
    if (html) el.innerHTML = html;
    el.style.display = isVisible ? 'flex' : 'none';
}

// ── JSON Viewer ─────────────────────────────────────────────

export function renderJsonToHTML(data) {
    if (data === null) return `<span style="color:#64748b">null</span>`;
    if (typeof data === 'string') {
        let str = data;
        if (str.startsWith('data:') && str.length > 50) {
            str = str.substring(0, 50) + '... (truncated)';
        }
        return `<span style="color:#15803d">"${str}"</span>`;
    }
    if (typeof data === 'number') return `<span style="color:#c2410c">${data}</span>`;
    if (typeof data === 'boolean') return `<span style="color:#be185d">${data}</span>`;

    if (Array.isArray(data)) {
        if (data.length === 0) return `<span>[]</span>`;
        let html = `<details open><summary style="cursor: pointer; user-select: none;">[</summary><div style="padding-left: 15px; border-left: 1px solid #ddd; margin-left: 5px;">`;
        data.forEach((item, i) => {
            html += `<div style="text-align: left;">${renderJsonToHTML(item)}${i < data.length - 1 ? ',' : ''}</div>`;
        });
        html += `</div><span>]</span></details>`;
        return html;
    }

    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return `<span>{}</span>`;
        let html = `<details open><summary style="cursor: pointer; user-select: none;">{</summary><div style="padding-left: 15px; border-left: 1px solid #ddd; margin-left: 5px;">`;
        keys.forEach((k, i) => {
            const val = data[k];
            html += `<div style="text-align: left;"><span style="color:#1d4ed8">"${k}"</span>: ${renderJsonToHTML(val)}${i < keys.length - 1 ? ',' : ''}</div>`;
        });
        html += `</div><span>}</span></details>`;
        return html;
    }
    return String(data);
}

export function handleViewConfig() {
    els.jsonTree.innerHTML = renderJsonToHTML(state.config);
    els.jsonModal.style.display = 'flex';
}

// ── Font Form Helpers ────────────────────────────────────────

export function updatePreviewStyle() {
    if (els.previewOverlay.style.display === 'none') return;
    els.previewText.style.fontSize = els.newFontSize.value + "px";
    els.previewText.style.color = els.newFontColor.value;
    els.previewText.style.fontStyle = els.newFontItalic.checked ? 'italic' : 'normal';
}

export function injectFont(familyName, base64Url) {
    if (!base64Url) return;
    const styleId = `font-${familyName}`;
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = `
        @font-face {
            font-family: "${familyName}";
            src: url("${base64Url}");
        }
    `;
}

export async function analyzeFontFile(file) {
    return {};
}

export function resetFontForm(collapse = false) {
    state.editingFontName = null;
    els.newFontName.value = '';
    els.newFontName.disabled = false;
    els.newFontSize.value = 20;
    els.newFontColor.value = '#000000';
    els.newFontFile.value = '';
    els.fontFileName.textContent = 'No file selected';
    els.newFontItalic.checked = false;

    els.addFontBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add style
    `;
    if (collapse) {
        els.fontForm.style.display = 'none';
        els.toggleFontFormIcon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
    }
}

// ── Fonts List ──────────────────────────────────────────────

export function updateFontsList() {
    els.fontsList.innerHTML = '';
    const fontNames = Object.keys(state.config.fonts);

    // Find active fontId
    let activeFontId = null;
    if (state.activeTextId && state.images.length > 0) {
        const card = state.images[state.currentIndex];
        const config = state.config.cards[card.name];
        if (config && config.texts) {
            const txt = config.texts.find(t => t.id === state.activeTextId);
            if (txt) activeFontId = txt.fontId;
        }
    }

    if (fontNames.length === 0) {
        els.fontsList.innerHTML = '<span style="color:#666; font-size:0.9em; text-align:center;">No custom fonts added</span>';
        return;
    }

    fontNames.forEach(name => {
        const f = state.config.fonts[name];
        const div = document.createElement('div');
        const isActive = name === activeFontId;
        const isEditing = name === state.editingFontName;

        div.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding: 5px; font-family: "${f.family}"; color: ${f.color}; cursor: pointer; border: ${isActive ? '2px solid #007bff' : (isEditing ? '2px solid #ffc107' : '1px solid transparent')}; background: ${isActive ? '#eef6ff' : (isEditing ? '#fff8e1' : 'transparent')}; border-radius: 4px; margin-bottom: 2px;`;

        div.innerHTML = `
            <span style="pointer-events:none; flex:1;"><b>${name}</b> (${f.size}px)</span>
            <div style="display: flex; gap: 5px;">
                <button class="loc-edit-font" data-name="${name}" style="background:none; border:none; cursor:pointer; color:${isEditing ? 'red' : '#007bff'}; display: flex; align-items: center; justify-content: center; padding: 2px;" title="${isEditing ? 'Cancel Edit' : 'Edit Style'}">
                    ${isEditing
                        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
                    }
                </button>
                <button class="loc-del-font" data-name="${name}" style="color:red; background:none; border:none; cursor:pointer; display: flex; align-items: center; justify-content: center; padding: 2px;" title="Remove Font">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;

        // Click to apply font to active text
        div.addEventListener('click', async (e) => {
            if (e.target.classList.contains('loc-edit-font') || e.target.classList.contains('loc-del-font')) return;

            if (state.activeTextId && state.images.length > 0) {
                const card = state.images[state.currentIndex];
                const config = state.config.cards[card.name];
                if (config && config.texts) {
                    const txt = config.texts.find(t => t.id === state.activeTextId);
                    if (txt) {
                        txt.fontId = name;
                        await renderOverlays();
                        await redrawCanvas();
                        autosaveConfig();
                        updateFontsList();
                    }
                }
            }
        });

        div.querySelector('.loc-del-font').addEventListener('click', (e) => {
            const n = e.currentTarget.getAttribute('data-name');
            delete state.config.fonts[n];
            autosaveConfig();
            updateFontsList();
            renderCurrentCard();
        });

        div.querySelector('.loc-edit-font').addEventListener('click', (e) => {
            const n = e.currentTarget.getAttribute('data-name');

            if (state.editingFontName === n) {
                resetFontForm(true);
                updateFontsList();
                return;
            }

            state.editingFontName = n;
            const fontObj = state.config.fonts[n];

            els.newFontName.value = n;
            els.newFontName.disabled = true;
            els.newFontSize.value = fontObj.size;
            els.newFontColor.value = fontObj.color;
            els.newFontItalic.checked = fontObj.italic || false;

            els.newFontFile.value = '';
            els.addFontBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Update style
            `;
            els.fontForm.style.display = 'flex';
            els.toggleFontFormIcon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';

            updateFontsList();
        });

        els.fontsList.appendChild(div);
    });
}

// ── Language Management ─────────────────────────────────────

export function updateLanguagesUI() {
    const list = els.langList || document.getElementById('locLangList');
    if (!list) return;

    if (!state.config.languages || state.config.languages.length === 0) {
        state.config.languages = ["en"];
    }

    if (!state.config.languages.includes(state.config.currentLang)) {
        state.config.currentLang = state.config.languages[0];
    }

    list.innerHTML = '';
    state.config.languages.forEach(lang => {
        const isActive = state.config.currentLang === lang;
        const pill = document.createElement('div');
        pill.className = 'loc-lang-pill' + (isActive ? ' is-active' : '');

        const label = document.createElement('span');
        label.textContent = lang.toUpperCase();
        pill.appendChild(label);

        if (state.config.languages.length > 1) {
            const delBtn = document.createElement('span');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'loc-lang-pill-del';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleRemoveLanguage(lang);
            });
            pill.appendChild(delBtn);
        }

        pill.addEventListener('click', () => {
            state.config.currentLang = lang;
            updateLanguagesUI();
            renderOverlays();
            redrawCanvas();
            autosaveConfig();
        });

        list.appendChild(pill);
    });
}

export function handleAddLanguage(code, silent = false) {
    if (!code || typeof code !== 'string') return;
    code = code.trim().toLowerCase();
    if (!code) return;
    if (state.config.languages.includes(code)) {
        if (!silent) showToast(`Language ${code} already exists`, "info");
        return;
    }

    state.config.languages.push(code);

    Object.values(state.config.cards).forEach(card => {
        if (card.texts) {
            card.texts.forEach(t => {
                if (t.content && t.content[code] === undefined) {
                    t.content[code] = "";
                }
            });
        }
    });

    updateLanguagesUI();
    if (!silent) {
        showToast(`Language ${code.toUpperCase()} added`, "success");
        autosaveConfig();
    }
}

export function handleRemoveLanguage(code) {
    if (state.config.languages.length <= 1) return;
    if (!confirm(`Are you sure you want to remove language "${code.toUpperCase()}"? All translations for this language will be deleted.`)) return;

    state.config.languages = state.config.languages.filter(l => l !== code);

    Object.values(state.config.cards).forEach(card => {
        if (card.texts) {
            card.texts.forEach(t => {
                if (t.content) delete t.content[code];
            });
        }
    });

    if (state.config.currentLang === code) {
        state.config.currentLang = state.config.languages[0];
    }

    updateLanguagesUI();
    renderOverlays();
    redrawCanvas();
    showToast(`Language ${code.toUpperCase()} removed`, "info");
    autosaveConfig();
}

// ── Patch Palette ────────────────────────────────────────────

export function renderPaletteModal() {
    els.paletteColorsContainer.innerHTML = '';
    const palette = state.config.patchPalette || [];

    if (palette.length === 0) {
        els.paletteColorsContainer.innerHTML = '<span style="color:#999; font-size:12px;">No colors yet</span>';
        return;
    }

    palette.forEach(color => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '2px';

        const btn = document.createElement('button');
        btn.style.width = '25px';
        btn.style.height = '25px';
        btn.style.background = color;
        btn.style.border = '1px solid #ccc';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.title = `Apply ${color}`;

        btn.addEventListener('click', () => {
            els.patchColorBtn.style.background = color;
            els.patchColorPicker.value = color;

            if (state.activePatchId && state.images.length > 0) {
                const cardConfig = state.config.cards[state.images[state.currentIndex].name];
                if (cardConfig && cardConfig.patches) {
                    const patch = cardConfig.patches.find(p => p.id === state.activePatchId);
                    if (patch) {
                        patch.color = color;
                        renderOverlays();
                        redrawCanvas();
                        autosaveConfig();
                    }
                }
            }
            els.colorPaletteModal.style.display = 'none';
        });

        const replaceBtn = document.createElement('button');
        replaceBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        `;
        replaceBtn.style.display = 'flex';
        replaceBtn.style.alignItems = 'center';
        replaceBtn.style.justifyContent = 'center';
        replaceBtn.style.padding = '2px 4px';
        replaceBtn.style.cursor = 'pointer';
        replaceBtn.style.background = '#ffc107';
        replaceBtn.style.border = 'none';
        replaceBtn.style.borderRadius = '3px';
        replaceBtn.title = `Replace all usages of ${color}`;

        replaceBtn.addEventListener('click', () => {
            const tempInput = document.createElement('input');
            tempInput.type = 'color';
            tempInput.value = color;
            tempInput.addEventListener('input', (e) => {
                replaceAllPatchColors(color, e.target.value);
            });
            tempInput.click();
            els.colorPaletteModal.style.display = 'none';
        });

        wrap.appendChild(btn);
        wrap.appendChild(replaceBtn);
        els.paletteColorsContainer.appendChild(wrap);
    });
}

export function replaceAllPatchColors(oldColor, newColor) {
    if (oldColor === newColor) return;

    let replacedCount = 0;
    Object.values(state.config.cards).forEach(card => {
        if (card.patches) {
            card.patches.forEach(p => {
                if (p.color === oldColor) {
                    p.color = newColor;
                    replacedCount++;
                }
            });
        }
    });

    if (state.config.patchPalette) {
        state.config.patchPalette = state.config.patchPalette.map(c => c === oldColor ? newColor : c);
        state.config.patchPalette = [...new Set(state.config.patchPalette)];
    }

    if (els.patchColorBtn.style.background === oldColor || els.patchColorPicker.value === oldColor) {
        els.patchColorBtn.style.background = newColor;
        els.patchColorPicker.value = newColor;
    }

    autosaveConfig();
    renderOverlays();
    redrawCanvas();
    showToast(`Replaced ${replacedCount} patches with new color!`, "success");
}

// ── Deck Controls ────────────────────────────────────────────

export function updateDeckManagerBadges() {
    const items = els.deckManagerGrid.querySelectorAll('.loc-deck-item');
    items.forEach((item, idx) => {
        const badge = item.querySelector('div:last-child');
        if (badge) badge.textContent = idx + 1;
    });
}

export function updateDeckControls() {
    const hasImages = state.images.length > 0;
    const buttons = [
        els.manageDeckBtn,
        els.exportPdfBtn,
        els.exportProjectBtn,
        els.exportImagesBtn,
        els.exportConfigBtn,
        els.viewConfigBtn
    ];

    buttons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !hasImages;
        btn.style.opacity = hasImages ? '1' : '0.5';
        btn.style.cursor = hasImages ? 'pointer' : 'not-allowed';
    });
}
