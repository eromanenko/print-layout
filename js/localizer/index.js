import { showToast } from '../utils/toast.js';

// Localizer State
const state = {
    images: [], // { name, blobUrl, rotation }
    currentIndex: 0,
    config: {
        version: "1.0",
        languages: ["en", "ua", "ru"],
        currentLang: "en",
        fonts: {}, // { "TitleFont": { family: "TitleFont", size: 20, color: "#000", base64: "data:..." } }
        cards: {}
    },
    currentScale: 1,
    activeTextId: null,
    activePatchId: null,
    fileHandle: null
};

// UI Elements
const els = {
    zipInput: document.getElementById('locZipInput'),
    zipCount: document.getElementById('locZipCount'),
    galleryContainer: document.getElementById('locGalleryContainer'),
    locPlaceholder: document.getElementById('locPlaceholder'),
    canvas: document.getElementById('locCanvas'),
    ctx: document.getElementById('locCanvas').getContext('2d'),
    cardName: document.getElementById('locCardName'),
    currentIndexLabel: document.getElementById('locCurrentIndex'),
    totalCardsLabel: document.getElementById('locTotalCards'),
    prevBtn: document.getElementById('locPrevBtn'),
    nextBtn: document.getElementById('locNextBtn'),
    rotateBtn: document.getElementById('locRotateBtn'),
    addTextBtn: document.getElementById('locAddTextBtn'),
    addPatchBtn: document.getElementById('locAddPatchBtn'),
    patchColorBtn: document.getElementById('locPatchColorBtn'),
    patchColorPicker: document.getElementById('locPatchColorPicker'),
    colorPaletteModal: document.getElementById('locColorPaletteModal'),
    paletteColorsContainer: document.getElementById('locPaletteColors'),
    palettePickNewBtn: document.getElementById('locPalettePickNewBtn'),
    closePaletteBtn: document.getElementById('locClosePaletteBtn'),
    alignLeftBtn: document.getElementById('locAlignLeftBtn'),
    alignCenterBtn: document.getElementById('locAlignCenterBtn'),
    alignRightBtn: document.getElementById('locAlignRightBtn'),
    
    // Workspace Elements
    workspace: document.getElementById('locWorkspace'),
    rotationContainer: document.getElementById('locRotationContainer'),
    overlaysContainer: document.getElementById('locOverlaysContainer'),
    
    // Phase 2 Elements
    loadConfigBtn: document.getElementById('locLoadConfigBtn'),
    configInput: document.getElementById('locConfigInput'),
    exportConfigBtn: document.getElementById('locExportConfigBtn'),
    autosaveBtn: document.getElementById('locAutosaveBtn'),
    
    // Phase 5 Elements
    viewConfigBtn: document.getElementById('locViewConfigBtn'),
    exportProjectBtn: document.getElementById('locExportProjectBtn'),
    exportImagesBtn: document.getElementById('locExportImagesBtn'),
    exportPdfBtn: document.getElementById('locExportPdfBtn'),
    exportStatus: document.getElementById('locExportStatus'),
    
    // JSON Modal
    jsonModal: document.getElementById('locJsonModal'),
    closeJsonModal: document.getElementById('locCloseJsonModal'),
    jsonTree: document.getElementById('locJsonTree'),
    
    langSelect: document.getElementById('locLangSelect'),
    fontsList: document.getElementById('locFontsList'),
    newFontName: document.getElementById('locNewFontName'),
    newFontFile: document.getElementById('locNewFontFile'),
    newFontSize: document.getElementById('locNewFontSize'),
    newFontColor: document.getElementById('locNewFontColor'),
    addFontBtn: document.getElementById('locAddFontBtn'),
    previewFontBtn: document.getElementById('locPreviewFontBtn'),
    previewOverlay: document.getElementById('locFontPreviewOverlay'),
    previewText: document.getElementById('locFontPreviewText'),
    closePreviewBtn: document.getElementById('locClosePreviewBtn')
};

// Listeners
els.zipInput.addEventListener('change', handleFilesUpload);
els.prevBtn.addEventListener('click', () => navigate(-1));
els.nextBtn.addEventListener('click', () => navigate(1));
els.rotateBtn.addEventListener('click', handleRotate);
els.addTextBtn.addEventListener('click', handleAddText);
els.alignLeftBtn.addEventListener('click', () => setAlignment('left'));
els.alignCenterBtn.addEventListener('click', () => setAlignment('center'));
els.alignRightBtn.addEventListener('click', () => setAlignment('right'));

