// ============================================================
// Localizer — Shared State & DOM Element References
// ============================================================

export const state = {
    images: [], // { name, blobUrl, rotation }
    currentIndex: 0,
    config: {
        version: "0.5.0",
        languages: ["en"],
        currentLang: "en",
        fonts: {}, // { "TitleFont": { family, size, color, base64 } }
        cards: {}
    },
    currentScale: 1,
    activeTextId: null,
    activePatchId: null,
    fileHandle: null,
    editingFontName: null,
    pendingUpload: null // { newImages, newConfig, conflicts }
};

export const els = {
    zipInput:              document.getElementById('locZipInput'),
    pickZipBtn:            document.getElementById('locPickZipBtn'),
    exportPdfBtn:          document.getElementById('locExportPdfBtn'),
    exportProjectBtn:      document.getElementById('locExportProjectBtn'),
    exportImagesBtn:       document.getElementById('locExportImagesBtn'),
    galleryContainer:      document.getElementById('locGalleryContainer'),
    locPlaceholder:        document.getElementById('locPlaceholder'),
    canvas:                document.getElementById('locCanvas'),
    ctx:                   document.getElementById('locCanvas').getContext('2d'),
    cardName:              document.getElementById('locCardName'),
    currentIndexLabel:     document.getElementById('locCurrentIndex'),
    totalCardsLabel:       document.getElementById('locTotalCards'),
    prevBtn:               document.getElementById('locPrevBtn'),
    nextBtn:               document.getElementById('locNextBtn'),
    rotateBtn:             document.getElementById('locRotateBtn'),
    addTextBtn:            document.getElementById('locAddTextBtn'),
    addPatchBtn:           document.getElementById('locAddPatchBtn'),
    patchColorBtn:         document.getElementById('locPatchColorBtn'),
    patchColorPicker:      document.getElementById('locPatchColorPicker'),
    colorPaletteModal:     document.getElementById('locColorPaletteModal'),
    paletteColorsContainer:document.getElementById('locPaletteColors'),
    palettePickNewBtn:     document.getElementById('locPalettePickNewBtn'),
    closePaletteBtn:       document.getElementById('locClosePaletteBtn'),
    alignLeftBtn:          document.getElementById('locAlignLeftBtn'),
    alignCenterBtn:        document.getElementById('locAlignCenterBtn'),
    alignRightBtn:         document.getElementById('locAlignRightBtn'),

    // Workspace
    workspace:             document.getElementById('locWorkspace'),
    rotationContainer:     document.getElementById('locRotationContainer'),
    overlaysContainer:     document.getElementById('locOverlaysContainer'),

    // Configuration
    loadConfigBtn:         document.getElementById('locLoadConfigBtn'),
    configInput:           document.getElementById('locConfigInput'),
    exportConfigBtn:       document.getElementById('locExportConfigBtn'),
    autosaveBtn:           document.getElementById('locAutosaveBtn'),
    viewConfigBtn:         document.getElementById('locViewConfigBtn'),
    exportStatus:          document.getElementById('locExportStatus'),

    // JSON Modal
    jsonModal:             document.getElementById('locJsonModal'),
    closeJsonModal:        document.getElementById('locCloseJsonModal'),
    jsonTree:              document.getElementById('locJsonTree'),

    // Font Manager
    fontsList:             document.getElementById('locFontsList'),
    newFontName:           document.getElementById('locNewFontName'),
    newFontFile:           document.getElementById('locNewFontFile'),
    newFontSize:           document.getElementById('locNewFontSize'),
    newFontColor:          document.getElementById('locNewFontColor'),
    addFontBtn:            document.getElementById('locAddFontBtn'),
    previewFontBtn:        document.getElementById('locPreviewFontBtn'),
    previewOverlay:        document.getElementById('locFontPreviewOverlay'),
    previewText:           document.getElementById('locFontPreviewText'),
    closePreviewBtn:       document.getElementById('locClosePreviewBtn'),
    toggleFontFormBtn:     document.getElementById('locToggleFontFormBtn'),
    toggleFontFormIcon:    document.getElementById('locToggleFontFormIcon'),
    fontForm:              document.getElementById('locFontForm'),
    pickFontFileBtn:       document.getElementById('locPickFontFileBtn'),
    fontFileName:          document.getElementById('locFontFileName'),
    newFontItalic:         document.getElementById('locNewFontItalic'),

    // Conflict Modal
    conflictModal:         document.getElementById('locConflictModal'),
    conflictList:          document.getElementById('locConflictList'),
    confirmConflictBtn:    document.getElementById('locConfirmConflict'),
    cancelConflictBtn:     document.getElementById('locCancelConflict'),

    // Deck Manager
    manageDeckBtn:         document.getElementById('locManageDeckBtn'),
    deckManagerModal:      document.getElementById('locDeckManagerModal'),
    deckManagerGrid:       document.getElementById('locDeckManagerGrid'),
    closeDeckManagerBtn:   document.getElementById('locCloseDeckManager'),
    saveDeckOrderBtn:      document.getElementById('locSaveDeckOrder'),
    closeDeckManagerAltBtn:document.getElementById('locCloseDeckManagerAlt'),

    // Import Table
    importTableBtn:        document.getElementById('locImportTableBtn'),
    importModal:           document.getElementById('locImportModal'),
    closeImportModal:      document.getElementById('locCloseImportModal'),
    cancelImportBtn:       document.getElementById('locCancelImport'),
    downloadCsvBtn:        document.getElementById('locDownloadCsvTemplate'),
    downloadXlsxBtn:       document.getElementById('locDownloadXlsxTemplate'),
    importDropzone:        document.getElementById('locImportDropzone'),
    tableFileInput:        document.getElementById('locTableFileInput'),
    tabImportBtn:          document.getElementById('locTabImportBtn'),
    tabExportBtn:          document.getElementById('locTabExportBtn'),
    importTabContent:      document.getElementById('locImportTabContent'),
    exportTabContent:      document.getElementById('locExportTabContent'),
    importReplaceTexts:    document.getElementById('locImportReplaceTexts'),
    exportCsvBtn:          document.getElementById('locExportCsvBtn'),
    exportXlsxBtn:         document.getElementById('locExportXlsxBtn'),

    // Language Management
    langList:              document.getElementById('locLangList'),
    addLangBtn:            document.getElementById('locAddLangBtn'),
    langSelect:            document.getElementById('locLangSelect'), // legacy, unused
};
