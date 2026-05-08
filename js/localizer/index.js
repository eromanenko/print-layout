import { showToast } from '../utils/toast.js';
import { state, els } from './state.js';
import { redrawCanvas, drawPatchOnCanvas, getShrunkFontSize, calculateWordWrap, drawTextOnCanvas } from './renderer.js';
import { setActiveText, setActivePatch, updateOverlaysVisualState, renderOverlays, setupOverlayInteraction } from './overlays.js';
import { setPlaceholderState, updateFontsList, updateLanguagesUI, handleAddLanguage, injectFont, resetFontForm, updatePreviewStyle, handleViewConfig, renderPaletteModal, replaceAllPatchColors, updateDeckManagerBadges, updateDeckControls } from './ui.js';
import { autosaveConfig, saveConfigToFile, loadConfigFromFile, handleFilesUpload, finalizeAppendUpload, handleExportProject, handleExportImages, handleExportPdf, handleDownloadCsvTemplate, handleDownloadXlsxTemplate, handleTableImport, handleExportCsvTable, handleExportXlsxTable } from './io.js';
import { loadOpenCV, scheduleInpaint, invalidateInpaintCache } from './inpaint.js';


// Listeners
els.pickZipBtn.addEventListener('click', () => els.zipInput.click());
els.zipInput.addEventListener('change', handleFilesUpload);
els.prevBtn.addEventListener('click', () => navigate(-1));
els.nextBtn.addEventListener('click', () => navigate(1));
els.rotateBtn.addEventListener('click', handleRotate);
els.addTextBtn.addEventListener('click', handleAddText);
els.alignLeftBtn.addEventListener('click', () => setAlignment('left'));
els.alignCenterBtn.addEventListener('click', () => setAlignment('center'));
els.alignRightBtn.addEventListener('click', () => setAlignment('right'));

els.confirmConflictBtn.addEventListener('click', finalizeAppendUpload);
els.cancelConflictBtn.addEventListener('click', () => {
    state.pendingUpload = null;
    els.conflictModal.style.display = 'none';
    els.zipInput.value = '';
    setPlaceholderState(null, state.images.length === 0);
});

els.manageDeckBtn.addEventListener('click', handleOpenDeckManager);
els.closeDeckManagerBtn.addEventListener('click', () => els.deckManagerModal.style.display = 'none');
document.getElementById('locCloseDeckManagerAlt').addEventListener('click', () => els.deckManagerModal.style.display = 'none');
els.saveDeckOrderBtn.addEventListener('click', handleSaveDeckOrder);

// Phase 8 + 13: Import/Export Table Listeners
els.importTableBtn.addEventListener('click', () => els.importModal.style.display = 'flex');
els.closeImportModal.addEventListener('click', () => els.importModal.style.display = 'none');
els.cancelImportBtn.addEventListener('click', () => els.importModal.style.display = 'none');
els.downloadCsvBtn.addEventListener('click', handleDownloadCsvTemplate);
els.downloadXlsxBtn.addEventListener('click', handleDownloadXlsxTemplate);
els.importDropzone.addEventListener('click', () => els.tableFileInput.click());
els.tableFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleTableImport(e.target.files[0]);
    e.target.value = '';
});

// Import/Export Tabs
els.tabImportBtn.addEventListener('click', () => {
    els.tabImportBtn.style.borderBottomColor = '#007bff';
    els.tabImportBtn.style.color = '#007bff';
    els.tabExportBtn.style.borderBottomColor = 'transparent';
    els.tabExportBtn.style.color = '#666';
    els.importTabContent.style.display = 'flex';
    els.exportTabContent.style.display = 'none';
});

els.tabExportBtn.addEventListener('click', () => {
    els.tabExportBtn.style.borderBottomColor = '#007bff';
    els.tabExportBtn.style.color = '#007bff';
    els.tabImportBtn.style.borderBottomColor = 'transparent';
    els.tabImportBtn.style.color = '#666';
    els.exportTabContent.style.display = 'flex';
    els.importTabContent.style.display = 'none';
});

// Export Texts
els.exportCsvBtn.addEventListener('click', handleExportCsvTable);
els.exportXlsxBtn.addEventListener('click', handleExportXlsxTable);


// Phase 11: Language Management Listeners
els.addLangBtn.addEventListener('click', () => {
    const code = prompt("Enter new language code (e.g. 'fr', 'de'):");
    if (code) handleAddLanguage(code);
});