function setAlignment(align) {
    if (!state.activeTextId || state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const config = state.config.cards[card.name];
    if (config && config.texts) {
        const txt = config.texts.find(t => t.id === state.activeTextId);
        if (txt) {
            txt.align = align;
            autosaveConfig();
            renderOverlays();
            redrawCanvas();
        }
    }
}

// Phase 2 Listeners
els.langSelect.addEventListener('change', (e) => {
    state.config.currentLang = e.target.value;
    renderOverlays(); // Just re-render overlays to switch text
    redrawCanvas();
});
els.addFontBtn.addEventListener('click', handleAddFont);
els.previewFontBtn.addEventListener('click', handlePreviewFont);
els.closePreviewBtn.addEventListener('click', () => els.previewOverlay.style.display = 'none');
els.newFontSize.addEventListener('input', updatePreviewStyle);
els.newFontColor.addEventListener('input', updatePreviewStyle);

els.exportConfigBtn.addEventListener('click', () => saveConfigToFile(false));
els.viewConfigBtn.addEventListener('click', handleViewConfig);
els.exportProjectBtn.addEventListener('click', handleExportProject);
els.exportImagesBtn.addEventListener('click', handleExportImages);
els.exportPdfBtn.addEventListener('click', handleExportPdf);

els.closeJsonModal.addEventListener('click', () => els.jsonModal.style.display = 'none');
els.jsonModal.addEventListener('click', (e) => {
    if (e.target === els.jsonModal) els.jsonModal.style.display = 'none';
});

els.addPatchBtn.addEventListener('click', handleAddPatch);
els.patchColorBtn.addEventListener('click', () => {
    if (!state.config.patchPalette || state.config.patchPalette.length === 0) {
        els.patchColorPicker.click();
    } else {
        renderPaletteModal();
        els.colorPaletteModal.style.display = 'block';
    }
});

els.closePaletteBtn.addEventListener('click', () => {
    els.colorPaletteModal.style.display = 'none';
});

els.palettePickNewBtn.addEventListener('click', () => {
    els.colorPaletteModal.style.display = 'none';
    els.patchColorPicker.click();
});

els.patchColorPicker.addEventListener('input', (e) => {
    const newColor = e.target.value;
    
    // Add to palette
    if (!state.config.patchPalette) state.config.patchPalette = [];
    if (!state.config.patchPalette.includes(newColor)) {
        state.config.patchPalette.push(newColor);
    }
    
    els.patchColorBtn.style.background = newColor;

    if (state.activePatchId && state.images.length > 0) {
        const cardConfig = state.config.cards[state.images[state.currentIndex].name];
        if (cardConfig && cardConfig.patches) {
            const patch = cardConfig.patches.find(p => p.id === state.activePatchId);
            if (patch) {
                patch.color = newColor;
                renderOverlays();
                redrawCanvas();
                autosaveConfig();
            }
        }
    }
});

els.loadConfigBtn.addEventListener('click', async () => {
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            });
            const file = await handle.getFile();
            state.fileHandle = handle;
            await loadConfigFromFile(file);
        } catch (err) {
            if (err.name !== 'AbortError') showToast("Error loading config: " + err.message, "error");
        }
    } else {
        els.configInput.click();
    }
});

els.configInput.addEventListener('change', (e) => {
    state.fileHandle = null;
    loadConfigFromFile(e.target.files[0]);
    e.target.value = '';
});
els.autosaveBtn.addEventListener('change', (e) => {
    if (e.target.checked) {
        showToast("Autosave to file enabled", "success");
    } else {
        showToast("Autosave to file disabled", "info");
    }
});

// Preview Drag Logic
let isDraggingPreview = false;
let dragStartX, dragStartY;
els.previewOverlay.addEventListener('mousedown', (e) => {
    if (e.target === els.previewText || e.target === els.closePreviewBtn) return; // Don't drag if clicking text or close btn
    isDraggingPreview = true;
    dragStartX = e.clientX - els.previewOverlay.offsetLeft;
    dragStartY = e.clientY - els.previewOverlay.offsetTop;
});
document.addEventListener('mousemove', (e) => {
    if (!isDraggingPreview) return;
    els.previewOverlay.style.left = (e.clientX - dragStartX) + 'px';
    els.previewOverlay.style.top = (e.clientY - dragStartY) + 'px';
    els.previewOverlay.style.transform = 'none'; // remove center transform once moved
});
document.addEventListener('mouseup', () => isDraggingPreview = false);

// Initialize UI
updateFontsList();

async function autosaveConfig() {
    if (els.autosaveBtn.checked) {
        await saveConfigToFile(true);
    }
}

