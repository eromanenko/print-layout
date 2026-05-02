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
    fileHandle: null
};

// UI Elements
const els = {
    zipInput: document.getElementById('locZipInput'),
    zipCount: document.getElementById('locZipCount'),
    galleryContainer: document.getElementById('locGalleryContainer'),
    emptyState: document.getElementById('locEmptyState'),
    canvas: document.getElementById('locCanvas'),
    ctx: document.getElementById('locCanvas').getContext('2d'),
    cardName: document.getElementById('locCardName'),
    currentIndexLabel: document.getElementById('locCurrentIndex'),
    totalCardsLabel: document.getElementById('locTotalCards'),
    prevBtn: document.getElementById('locPrevBtn'),
    nextBtn: document.getElementById('locNextBtn'),
    rotateBtn: document.getElementById('locRotateBtn'),
    addTextBtn: document.getElementById('locAddTextBtn'),
    
    // Workspace Elements
    workspace: document.getElementById('locWorkspace'),
    rotationContainer: document.getElementById('locRotationContainer'),
    overlaysContainer: document.getElementById('locOverlaysContainer'),
    
    // Phase 2 Elements
    loadConfigBtn: document.getElementById('locLoadConfigBtn'),
    configInput: document.getElementById('locConfigInput'),
    exportConfigBtn: document.getElementById('locExportConfigBtn'),
    autosaveBtn: document.getElementById('locAutosaveBtn'),
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

// Phase 2 Listeners
els.langSelect.addEventListener('change', (e) => {
    state.config.currentLang = e.target.value;
    renderOverlays(); // Just re-render overlays to switch text
});
els.addFontBtn.addEventListener('click', handleAddFont);
els.previewFontBtn.addEventListener('click', handlePreviewFont);
els.closePreviewBtn.addEventListener('click', () => els.previewOverlay.style.display = 'none');
els.newFontSize.addEventListener('input', updatePreviewStyle);
els.newFontColor.addEventListener('input', updatePreviewStyle);

els.exportConfigBtn.addEventListener('click', () => saveConfigToFile(false));

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

async function handleFilesUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    els.emptyState.innerHTML = '<p>Loading files...</p>';
    
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
                
                for (const [filename, fileData] of Object.entries(loadedZip.files)) {
                    // Skip directories and non-images
                    if (fileData.dir || !filename.match(/\.(jpe?g|png|webp)$/i)) continue;
                    
                    const blob = await fileData.async('blob');
                    const blobUrl = URL.createObjectURL(blob);
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
            els.emptyState.innerHTML = '<p style="color:red;">No valid images found in ZIP.</p>';
            return;
        }

        els.zipCount.textContent = `(${state.images.length} images)`;
        state.currentIndex = 0;
        
        els.emptyState.style.display = 'none';
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
        els.emptyState.innerHTML = `<p style="color:red;">Error reading ZIP: ${error.message}</p>`;
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
        // We always draw the image in its original unrotated state!
        els.canvas.width = img.width;
        els.canvas.height = img.height;
        
        els.ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        els.ctx.drawImage(img, 0, 0);
        
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
        
        renderOverlays();
    };
    img.src = card.blobUrl;
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
        content: {}
    };
    
    state.config.cards[card.name].texts.push(newText);
    state.activeTextId = newText.id;
    autosaveConfig();
    renderOverlays();
    updateFontsList();
}

function setActiveText(id) {
    if (state.activeTextId === id) return;
    autosaveConfig();
    state.activeTextId = id;
    
    // Update visuals without re-rendering to keep focus and caret intact
    const allOverlays = els.overlaysContainer.querySelectorAll('.loc-text-overlay');
    allOverlays.forEach(el => {
        const isActive = el.dataset.id === id;
        el.style.border = isActive ? '2px solid #007bff' : '2px dashed #007bff';
        el.style.boxShadow = isActive ? '0 0 10px rgba(0, 123, 255, 0.5)' : 'none';
        el.style.zIndex = isActive ? '20' : '1';
        
        el.querySelectorAll('.loc-handle').forEach(h => {
            h.style.display = isActive ? 'block' : 'none';
        });
    });
    
    updateFontsList();
}

function renderOverlays() {
    els.overlaysContainer.innerHTML = '';
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const cardConfig = state.config.cards[card.name];
    if (!cardConfig || !cardConfig.texts) return;
    
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
        const fontSize = font ? font.size : 20;
        const fontColor = font ? font.color : '#000';
        
        const lang = state.config.currentLang;
        const textContent = t.content[lang] || '';
        
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
            
            <div class="loc-info-icon loc-handle" style="position:absolute; top:-10px; right:15px; width:20px; height:20px; background:#17a2b8; color:white; border-radius:50%; display:${handleDisplay}; align-items:center; justify-content:center; font-size:12px; cursor:help; z-index:10; font-family:sans-serif; font-weight:bold; font-style:italic;" title="${tooltipText.replace(/"/g, '&quot;')}">i</div>
            
            <button class="loc-del-text loc-handle" style="position:absolute; top:-10px; right:-10px; width:20px; height:20px; background:red; color:white; border:none; border-radius:50%; cursor:pointer; font-size:12px; padding:0; z-index:10; display:${isActive?'block':'none'};">X</button>

            <textarea style="flex:1; width:100%; height:100%; resize:none; background:rgba(255,255,255,0.5); border:none; outline:none; font-family:'${fontFamily}'; font-size:${fontSize}px; color:${fontColor}; text-align:center; box-sizing:border-box; padding:5px; overflow:hidden;">${textContent}</textarea>
        `;
        
        // Listeners
        const ta = div.querySelector('textarea');
        ta.addEventListener('input', (e) => t.content[lang] = e.target.value);
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
    };

    const onUp = () => {
        mode = null;
        autosaveConfig();
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
            <div>
                <button class="loc-edit-font" data-name="${name}" style="background:none; border:none; cursor:pointer; color:#007bff; font-weight:bold; padding:0 5px;" title="Edit Font">Edit</button>
                <button class="loc-del-font" data-name="${name}" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold; padding:0 5px;" title="Remove Font">X</button>
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
