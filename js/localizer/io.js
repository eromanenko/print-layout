// ============================================================
// Localizer — File I/O
// Handles: ZIP/image loading, config save/load, CSV/XLSX import,
// image/PDF export, and the conflict resolution flow.
// ============================================================

import { showToast } from '../utils/toast.js';
import { state, els } from './state.js';
import { drawTextOnCanvas, drawPatchOnCanvas } from './renderer.js';
import { renderOverlays } from './overlays.js';
import { injectFont, updateFontsList, updateLanguagesUI, setPlaceholderState,
         updateDeckControls, handleAddLanguage } from './ui.js';
// Circular import — safe (called only inside function bodies)
import { renderCurrentCard } from './index.js';

// ── Config save ─────────────────────────────────────────────

export async function autosaveConfig() {
    if (els.autosaveBtn.checked) {
        await saveConfigToFile(true);
    }
}

export async function saveConfigToFile(silent = false) {
    state.config.version = "0.5.0";
    if (!window.showSaveFilePicker) {
        if (silent) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.config, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = "localizer_config.json";
        a.click();
        showToast("Config saved via download", "success");
        return;
    }

    try {
        if (!state.fileHandle) {
            state.fileHandle = await window.showSaveFilePicker({
                suggestedName: 'localizer_config.json',
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            });
        }
        const writable = await state.fileHandle.createWritable();
        const dataStr = JSON.stringify(state.config, null, 2);
        await writable.write(dataStr);
        await writable.close();
        if (!silent) showToast("Config saved to file", "success");
    } catch (err) {
        console.error("Save failed:", err);
        if (err.name !== 'AbortError') {
            showToast("Failed to save config: " + err.message, "error");
        }
    }
}

// ── Config load ─────────────────────────────────────────────

export async function loadConfigFromFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (!config.fonts || !config.cards) throw new Error("Invalid config format");

        state.config = config;

        Object.keys(state.config.fonts).forEach(name => {
            const f = state.config.fonts[name];
            if (f.base64) injectFont(f.family, f.base64);
        });

        updateFontsList();
        updateLanguagesUI();

        let matchCount = 0;
        if (state.images.length > 0) {
            state.images.forEach(img => {
                if (state.config.cards[img.name]) {
                    matchCount++;
                    if (state.config.cards[img.name].rotation) {
                        img.rotation = state.config.cards[img.name].rotation;
                    }
                }
            });
            showToast(`Configuration applied to ${matchCount} out of ${state.images.length} files.`, "success");
        } else {
            showToast("Configuration loaded successfully!", "success");
        }

        els.manageDeckBtn.style.display = 'flex';
        updateDeckControls();
        renderCurrentCard();
    } catch (error) {
        console.error("Config import error:", error);
        showToast("Error loading config: " + error.message, "error");
    }
}

// ── ZIP / Image upload ───────────────────────────────────────

export async function handleFilesUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPlaceholderState('<p>Processing files...</p>');

    let newImages = [];
    let newConfig = null;
    let conflicts = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.name.toLowerCase().endsWith('.zip')) {
                const zip = new window.JSZip();
                const loadedZip = await zip.loadAsync(file);

                if (loadedZip.files['config.json']) {
                    const configText = await loadedZip.files['config.json'].async('string');
                    newConfig = JSON.parse(configText);
                }

                for (const [filename, fileData] of Object.entries(loadedZip.files)) {
                    if (fileData.dir || !filename.match(/\.(jpe?g|png|webp)$/i)) continue;
                    const blob = await fileData.async('blob');
                    const cleanName = filename.split('/').pop();
                    newImages.push({ name: cleanName, blob: blob });
                }
            } else if (file.type.startsWith('image/')) {
                newImages.push({ name: file.name, blob: file });
            }
        }

        if (newImages.length === 0) {
            setPlaceholderState('<p style="color:red;">No valid images found.</p>');
            return;
        }

        // Version check when merging
        if (state.images.length > 0 && newConfig) {
            const currentVer = state.config.version || "0.0.0";
            const newVer = newConfig.version || "0.0.0";
            const cParts = currentVer.split('.');
            const nParts = newVer.split('.');
            if (cParts[0] !== nParts[0] || cParts[1] !== nParts[1]) {
                showToast(`Cannot merge config: Version mismatch (${currentVer} vs ${newVer})`, "error");
                newConfig = null;
            }
        }

        const existingNames = state.images.map(img => img.name);
        conflicts = newImages.filter(img => existingNames.includes(img.name)).map(img => img.name);

        state.pendingUpload = { newImages, newConfig, conflicts };

        if (conflicts.length > 0) {
            els.conflictList.innerHTML = conflicts.map(name => `<div style="padding: 2px 0;">• ${name}</div>`).join('');
            els.conflictModal.style.display = 'flex';
        } else {
            finalizeAppendUpload();
        }

    } catch (error) {
        console.error("Error uploading files:", error);
        setPlaceholderState(`<p style="color:red;">Error: ${error.message}</p>`);
        if (state.images.length > 0) setPlaceholderState(null, false);
    }
}