async function saveConfigToFile(silent = false) {
    if (!window.showSaveFilePicker) {
        if (silent) return; // Cannot autosave silently without File System Access API
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

// --- View Config (JSON Viewer) ---

function renderJsonToHTML(data) {
    if (data === null) return `<span style="color:#94a3b8">null</span>`;
    if (typeof data === 'string') {
        let str = data;
        if (str.startsWith('data:') && str.length > 50) {
            str = str.substring(0, 50) + '... (truncated)';
        }
        return `<span style="color:#a3e635">"${str}"</span>`;
    }
    if (typeof data === 'number') return `<span style="color:#fb923c">${data}</span>`;
    if (typeof data === 'boolean') return `<span style="color:#f472b6">${data}</span>`;
    
    if (Array.isArray(data)) {
        if (data.length === 0) return `<span>[]</span>`;
        let html = `<span>[</span><div style="padding-left: 20px; border-left: 1px solid #444; margin-left: 5px;">`;
        data.forEach((item, i) => {
            html += `<div>${renderJsonToHTML(item)}${i < data.length - 1 ? ',' : ''}</div>`;
        });
        html += `</div><span>]</span>`;
        return html;
    }
    
    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return `<span>{}</span>`;
        
        let html = `<details open><summary style="cursor: pointer; user-select: none;">{</summary><div style="padding-left: 20px; border-left: 1px solid #444; margin-left: 5px;">`;
        keys.forEach((k, i) => {
            const val = data[k];
            html += `<div><span style="color:#38bdf8">"${k}"</span>: ${renderJsonToHTML(val)}${i < keys.length - 1 ? ',' : ''}</div>`;
        });
        html += `</div><span>}</span></details>`;
        return html;
    }
    return String(data);
}

function handleViewConfig() {
    els.jsonTree.innerHTML = renderJsonToHTML(state.config);
    els.jsonModal.style.display = 'flex';
}

// --- Phase 5: Exports ---

async function handleExportProject() {
    if (state.images.length === 0) return showToast("No project to save", "error");
    
    els.exportStatus.style.display = 'block';
    els.exportStatus.textContent = 'Packing project...';
    
    try {
        const zip = new window.JSZip();
        
        // Add config
        const configStr = JSON.stringify(state.config, null, 2);
        zip.file('config.json', configStr);
        
        // Add images
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

async function handleExportImages() {
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
            
            const img = card.loadedImg || await new Promise((resolve) => {
                const iObj = new Image();
                iObj.onload = () => resolve(iObj);
                iObj.src = card.blobUrl;
            });
            
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(img, 0, 0);
            
            const cardConfig = state.config.cards[card.name];
            if (cardConfig && cardConfig.texts) {
                cardConfig.texts.forEach(t => {
                    drawTextOnCanvas(offCtx, t, offCanvas.width, offCanvas.height);
                });
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

async function handleExportPdf() {
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
            
            const img = card.loadedImg || await new Promise((resolve) => {
                const iObj = new Image();
                iObj.onload = () => resolve(iObj);
                iObj.src = card.blobUrl;
            });
            
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(img, 0, 0);
            
            const cardConfig = state.config.cards[card.name];
            if (cardConfig && cardConfig.texts) {
                cardConfig.texts.forEach(t => {
                    drawTextOnCanvas(offCtx, t, offCanvas.width, offCanvas.height);
                });
            }
            
            const blob = await new Promise(res => offCanvas.toBlob(res, 'image/jpeg', 1.0));
            // Replace extension with jpg
            const newName = card.name.replace(/\.[^/.]+$/, "") + ".jpg";
            dataTransfer.items.add(new File([blob], newName, { type: 'image/jpeg' }));
        }
        
        // Send to Print Layout
        const plInput = document.getElementById('plFacesFileInput');
        if (plInput) {
            plInput.files = dataTransfer.files;
            plInput.dispatchEvent(new Event('change'));
            
            // Switch tab
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

function setPlaceholderState(html, isVisible = true) {
    const el = els.locPlaceholder || document.getElementById('locPlaceholder');
    if (!el) return;
    if (html) el.innerHTML = html;
    el.style.display = isVisible ? 'flex' : 'none';
}

async function handleFilesUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPlaceholderState('<p>Loading files...</p>');
    
    try {
        // Cleanup old blob URLs to prevent memory leaks
        state.images.forEach(img => URL.revokeObjectURL(img.blobUrl));
        state.images = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (file.name.toLowerCase().endsWith('.zip')) {
                // Handle ZIP file
                const zip = new window.JSZip();
                const loadedZip = await zip.loadAsync(file);
                
                // Try to load config.json if it exists
                if (loadedZip.files['config.json']) {
                    try {
                        const configText = await loadedZip.files['config.json'].async('string');
                        const configObj = JSON.parse(configText);
                        if (configObj.fonts && configObj.cards) {
                            state.config = configObj;
                            // Re-inject fonts
                            Object.keys(state.config.fonts).forEach(name => {
                                const f = state.config.fonts[name];
                                if (f.base64) injectFont(f.family, f.base64);
                            });
                            els.langSelect.value = state.config.currentLang || state.config.languages[0];
                            updateFontsList();
                        }
                    } catch (e) {
                        console.error("Failed to parse config.json from ZIP:", e);
                    }
                }
                
                for (const [filename, fileData] of Object.entries(loadedZip.files)) {
                    // Skip directories and non-images
                    if (fileData.dir || !filename.match(/\.(jpe?g|png|webp)$/i)) continue;
                    
                    const blob = await fileData.async('blob');
                    const blobUrl = URL.createObjectURL(blob);
                    const cleanName = filename.split('/').pop();
                    let savedRot = 0;
                    if (state.config.cards[cleanName] && state.config.cards[cleanName].rotation) {
                        savedRot = state.config.cards[cleanName].rotation;
                    }
                    state.images.push({ name: cleanName, blobUrl: blobUrl, rotation: savedRot });
                }
            } else if (file.type.startsWith('image/')) {
                // Handle direct image upload
                let savedRot = 0;
                if (state.config.cards[file.name] && state.config.cards[file.name].rotation) {
                    savedRot = state.config.cards[file.name].rotation;
                }
                const blobUrl = URL.createObjectURL(file);
                state.images.push({ name: file.name, blobUrl: blobUrl, rotation: savedRot });
            }
        }

        // Sort by filename alphabetically
        state.images.sort((a, b) => a.name.localeCompare(b.name));

        if (state.images.length === 0) {
            setPlaceholderState('<p style="color:red;">No valid images found in ZIP.</p>');
            return;
        }

        els.zipCount.textContent = `(${state.images.length} images)`;
        state.currentIndex = 0;
        
        setPlaceholderState(null, false);
        els.galleryContainer.style.display = 'flex';
        
        renderCurrentCard();
        
        if (Object.keys(state.config.cards).length > 0) {
            let matchCount = 0;
            state.images.forEach(img => {
                if (state.config.cards[img.name]) matchCount++;
            });
            if (matchCount > 0) {
                showToast(`Configuration applied to ${matchCount} out of ${state.images.length} files.`, "info");
            } else {
                showToast(`Loaded ${state.images.length} files. No matching configuration found.`, "info");
            }
        } else {
            showToast(`Loaded ${state.images.length} files successfully.`, "success");
        }

    } catch (error) {
        console.error("Error reading ZIP:", error);
        setPlaceholderState(`<p style="color:red;">Error reading ZIP: ${error.message}</p>`);
    }
}

function navigate(dir) {
    if (state.images.length === 0) return;
    
    autosaveConfig();
    
    state.currentIndex += dir;
    
    // Wrap around
    if (state.currentIndex < 0) state.currentIndex = state.images.length - 1;
    if (state.currentIndex >= state.images.length) state.currentIndex = 0;
    
    renderCurrentCard();
}

function handleRotate() {
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    card.rotation = ((card.rotation || 0) + 90) % 360;
    
    // Save to config
    if (!state.config.cards[card.name]) {
        state.config.cards[card.name] = { texts: [] };
    }
    state.config.cards[card.name].rotation = card.rotation;
    
    autosaveConfig();
    renderCurrentCard();
}

function renderCurrentCard() {
    if (state.images.length === 0) return;
    
    const card = state.images[state.currentIndex];
    
    // Update Labels
    els.cardName.textContent = card.name;
    els.currentIndexLabel.textContent = state.currentIndex + 1;
    els.totalCardsLabel.textContent = state.images.length;
    
    // Load image and draw to canvas
    const img = new Image();
    img.onload = () => {
        card.loadedImg = img;
        
        // CSS Rotation & Scaling
        const rot = card.rotation || 0;
        const isLandscape = rot === 90 || rot === 270;
        
        // Get available workspace size (add some padding)
        const maxW = els.workspace.clientWidth - 40;
        const maxH = els.workspace.clientHeight - 40;
        
        // Calculate the visual size of the container when rotated
        const contentW = isLandscape ? img.height : img.width;
        const contentH = isLandscape ? img.width : img.height;
        
        // Calculate scale to fit
        const scale = Math.min(maxW / contentW, maxH / contentH, 1);
        state.currentScale = scale;
        
        // Apply transform to the container
        els.rotationContainer.style.width = img.width + 'px';
        els.rotationContainer.style.height = img.height + 'px';
        els.rotationContainer.style.transform = `scale(${scale}) rotate(${rot}deg)`;
        
        redrawCanvas();
        renderOverlays();
    };
    img.src = card.blobUrl;
}

function redrawCanvas() {
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const img = card.loadedImg;
    if (!img) return;

    els.canvas.width = img.width;
    els.canvas.height = img.height;
    
    els.ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.ctx.drawImage(img, 0, 0);
    
    const cardConfig = state.config.cards[card.name];
    if (cardConfig) {
        if (cardConfig.patches) {
            cardConfig.patches.forEach(p => {
                drawPatchOnCanvas(els.ctx, p, els.canvas.width, els.canvas.height);
            });
        }
        if (cardConfig.texts) {
            cardConfig.texts.forEach(t => {
                drawTextOnCanvas(els.ctx, t, els.canvas.width, els.canvas.height);
            });
        }
    }
}

function drawPatchOnCanvas(ctx, p, canvasWidth, canvasHeight) {
    const pxX = (p.x / 100) * canvasWidth;
    const pxY = (p.y / 100) * canvasHeight;
    const pxW = (p.width / 100) * canvasWidth;
    const pxH = (p.height / 100) * canvasHeight;

    ctx.save();
    
    // Translate to the center of the patch for rotation
    const centerX = pxX + pxW / 2;
    const centerY = pxY + pxH / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((p.rotation || 0) * Math.PI / 180);
    ctx.translate(-pxW / 2, -pxH / 2); // Now origin is top-left of the box

    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillRect(0, 0, pxW, pxH);

    ctx.restore();
}

function getShrunkFontSize(ctx, textContent, font, pxW, pxH) {
    if (!textContent.trim() || !font) return font ? font.size : 20;
    let fontSize = font.size;
    const minFontSize = 4;
    while (fontSize >= minFontSize) {
        ctx.font = `${fontSize}px "${font.family}"`;
        const lines = calculateWordWrap(ctx, textContent, pxW);
        const totalHeight = lines.length * (fontSize * 1.2);
        if (totalHeight <= pxH) break;
        fontSize--;
    }
    return fontSize;
}

function calculateWordWrap(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word || ""; // safety
            }
        }
        lines.push(currentLine);
    });

    return lines;
}