// Drag & Drop for Import Modal
els.importDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.importDropzone.style.borderColor = '#3b82f6';
    els.importDropzone.style.background = '#eff6ff';
});
els.importDropzone.addEventListener('dragleave', () => {
    els.importDropzone.style.borderColor = '#cbd5e1';
    els.importDropzone.style.background = '#f8fafc';
});
els.importDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.importDropzone.style.borderColor = '#cbd5e1';
    els.importDropzone.style.background = '#f8fafc';
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
        handleTableImport(file);
    } else {
        showToast("Invalid file type. Please use .csv or .xlsx", "error");
    }
});

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
// Language switching is now handled by pills in updateLanguagesUI
els.addFontBtn.addEventListener('click', handleAddFont);
els.previewFontBtn.addEventListener('click', handlePreviewFont);
els.closePreviewBtn.addEventListener('click', () => els.previewOverlay.style.display = 'none');
els.newFontSize.addEventListener('input', updatePreviewStyle);
els.newFontColor.addEventListener('input', updatePreviewStyle);

els.pickFontFileBtn.addEventListener('click', () => els.newFontFile.click());
els.newFontFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        els.fontFileName.textContent = file.name;
    } else {
        els.fontFileName.textContent = 'No file selected';
    }
});

els.newFontItalic.addEventListener('change', updatePreviewStyle);

els.toggleFontFormBtn.addEventListener('click', () => {
    const isHidden = els.fontForm.style.display === 'none';
    els.fontForm.style.display = isHidden ? 'flex' : 'none';
    els.toggleFontFormIcon.innerHTML = isHidden 
        ? '<polyline points="18 15 12 9 6 15"></polyline>' // Chevron up
        : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'; // Plus
});

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

els.patchMode.addEventListener('change', (e) => {
    if (state.activePatchId && state.images.length > 0) {
        const cardConfig = state.config.cards[state.images[state.currentIndex].name];
        if (cardConfig && cardConfig.patches) {
            const patch = cardConfig.patches.find(p => p.id === state.activePatchId);
            if (patch) {
                patch.mode = e.target.value;
                els.patchColorBtn.style.display = patch.mode === 'solid' ? 'block' : 'none';
                els.patchBlurSlider.style.display = patch.mode === 'blur' ? 'block' : 'none';
                els.patchInpaintSensitivity.style.display = patch.mode === 'inpaint' ? 'block' : 'none';
                els.patchInpaintThickness.style.display = patch.mode === 'inpaint' ? 'block' : 'none';
                
                if (patch.mode === 'inpaint') {
                    loadOpenCV().then(() => {
                        const img = state.images[state.currentIndex].img;
                        scheduleInpaint(patch, img, els.canvas.width, els.canvas.height);
                    }).catch(err => {
                        showToast(err.message, "error");
                        patch.mode = 'solid';
                        els.patchMode.value = 'solid';
                        els.patchInpaintSensitivity.style.display = 'none';
                        els.patchInpaintThickness.style.display = 'none';
                        els.patchColorBtn.style.display = 'block';
                    });
                }
                
                renderOverlays();
                redrawCanvas();
                autosaveConfig();
            }
        }
    }
});

els.patchBlurSlider.addEventListener('input', (e) => {
    if (state.activePatchId && state.images.length > 0) {
        const cardConfig = state.config.cards[state.images[state.currentIndex].name];
        if (cardConfig && cardConfig.patches) {
            const patch = cardConfig.patches.find(p => p.id === state.activePatchId);
            if (patch && patch.mode === 'blur') {
                patch.blurRadius = parseInt(e.target.value);
                renderOverlays(); // update backdrop-filter live
                redrawCanvas();
                autosaveConfig();
            }
        }
    }
});

function handleInpaintSliderChange(e, propName) {
    if (state.activePatchId && state.images.length > 0) {
        const cardConfig = state.config.cards[state.images[state.currentIndex].name];
        if (cardConfig && cardConfig.patches) {
            const patch = cardConfig.patches.find(p => p.id === state.activePatchId);
            if (patch && patch.mode === 'inpaint') {
                patch[propName] = parseInt(e.target.value);
                const img = state.images[state.currentIndex].img;
                scheduleInpaint(patch, img, els.canvas.width, els.canvas.height);
                autosaveConfig();
            }
        }
    }
}

els.patchInpaintSensitivity.addEventListener('input', (e) => handleInpaintSliderChange(e, 'inpaintSensitivity'));
els.patchInpaintThickness.addEventListener('input', (e) => handleInpaintSliderChange(e, 'inpaintThickness'));

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
document.addEventListener('DOMContentLoaded', () => {
    updateFontsList();
    updateLanguagesUI();
});

els.workspace.addEventListener('mousedown', (e) => {
    // If the click is on the background, not on an overlay (overlays stop propagation)
    setActiveText(null);
    setActivePatch(null);
});