export function finalizeAppendUpload() {
    if (!state.pendingUpload) return;
    const { newImages, newConfig } = state.pendingUpload;

    const isAppending = state.images.length > 0;

    if (!isAppending) {
        state.images.forEach(img => URL.revokeObjectURL(img.blobUrl));
        state.images = [];
    }

    if (newConfig) {
        if (!isAppending) {
            state.config = newConfig;
        } else {
            if (newConfig.cards) Object.assign(state.config.cards, newConfig.cards);
            if (newConfig.fonts) {
                Object.keys(newConfig.fonts).forEach(fName => {
                    if (!state.config.fonts[fName]) state.config.fonts[fName] = newConfig.fonts[fName];
                });
            }
        }
        Object.keys(state.config.fonts).forEach(name => {
            const f = state.config.fonts[name];
            if (f.base64) injectFont(f.family, f.base64);
        });
        updateFontsList();
        updateLanguagesUI();
    }

    newImages.forEach(newImg => {
        const existingIdx = state.images.findIndex(img => img.name === newImg.name);
        const blobUrl = URL.createObjectURL(newImg.blob);
        if (existingIdx !== -1) {
            URL.revokeObjectURL(state.images[existingIdx].blobUrl);
            state.images[existingIdx].blobUrl = blobUrl;
            state.images[existingIdx].loadedImg = null;
        } else {
            let savedRot = 0;
            if (state.config.cards[newImg.name] && state.config.cards[newImg.name].rotation) {
                savedRot = state.config.cards[newImg.name].rotation;
            }
            state.images.push({ name: newImg.name, blobUrl: blobUrl, rotation: savedRot });
        }
    });

    updateDeckControls();
    setPlaceholderState(null, false);
    els.galleryContainer.style.display = 'flex';
    els.conflictModal.style.display = 'none';
    state.pendingUpload = null;
    els.zipInput.value = '';

    renderCurrentCard();
    showToast(isAppending ? `Project updated: ${newImages.length} files processed.` : `Loaded ${newImages.length} images.`, "success");
    autosaveConfig();
}

// ── Export functions ─────────────────────────────────────────