function drawTextOnCanvas(ctx, t, canvasWidth, canvasHeight) {
    const lang = state.config.currentLang;
    const textContent = t.content[lang] || '';
    if (!textContent.trim()) return;

    const font = state.config.fonts[t.fontId];
    if (!font) return;

    const pxX = (t.x / 100) * canvasWidth;
    const pxY = (t.y / 100) * canvasHeight;
    const pxW = (t.width / 100) * canvasWidth;
    const pxH = (t.height / 100) * canvasHeight;

    ctx.save();
    
    // Translate to the center of the text box for rotation
    const centerX = pxX + pxW / 2;
    const centerY = pxY + pxH / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((t.rotation || 0) * Math.PI / 180);
    ctx.translate(-pxW / 2, -pxH / 2); // Now origin is top-left of the box

    const fontSize = getShrunkFontSize(ctx, textContent, font, pxW, pxH);
    ctx.font = `${fontSize}px "${font.family}"`;
    ctx.fillStyle = font.color || '#000';
    ctx.textBaseline = 'top';

    const lines = calculateWordWrap(ctx, textContent, pxW);
    const lineHeight = fontSize * 1.2;
    let currentY = 0; // Top aligned

    lines.forEach(line => {
        let textX = 0;
        const textWidth = ctx.measureText(line).width;
        
        const align = t.align || 'center';
        if (align === 'center') {
            textX = (pxW - textWidth) / 2;
        } else if (align === 'right') {
            textX = pxW - textWidth;
        } else {
            textX = 0; // left
        }

        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
    });

    ctx.restore();
}