function navigate(dir) {
    if (state.images.length === 0) return;
    
    autosaveConfig();
    setActiveText(null);
    setActivePatch(null);
    
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

export function renderCurrentCard() {
    if (state.images.length === 0) return;
    
    const card = state.images[state.currentIndex];
    
    // Update Labels
    els.cardName.textContent = card.name;
    els.currentIndexLabel.textContent = state.currentIndex + 1;
    els.totalCardsLabel.textContent = state.images.length;
    
    // Load image and draw to canvas
    const img = new Image();
    img.onload = async () => {
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
        
        await redrawCanvas();
        await renderOverlays();
    };
    img.src = card.blobUrl;
}

// --- Renderer functions moved to ./renderer.js ---

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
        mode: els.patchMode.value || 'solid',
        color: els.patchColorPicker.value || '#ffffff',
        blurRadius: parseInt(els.patchBlurSlider.value) || 8,
        cloneDx: 10,
        cloneDy: 0
    };
    
    state.config.cards[card.name].patches.push(newPatch);
    setActivePatch(newPatch.id);
    autosaveConfig();
    renderOverlays();
    redrawCanvas();
}

// --- Overlay functions moved to ./overlays.js ---

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
        base64: base64,
        italic: els.newFontItalic.checked
    };

    // Reset inputs
    resetFontForm(true);
    
    autosaveConfig();
    updateFontsList();
    await renderCurrentCard(); // If texts use this font, update canvas
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
        els.previewText.innerText = "ÃƒÂÃ‚ÂÃƒÂÃ¢â‚¬ËœÃƒÂÃ¢â‚¬â„¢ÃƒÂÃ¢â‚¬Å“Ãƒâ€™Ã‚ÂÃƒÂÃ¢â‚¬ÂÃƒÂÃ¢â‚¬Â¢ÃƒÂÃ¢â‚¬Å¾ÃƒÂÃ¢â‚¬â€œÃƒÂÃ¢â‚¬â€ÃƒÂÃ‹Å“ÃƒÂÃ¢â‚¬Â ÃƒÂÃ¢â‚¬Â¡ÃƒÂÃ¢â€žÂ¢ÃƒÂÃ…Â¡ÃƒÂÃ¢â‚¬ÂºÃƒÂÃ…â€œÃƒÂÃ‚ÂÃƒÂÃ…Â¾ÃƒÂÃ…Â¸ÃƒÂÃ‚Â ÃƒÂÃ‚Â¡ÃƒÂÃ‚Â¢ÃƒÂÃ‚Â£ÃƒÂÃ‚Â¤ÃƒÂÃ‚Â¥ÃƒÂÃ‚Â¦ÃƒÂÃ‚Â§ÃƒÂÃ‚Â¨ÃƒÂÃ‚Â©ÃƒÂÃ‚Â¬ÃƒÂÃ‚Â®ÃƒÂÃ‚Â¯\nÃƒÂÃ‚Â°ÃƒÂÃ‚Â±ÃƒÂÃ‚Â²ÃƒÂÃ‚Â³Ãƒâ€™Ã¢â‚¬ËœÃƒÂÃ‚Â´ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â‚¬ÂÃƒÂÃ‚Â¶ÃƒÂÃ‚Â·ÃƒÂÃ‚Â¸Ãƒâ€˜Ã¢â‚¬â€œÃƒâ€˜Ã¢â‚¬â€ÃƒÂÃ‚Â¹ÃƒÂÃ‚ÂºÃƒÂÃ‚Â»ÃƒÂÃ‚Â¼ÃƒÂÃ‚Â½ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¿Ãƒâ€˜Ã¢â€šÂ¬Ãƒâ€˜Ã‚ÂÃƒâ€˜Ã¢â‚¬Å¡Ãƒâ€˜Ã†â€™Ãƒâ€˜Ã¢â‚¬Å¾Ãƒâ€˜Ã¢â‚¬Â¦Ãƒâ€˜Ã¢â‚¬Â Ãƒâ€˜Ã¢â‚¬Â¡Ãƒâ€˜Ã‹â€ Ãƒâ€˜Ã¢â‚¬Â°Ãƒâ€˜Ã…â€™Ãƒâ€˜Ã…Â½Ãƒâ€˜Ã‚Â\n0123456789";
    } else {
        els.previewText.innerText = "ÃƒÂÃ‚ÂÃƒÂÃ¢â‚¬ËœÃƒÂÃ¢â‚¬â„¢ÃƒÂÃ¢â‚¬Å“ÃƒÂÃ¢â‚¬ÂÃƒÂÃ¢â‚¬Â¢ÃƒÂÃ‚ÂÃƒÂÃ¢â‚¬â€œÃƒÂÃ¢â‚¬â€ÃƒÂÃ‹Å“ÃƒÂÃ¢â€žÂ¢ÃƒÂÃ…Â¡ÃƒÂÃ¢â‚¬ÂºÃƒÂÃ…â€œÃƒÂÃ‚ÂÃƒÂÃ…Â¾ÃƒÂÃ…Â¸ÃƒÂÃ‚Â ÃƒÂÃ‚Â¡ÃƒÂÃ‚Â¢ÃƒÂÃ‚Â£ÃƒÂÃ‚Â¤ÃƒÂÃ‚Â¥ÃƒÂÃ‚Â¦ÃƒÂÃ‚Â§ÃƒÂÃ‚Â¨ÃƒÂÃ‚Â©ÃƒÂÃ‚ÂªÃƒÂÃ‚Â«ÃƒÂÃ‚Â¬ÃƒÂÃ‚Â­ÃƒÂÃ‚Â®ÃƒÂÃ‚Â¯\nÃƒÂÃ‚Â°ÃƒÂÃ‚Â±ÃƒÂÃ‚Â²ÃƒÂÃ‚Â³ÃƒÂÃ‚Â´ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â‚¬ËœÃƒÂÃ‚Â¶ÃƒÂÃ‚Â·ÃƒÂÃ‚Â¸ÃƒÂÃ‚Â¹ÃƒÂÃ‚ÂºÃƒÂÃ‚Â»ÃƒÂÃ‚Â¼ÃƒÂÃ‚Â½ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¿Ãƒâ€˜Ã¢â€šÂ¬Ãƒâ€˜Ã‚ÂÃƒâ€˜Ã¢â‚¬Å¡Ãƒâ€˜Ã†â€™Ãƒâ€˜Ã¢â‚¬Å¾Ãƒâ€˜Ã¢â‚¬Â¦Ãƒâ€˜Ã¢â‚¬Â Ãƒâ€˜Ã¢â‚¬Â¡Ãƒâ€˜Ã‹â€ Ãƒâ€˜Ã¢â‚¬Â°Ãƒâ€˜Ã…Â Ãƒâ€˜Ã¢â‚¬Â¹Ãƒâ€˜Ã…â€™Ãƒâ€˜Ã‚ÂÃƒâ€˜Ã…Â½Ãƒâ€˜Ã‚Â\n0123456789";
    }

    els.previewText.style.fontFamily = `"${fontFamily}"`;
    await document.fonts.ready;
    updatePreviewStyle();
    
    els.previewOverlay.style.display = 'block';
    // Reset position to center
    els.previewOverlay.style.left = '50%';
    els.previewOverlay.style.top = '50%';
    els.previewOverlay.style.transform = 'translate(-50%, -50%)';
}