export async function handleExportProject() {
    if (state.images.length === 0) return showToast("No project to save", "error");
    els.exportStatus.style.display = 'block';
    els.exportStatus.textContent = 'Packing project...';
    try {
        const zip = new window.JSZip();
        zip.file('config.json', JSON.stringify(state.config, null, 2));
        for (const img of state.images) {
            const response = await fetch(img.blobUrl);
            const blob = await response.blob();
            zip.file(img.name, blob);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = "localizer_project.zip";
        a.click();
        showToast("Project saved successfully", "success");
    } catch (err) {
        showToast("Error saving project: " + err.message, "error");
    } finally {
        els.exportStatus.style.display = 'none';
    }
}

export async function handleExportImages() {
    if (state.images.length === 0) return showToast("No images to export", "error");
    els.exportStatus.style.display = 'block';
    els.exportStatus.textContent = 'Rendering images...';
    try {
        const zip = new window.JSZip();
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        for (let i = 0; i < state.images.length; i++) {
            const card = state.images[i];
            els.exportStatus.textContent = `Rendering ${i+1}/${state.images.length}...`;
            const img = card.loadedImg || await new Promise(resolve => {
                const iObj = new Image();
                iObj.onload = () => resolve(iObj);
                iObj.src = card.blobUrl;
            });
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(img, 0, 0);
            const cardConfig = state.config.cards[card.name];
            if (cardConfig) {
                if (cardConfig.patches) {
                    cardConfig.patches.forEach(p => drawPatchOnCanvas(offCtx, p, offCanvas.width, offCanvas.height, img));
                }
                if (cardConfig.texts) {
                    cardConfig.texts.forEach(t => drawTextOnCanvas(offCtx, t, offCanvas.width, offCanvas.height));
                }
            }
            const blob = await new Promise(res => offCanvas.toBlob(res, 'image/jpeg', 0.9));
            zip.file(card.name, blob);
        }
        els.exportStatus.textContent = 'Zipping...';
        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `localized_images_${state.config.currentLang}.zip`;
        a.click();
        showToast("Images exported successfully", "success");
    } catch (err) {
        showToast("Error exporting images: " + err.message, "error");
    } finally {
        els.exportStatus.style.display = 'none';
    }
}

export async function handleExportPdf() {
    if (state.images.length === 0) return showToast("No images to export", "error");
    els.exportStatus.style.display = 'block';
    els.exportStatus.textContent = 'Rendering for PDF...';
    try {
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < state.images.length; i++) {
            const card = state.images[i];
            els.exportStatus.textContent = `Rendering ${i+1}/${state.images.length}...`;
            const img = card.loadedImg || await new Promise(resolve => {
                const iObj = new Image();
                iObj.onload = () => resolve(iObj);
                iObj.src = card.blobUrl;
            });
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(img, 0, 0);
            const cardConfig = state.config.cards[card.name];
            if (cardConfig) {
                if (cardConfig.patches) {
                    cardConfig.patches.forEach(p => drawPatchOnCanvas(offCtx, p, offCanvas.width, offCanvas.height, img));
                }
                if (cardConfig.texts) {
                    cardConfig.texts.forEach(t => drawTextOnCanvas(offCtx, t, offCanvas.width, offCanvas.height));
                }
            }
            const blob = await new Promise(res => offCanvas.toBlob(res, 'image/jpeg', 1.0));
            const newName = card.name.replace(/\.[^/.]+$/, "") + ".jpg";
            dataTransfer.items.add(new File([blob], newName, { type: 'image/jpeg' }));
        }
        const plInput = document.getElementById('plFacesFileInput');
        if (plInput) {
            plInput.files = dataTransfer.files;
            plInput.dispatchEvent(new Event('change'));
            const plTabBtn = document.querySelector('.main-tab-btn[data-target="tab-print-layout"]');
            if (plTabBtn) plTabBtn.click();
            showToast("Images sent to Print Layout!", "success");
        } else {
            showToast("Error: Print Layout tab not found", "error");
        }
    } catch (err) {
        showToast("Error exporting to PDF: " + err.message, "error");
    } finally {
        els.exportStatus.style.display = 'none';
    }
}

// ── Table import (CSV / XLSX) ────────────────────────────────

export function handleDownloadCsvTemplate() {
    const headers = ["filename", "font", "x", "y", "width", "height", "rotation", ...state.config.languages];
    const rows = [
        ["card_01.jpg", "1", "10", "10", "80", "20", "0", "Title in English", "Заголовок українською", "Заголовок на русском"],
        ["card_01.jpg", "2", "10", "40", "80", "50", "0", "Description in English", "Опис українською", "Описание на русском"]
    ];
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "template.csv";
    a.click();
    showToast("CSV Template downloaded", "success");
}