// --- Phase 3: Text Overlays ---

function handleAddText() {
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    
    if (!state.config.cards[card.name]) {
        state.config.cards[card.name] = { texts: [] };
    }
    
    // Find the first available font, if any
    const availableFonts = Object.keys(state.config.fonts);
    const defaultFont = availableFonts.length > 0 ? availableFonts[0] : '';
    
    // Counter-rotate the spawn so it appears perfectly horizontal on screen
    const cardRot = card.rotation || 0;
    const spawnRot = (360 - cardRot) % 360;
    
    const newText = {
        id: 't_' + Date.now(),
        fontId: defaultFont,
        x: 30, // 30% from left
        y: 40, // 40% from top
        width: 40, // 40% width
        height: 10, // 10% height
        rotation: spawnRot,
        align: 'center',
        content: {}
    };
    
    state.config.cards[card.name].texts.push(newText);
    setActiveText(newText.id);
    autosaveConfig();
    renderOverlays();
    updateFontsList();
}

function handleAddPatch() {
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    
    if (!state.config.cards[card.name]) {
        state.config.cards[card.name] = { texts: [], patches: [] };
    }
    if (!state.config.cards[card.name].patches) {
        state.config.cards[card.name].patches = [];
    }
    
    const cardRot = card.rotation || 0;
    const spawnRot = (360 - cardRot) % 360;
    
    const newPatch = {
        id: 'p_' + Date.now(),
        x: 30,
        y: 40,
        width: 40,
        height: 10,
        rotation: spawnRot,
        color: els.patchColorPicker.value || '#ffffff'
    };
    
    state.config.cards[card.name].patches.push(newPatch);
    setActivePatch(newPatch.id);
    autosaveConfig();
    renderOverlays();
    redrawCanvas();
}

function setActiveText(id) {
    if (state.activeTextId === id && state.activePatchId === null) return;
    autosaveConfig();
    state.activeTextId = id;
    state.activePatchId = null;
    els.patchColorBtn.style.display = 'none';
    els.colorPaletteModal.style.display = 'none';
    
    updateOverlaysVisualState();
    updateFontsList();
}