// --- Deck Manager & Reordering ---
let draggedItem = null;

function handleOpenDeckManager() {
    if (state.images.length === 0) return;
    
    els.deckManagerGrid.innerHTML = '';
    
    state.images.forEach((img, idx) => {
        const item = document.createElement('div');
        item.className = 'loc-deck-item';
        item.draggable = true;
        item.dataset.index = idx;
        
        item.style.cssText = '';
        item.className = 'loc-deck-item';
        item.draggable = true;
        item.dataset.index = idx;
        
        const thumb = document.createElement('div');
        thumb.className = 'loc-deck-thumb';
        thumb.style.backgroundImage = `url("${img.blobUrl}")`;
        
        const name = document.createElement('div');
        name.className = 'loc-deck-name';
        name.textContent = img.name;
        
        const badge = document.createElement('div');
        badge.className = 'loc-deck-badge';
        badge.textContent = idx + 1;
        
        item.appendChild(thumb);
        item.appendChild(name);
        item.appendChild(badge);
        
        // Drag Events
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', () => {
            draggedItem = null;
            item.classList.remove('dragging');
            els.deckManagerGrid.querySelectorAll('.loc-deck-item').forEach(i => i.classList.remove('drag-over'));
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (item !== draggedItem) item.classList.add('drag-over');
        });
        
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            if (item !== draggedItem) {
                const allItems = Array.from(els.deckManagerGrid.querySelectorAll('.loc-deck-item'));
                const draggedIdx = allItems.indexOf(draggedItem);
                const targetIdx = allItems.indexOf(item);
                
                if (draggedIdx < targetIdx) {
                    item.after(draggedItem);
                } else {
                    item.before(draggedItem);
                }
                
                updateDeckManagerBadges();
            }
        });
        
        els.deckManagerGrid.appendChild(item);
    });
    
    els.deckManagerModal.style.display = 'flex';
}


function handleSaveDeckOrder() {
    const items = Array.from(els.deckManagerGrid.querySelectorAll('.loc-deck-item'));
    const newOrder = items.map(item => {
        const oldIdx = parseInt(item.dataset.index);
        return state.images[oldIdx];
    });
    
    state.images = newOrder;
    state.currentIndex = 0; // Reset to first card
    
    els.deckManagerModal.style.display = 'none';
    renderCurrentCard();
    showToast("Deck order updated!", "success");
    autosaveConfig();
}