export function handleDownloadXlsxTemplate() {
    if (!window.XLSX) return showToast("Excel library not loaded", "error");
    const headers = ["filename", "font", "x", "y", "width", "height", "rotation", ...state.config.languages];
    const rows = [
        ["card_01.jpg", "1", "10", "10", "80", "20", "0", "Title in English", "Заголовок українською", "Заголовок на русском"],
        ["card_01.jpg", "2", "10", "40", "80", "50", "0", "Description in English", "Опис українською", "Описание на русском"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Translations");
    XLSX.writeFile(wb, "template.xlsx");
    showToast("XLSX Template downloaded", "success");
}

export async function handleTableImport(file) {
    els.importModal.style.display = 'none';
    try {
        let data = [];
        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            data = parseCsv(text);
        } else if (file.name.endsWith('.xlsx')) {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        }

        if (data.length < 2) return showToast("Table is empty or missing headers", "error");

        const headers = data[0].map(h => String(h).trim().toLowerCase());
        const filenameIdx = headers.indexOf('filename');
        const fontIdx = headers.indexOf('font');
        if (filenameIdx === -1) return showToast("Column 'filename' not found in header", "error");

        const xIdx = headers.indexOf('x');
        const yIdx = headers.indexOf('y');
        const wIdx = headers.indexOf('width');
        const hIdx = headers.indexOf('height');
        const rIdx = headers.indexOf('rotation');

        const langCols = {};
        const reservedHeaders = ['filename', 'font', 'x', 'y', 'width', 'height', 'rotation'];
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            if (!h || reservedHeaders.includes(h)) continue;
            const existingLang = state.config.languages.find(l => l.toLowerCase() === h);
            if (existingLang) {
                langCols[existingLang] = i;
            } else {
                handleAddLanguage(h, true);
                langCols[h] = i;
            }
        }

        if (Object.keys(langCols).length === 0) return showToast("No language columns found in table", "error");

        const rows = data.slice(1);
        let importedCount = 0;
        const fileOffsets = {};
        const fontIds = Object.keys(state.config.fonts);
        const clearedCards = new Set();
        const replaceTexts = els.importReplaceTexts.checked;

        rows.forEach(row => {
            const fname = String(row[filenameIdx] || '').trim();
            if (!fname) return;
            const card = state.images.find(img => img.name.toLowerCase() === fname.toLowerCase());
            if (!card) return;

            let selectedFontId = null;
            if (fontIdx !== -1) {
                const styleNum = parseInt(row[fontIdx]);
                if (!isNaN(styleNum) && styleNum > 0 && styleNum <= fontIds.length) {
                    selectedFontId = fontIds[styleNum - 1];
                }
            } else {
                selectedFontId = fontIds.length > 0 ? fontIds[0] : null;
            }

            const content = {};
            let hasContent = false;
            Object.entries(langCols).forEach(([lang, idx]) => {
                const val = String(row[idx] || '').trim();
                if (val) { content[lang] = val; hasContent = true; }
            });
            if (!hasContent) return;

            if (!state.config.cards[card.name]) {
                state.config.cards[card.name] = { texts: [] };
            }
            if (replaceTexts && !clearedCards.has(card.name)) {
                state.config.cards[card.name].texts = [];
                clearedCards.add(card.name);
            }

            const offsetCount = fileOffsets[card.name] || 0;
            const offset = offsetCount * 2;
            
            let tx = 5 + offset, ty = 5 + offset, tw = 40, th = 10, trot = 0;
            if (xIdx !== -1 && row[xIdx] !== undefined && row[xIdx] !== "") tx = parseFloat(row[xIdx]);
            if (yIdx !== -1 && row[yIdx] !== undefined && row[yIdx] !== "") ty = parseFloat(row[yIdx]);
            if (wIdx !== -1 && row[wIdx] !== undefined && row[wIdx] !== "") tw = parseFloat(row[wIdx]);
            if (hIdx !== -1 && row[hIdx] !== undefined && row[hIdx] !== "") th = parseFloat(row[hIdx]);
            if (rIdx !== -1 && row[rIdx] !== undefined && row[rIdx] !== "") trot = parseFloat(row[rIdx]);

            state.config.cards[card.name].texts.push({
                id: "txt_" + Math.random().toString(36).substr(2, 9),
                fontId: selectedFontId,
                x: tx, y: ty,
                width: tw, height: th,
                rotation: trot,
                align: "left",
                content: content
            });
            fileOffsets[card.name] = offsetCount + 1;
            importedCount++;
        });

        if (importedCount > 0) {
            showToast(`Imported ${importedCount} text blocks`, "success");
            renderOverlays();
            autosaveConfig();
        } else {
            showToast("No matching cards or content found in table", "info");
        }
    } catch (err) {
        console.error("Import error:", err);
        showToast("Error importing table: " + err.message, "error");
    }
}

function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') { currentCell += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell); currentCell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell); rows.push(currentRow);
    }
    return rows;
}

function getTableDataForExport() {
    const headers = ["filename", "font", "x", "y", "width", "height", "rotation", ...state.config.languages];
    const rows = [];
    const fontIds = Object.keys(state.config.fonts);

    state.images.forEach(card => {
        const config = state.config.cards[card.name];
        if (config && config.texts && config.texts.length > 0) {
            config.texts.forEach(txt => {
                const fontIdx = fontIds.indexOf(txt.fontId) + 1;
                const row = [
                    card.name,
                    fontIdx > 0 ? fontIdx : "",
                    txt.x, txt.y, txt.width, txt.height, txt.rotation || 0
                ];
                state.config.languages.forEach(lang => {
                    row.push(txt.content[lang] || "");
                });
                rows.push(row);
            });
        }
    });
    return { headers, rows };
}

export function handleExportCsvTable() {
    const data = getTableDataForExport();
    if (data.rows.length === 0) return showToast("No texts to export", "info");
    const csvContent = [data.headers, ...data.rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "localized_texts.csv";
    a.click();
    showToast("CSV exported", "success");
}

export function handleExportXlsxTable() {
    if (!window.XLSX) return showToast("Excel library not loaded", "error");
    const data = getTableDataForExport();
    if (data.rows.length === 0) return showToast("No texts to export", "info");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Translations");
    XLSX.writeFile(wb, "localized_texts.xlsx");
    showToast("XLSX exported", "success");
}