function setActivePatch(id) {
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

function updateOverlaysVisualState() {
    const allOverlays = els.overlaysContainer.querySelectorAll('.loc-text-overlay, .loc-patch-overlay');
    allOverlays.forEach(el => {
        const id = el.dataset.id;
        const isActive = (id === state.activeTextId) || (id === state.activePatchId);
        const isPatch = el.classList.contains('loc-patch-overlay');
        
        if (isActive) {
            el.style.border = isPatch ? '2px solid #fd7e14' : '2px solid #007bff';
            el.style.boxShadow = isPatch ? '0 0 10px rgba(253, 126, 20, 0.5)' : '0 0 10px rgba(0, 123, 255, 0.5)';
            el.style.zIndex = '20';
        } else {
            el.style.border = isPatch ? '2px dashed #fd7e14' : '2px dashed #007bff';
            el.style.boxShadow = 'none';
            el.style.zIndex = isPatch ? '0' : '1';
        }
        
        el.querySelectorAll('.loc-handle').forEach(h => {
            if (h.classList.contains('loc-info-icon')) {
                h.style.display = isActive ? 'flex' : 'none';
            } else {
                h.style.display = isActive ? 'block' : 'none';
            }
        });
    });
}

function renderOverlays() {
    els.overlaysContainer.innerHTML = '';
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const cardConfig = state.config.cards[card.name];
    if (!cardConfig) return;
    
    // Render patches
    if (cardConfig.patches) {
        cardConfig.patches.forEach(p => {
            const isActive = p.id === state.activePatchId;
            const div = document.createElement('div');
            div.className = 'loc-patch-overlay';
            div.dataset.id = p.id;
            div.style.position = 'absolute';
            div.style.left = p.x + '%';
            div.style.top = p.y + '%';
            div.style.width = p.width + '%';
            div.style.height = p.height + '%';
            div.style.transform = `rotate(${p.rotation || 0}deg)`;
            div.style.border = isActive ? '2px solid #fd7e14' : '2px dashed #fd7e14';
            div.style.boxShadow = isActive ? '0 0 10px rgba(253, 126, 20, 0.5)' : 'none';
            div.style.zIndex = isActive ? '20' : '0';
            div.style.pointerEvents = 'auto';
            div.style.boxSizing = 'border-box';
            div.style.background = 'transparent';
            
            div.innerHTML = `
                <div class="loc-drag-handle loc-handle" style="position:absolute; top:-10px; left:-10px; width:20px; height:20px; background:#fd7e14; border-radius:50%; cursor:grab; z-index:10; display:${isActive?'block':'none'};" title="Drag"></div>
                <div class="loc-rotate-handle loc-handle" style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); width:20px; height:20px; background:orange; border-radius:50%; cursor:crosshair; z-index:10; display:${isActive?'block':'none'};" title="Rotate"></div>
                <div class="loc-resize-handle loc-handle" style="position:absolute; bottom:-10px; right:-10px; width:20px; height:20px; background:blue; border-radius:50%; cursor:nwse-resize; z-index:10; display:${isActive?'block':'none'};" title="Resize"></div>
                <button class="loc-del-patch loc-handle" style="position:absolute; top:-10px; right:-10px; width:20px; height:20px; background:red; color:white; border:none; border-radius:50%; cursor:pointer; z-index:10; display:${isActive?'block':'none'}; display: flex; align-items: center; justify-content: center; padding: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            
            div.addEventListener('mousedown', () => setActivePatch(p.id));
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
    
    if (cardConfig.texts) {
        cardConfig.texts.forEach(t => {
        const isActive = t.id === state.activeTextId;
        const div = document.createElement('div');
        div.className = 'loc-text-overlay';
        div.dataset.id = t.id;
        div.style.position = 'absolute';
        div.style.left = t.x + '%';
        div.style.top = t.y + '%';
        div.style.width = t.width + '%';
        div.style.height = t.height + '%';
        div.style.transform = `rotate(${t.rotation || 0}deg)`;
        div.style.border = isActive ? '2px solid #007bff' : '2px dashed #007bff';
        div.style.boxShadow = isActive ? '0 0 10px rgba(0, 123, 255, 0.5)' : 'none';
        div.style.zIndex = isActive ? '20' : '1';
        div.style.pointerEvents = 'auto'; // allow interaction
        div.style.boxSizing = 'border-box';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        
        const font = state.config.fonts[t.fontId];
        const fontFamily = font ? font.family : 'sans-serif';
        const fontColor = font ? font.color : '#000';
        const taAlign = t.align || 'center';
        
        const lang = state.config.currentLang;
        const textContent = t.content[lang] || '';
        
        const canvasW = els.canvas.width || 1000;
        const canvasH = els.canvas.height || 1000;
        const pxW = (t.width / 100) * canvasW;
        const pxH = (t.height / 100) * canvasH;
        const shrunkSize = getShrunkFontSize(els.ctx, textContent, font, pxW, pxH);
        
        const handleDisplay = isActive ? 'flex' : 'none';
        
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
            <div class="loc-drag-handle loc-handle" style="position:absolute; top:-10px; left:-10px; width:20px; height:20px; background:#007bff; border-radius:50%; cursor:grab; z-index:10; display:${isActive?'block':'none'};" title="Drag"></div>
            <div class="loc-rotate-handle loc-handle" style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); width:20px; height:20px; background:orange; border-radius:50%; cursor:crosshair; z-index:10; display:${isActive?'block':'none'};" title="Rotate"></div>
            <div class="loc-resize-handle loc-handle" style="position:absolute; bottom:-10px; right:-10px; width:20px; height:20px; background:blue; border-radius:50%; cursor:nwse-resize; z-index:10; display:${isActive?'block':'none'};" title="Resize"></div>
            
            <div class="loc-info-icon loc-handle" style="position:absolute; top:-10px; right:15px; width:20px; height:20px; background:#17a2b8; color:white; border-radius:50%; display:${handleDisplay}; align-items:center; justify-content:center; cursor:help; z-index:10;" title="${tooltipText.replace(/"/g, '&quot;')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            
            <button class="loc-del-text loc-handle" style="position:absolute; top:-10px; right:-10px; width:20px; height:20px; background:red; color:white; border:none; border-radius:50%; cursor:pointer; z-index:10; display:${isActive?'block':'none'}; display: flex; align-items: center; justify-content: center; padding: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <textarea style="flex:1; width:100%; height:100%; resize:none; background:transparent; border:none; outline:none; font-family:'${fontFamily}'; font-size:${shrunkSize}px; color:transparent; caret-color:#007bff; text-align:${taAlign}; box-sizing:border-box; padding:0; overflow:hidden;">${textContent}</textarea>
        `;
        
        // Listeners
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
            updateFontsList();
        });
        
        // Dragging Logic
        setupOverlayInteraction(div, t);
        
        els.overlaysContainer.appendChild(div);
        });
    }
}

function setupOverlayInteraction(el, t) {
    const dragHandle = el.querySelector('.loc-drag-handle');
    const resizeHandle = el.querySelector('.loc-resize-handle');
    const rotateHandle = el.querySelector('.loc-rotate-handle');
    
    let mode = null; // 'drag', 'resize', 'rotate'
    let startX, startY;
    let startW, startH;
    let startLeft, startTop;
    let startAngle;

    const startInteraction = (e, m) => {
        e.preventDefault();
        e.stopPropagation();
        mode = m;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = el.getBoundingClientRect();
        const parentRect = els.overlaysContainer.getBoundingClientRect();
        
        startLeft = t.x;
        startTop = t.y;
        startW = t.width;
        startH = t.height;
        startAngle = t.rotation || 0;
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    dragHandle.addEventListener('mousedown', (e) => startInteraction(e, 'drag'));
    resizeHandle.addEventListener('mousedown', (e) => startInteraction(e, 'resize'));
    rotateHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mode = 'rotate';
        const rect = el.getBoundingClientRect();
        // Center of the element in screen coordinates
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        startAngle = t.rotation || 0;
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    const onMove = (e) => {
        if (!mode) return;
        
        // Convert screen delta to container local scale
        const scale = state.currentScale || 1;
        
        // Determine rotation of the container to adjust mouse deltas
        const cardRot = state.images[state.currentIndex].rotation || 0;
        let dx = (e.clientX - startX) / scale;
        let dy = (e.clientY - startY) / scale;
        
        // Rotate delta vector backwards to match unrotated canvas coordinate system (for Drag)
        const rad = -cardRot * Math.PI / 180;
        const adjustedDx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const adjustedDy = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        // Calculate net rotation for Resize
        const netRot = cardRot + (t.rotation || 0);
        const radBox = -netRot * Math.PI / 180;
        const boxDx = dx * Math.cos(radBox) - dy * Math.sin(radBox);
        const boxDy = dx * Math.sin(radBox) + dy * Math.cos(radBox);
        
        if (mode === 'drag') {
            t.x = startLeft + (adjustedDx / els.canvas.width) * 100;
            t.y = startTop + (adjustedDy / els.canvas.height) * 100;
            el.style.left = t.x + '%';
            el.style.top = t.y + '%';
        } 
        else if (mode === 'resize') {
            t.width = Math.max(2, startW + (boxDx / els.canvas.width) * 100);
            t.height = Math.max(2, startH + (boxDy / els.canvas.height) * 100);
            el.style.width = t.width + '%';
            el.style.height = t.height + '%';
        }
        else if (mode === 'rotate') {
            const angle = Math.atan2(e.clientY - startY, e.clientX - startX) * 180 / Math.PI;
            // +90 because our rotate handle is at the TOP (which is -90deg in atan2)
            // Minus card rotation because container is already rotated!
            t.rotation = (angle + 90 - cardRot) % 360;
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

// --- Phase 2: Configuration & Fonts ---

async function handleAddFont() {
    const name = els.newFontName.value.trim();
    const size = els.newFontSize.value;
    const color = els.newFontColor.value;
    const file = els.newFontFile.files[0];

    if (!name) return showToast("Please enter a font style name.", "error");
    
    // Check if we are editing an existing font
    const isEditing = !!state.config.fonts[name];
    let base64 = isEditing ? state.config.fonts[name].base64 : null;
    let fontFamily = isEditing ? state.config.fonts[name].family : 'sans-serif';

    if (file) {
        // Convert new TTF/WOFF to base64
        base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        fontFamily = name; // Use the style name as font family
        
        // Inject font into document
        injectFont(fontFamily, base64);
    } else if (!isEditing) {
        fontFamily = name; // If no file and it's a new font, just use the name (e.g. system font like "Arial")
    }

    state.config.fonts[name] = {
        family: fontFamily,
        size: parseInt(size),
        color: color,
        base64: base64
    };

    // Reset inputs
    els.newFontName.value = '';
    els.newFontName.disabled = false;
    els.newFontFile.value = '';
    els.addFontBtn.textContent = "+ Add Font Style";
    
    autosaveConfig();
    updateFontsList();
    renderCurrentCard(); // If texts use this font, update canvas
}

async function handlePreviewFont() {
    const file = els.newFontFile.files[0];
    let fontFamily = els.newFontName.value.trim() || 'sans-serif';

    if (file) {
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        fontFamily = 'PreviewTempFont';
        injectFont(fontFamily, base64);
    }

    const lang = state.config.currentLang;
    if (lang === 'en') {
        els.previewText.innerText = "The quick brown fox jumps over the lazy dog\n0123456789";
    } else if (lang === 'ua') {
        els.previewText.innerText = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ\nабвгґдеєжзиіїйклмнопрстуфхцчшщьюя\n0123456789";
    } else {
        els.previewText.innerText = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ\nабвгдеёжзийклмнопрстуфхцчшщъыьэюя\n0123456789";
    }

    els.previewText.style.fontFamily = `"${fontFamily}"`;
    updatePreviewStyle();
    
    els.previewOverlay.style.display = 'block';
    // Reset position to center
    els.previewOverlay.style.left = '50%';
    els.previewOverlay.style.top = '50%';
    els.previewOverlay.style.transform = 'translate(-50%, -50%)';
}

function updatePreviewStyle() {
    if (els.previewOverlay.style.display === 'none') return;
    els.previewText.style.fontSize = els.newFontSize.value + "px";
    els.previewText.style.color = els.newFontColor.value;
}

function injectFont(familyName, base64Url) {
    if (!base64Url) return;
    const styleId = `font-${familyName}`;
    if (document.getElementById(styleId)) return; // Already injected
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @font-face {
            font-family: "${familyName}";
            src: url("${base64Url}");
        }
    `;
    document.head.appendChild(style);
}

function updateFontsList() {
    els.fontsList.innerHTML = '';
    const fontNames = Object.keys(state.config.fonts);
    
    const hasConfig = Object.keys(state.config.cards).length > 0 || fontNames.length > 0;
    els.viewConfigBtn.style.display = hasConfig ? 'block' : 'none';
    
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
        
        div.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding: 5px; font-family: "${f.family}"; color: ${f.color}; cursor: pointer; border: ${isActive ? '2px solid #007bff' : '1px solid transparent'}; background: ${isActive ? '#eef6ff' : 'transparent'}; border-radius: 4px; margin-bottom: 2px;`;
        
        div.innerHTML = `
            <span style="pointer-events:none; flex:1;"><b>${name}</b> (${f.size}px)</span>
            <div style="display: flex; gap: 5px;">
                <button class="loc-edit-font" data-name="${name}" style="background:none; border:none; cursor:pointer; color:#007bff; display: flex; align-items: center; justify-content: center; padding: 2px;" title="Edit Font">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="loc-del-font" data-name="${name}" style="color:red; background:none; border:none; cursor:pointer; display: flex; align-items: center; justify-content: center; padding: 2px;" title="Remove Font">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        
        // Click to apply font
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('loc-edit-font') || e.target.classList.contains('loc-del-font')) return;
            
            if (state.activeTextId && state.images.length > 0) {
                const card = state.images[state.currentIndex];
                const config = state.config.cards[card.name];
                if (config && config.texts) {
                    const txt = config.texts.find(t => t.id === state.activeTextId);
                    if (txt) {
                        txt.fontId = name;
                        renderOverlays();
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
            const fontObj = state.config.fonts[n];
            
            els.newFontName.value = n;
            els.newFontName.disabled = true; // Lock ID during edit
            els.newFontSize.value = fontObj.size;
            els.newFontColor.value = fontObj.color;
            els.newFontFile.value = ''; // Don't require re-uploading file
            els.addFontBtn.textContent = "Save Changes";
        });
        
        els.fontsList.appendChild(div);
    });
}

function renderPaletteModal() {
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
                const newColor = e.target.value;
                replaceAllPatchColors(color, newColor);
            });
            tempInput.click();
            els.colorPaletteModal.style.display = 'none';
        });
        
        wrap.appendChild(btn);
        wrap.appendChild(replaceBtn);
        els.paletteColorsContainer.appendChild(wrap);
    });
}

function replaceAllPatchColors(oldColor, newColor) {
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
    
    // Update palette
    if (state.config.patchPalette) {
        state.config.patchPalette = state.config.patchPalette.map(c => c === oldColor ? newColor : c);
        // Remove duplicates if newColor was already in palette
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

async function loadConfigFromFile(file) {
    if (!file) return;

    try {
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (!config.fonts || !config.cards) throw new Error("Invalid config format");
        
        state.config = config;
        
        // Re-inject fonts
        Object.keys(state.config.fonts).forEach(name => {
            const f = state.config.fonts[name];
            if (f.base64) injectFont(f.family, f.base64);
        });
        
        // Update UI
        els.langSelect.value = state.config.currentLang || state.config.languages[0];
        
        // Apply saved rotations to currently loaded images
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
        
        updateFontsList();
        renderCurrentCard();
    } catch (error) {
        console.error("Config import error:", error);
        showToast("Error loading config: " + error.message, "error");
    }
}
