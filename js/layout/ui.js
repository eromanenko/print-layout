export function initUI() {
    const setupBleedAndCrop = (side) => {
        const bleedType = document.getElementById(`pl${side}BleedType`);
        const bleedSettings = document.getElementById(`pl${side}BleedSettings`);
        const bleedColorContainer = document.getElementById(`pl${side}BleedColorContainer`);

        bleedType.addEventListener('change', () => {
            if (bleedType.value === 'none') {
                bleedSettings.style.display = 'none';
            } else {
                bleedSettings.style.display = 'inline';
                bleedColorContainer.style.display = bleedType.value === 'frame' ? 'inline' : 'none';
            }
        });

        const cropMarks = document.getElementById(`pl${side}CropMarks`);
        const cropSettings = document.getElementById(`pl${side}CropSettings`);

        cropMarks.addEventListener('change', () => {
            cropSettings.style.display = cropMarks.value !== 'none' ? 'inline' : 'none';
        });

        bleedType.dispatchEvent(new Event('change'));
        cropMarks.dispatchEvent(new Event('change'));
    };

    setupBleedAndCrop('Front');
    setupBleedAndCrop('Back');

    // Tab logic
    const tabBtns = document.querySelectorAll('.pl-side-tab');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = '#333';
            });
            btn.classList.add('active');
            btn.style.background = '#007bff';
            btn.style.color = 'white';

            document.getElementById('plSideContentFront').style.display = 'none';
            document.getElementById('plSideContentBack').style.display = 'none';
            
            const side = btn.getAttribute('data-side');
            document.getElementById(`plSideContent${side === 'front' ? 'Front' : 'Back'}`).style.display = 'block';
        });
    });

    // Initialize active tab
    const activeTabBtn = document.querySelector('.pl-side-tab.active');
    if (activeTabBtn) activeTabBtn.click();

    const backType = document.getElementById('plBackType');
    const backUploadContainer = document.getElementById('plBackUploadContainer');
    const backTabBtn = document.getElementById('plSideTabBackBtn');

    backType.addEventListener('change', () => {
        if (backType.value === 'same') {
            backUploadContainer.style.display = 'flex';
            backTabBtn.style.display = 'block';
        } else if (backType.value === 'different') {
            backUploadContainer.style.display = 'none';
            backTabBtn.style.display = 'block';
        } else {
            backUploadContainer.style.display = 'none';
            backTabBtn.style.display = 'none';
            if (backTabBtn.classList.contains('active')) {
                document.querySelector('.pl-side-tab[data-side="front"]').click();
            }
        }
        updateLanguage();
    });

    // Bleed sync logic
    let isBleedSynced = true;
    const frontBleedInput = document.getElementById('plFrontBleedWidth');
    const backBleedInput = document.getElementById('plBackBleedWidth');

    frontBleedInput.addEventListener('input', () => {
        if (isBleedSynced) {
            backBleedInput.value = frontBleedInput.value;
        }
    });

    backBleedInput.addEventListener('input', () => {
        isBleedSynced = false;
    });

    // Translation logic
    const langSelect = document.getElementById('plLangSelect');
    langSelect.addEventListener('change', updateLanguage);

    // Initial check
    backType.dispatchEvent(new Event('change'));

    // Preview mode toggle logic
    const modeBtns = document.querySelectorAll('#plPreviewModeToggle .mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            btn.dispatchEvent(new Event('modeChange', { bubbles: true }));
        });
    });
}

const translations = {
    en: {
        plInstructions: "<b>Print Layout Generator:</b> Upload card images to generate a ready-to-print PDF.",
        frontsSame: "Front Images (or ZIP):",
        frontsDiff: "Images (Interleaved: Front, Back, Front... or ZIP):",
        warnStretch: "⚠️ Warning: Image proportions do not match card size. Images will be stretched to fit.",
        btnGenerate: "Generate PDF"
    },
    ru: {
        plInstructions: "<b>Генератор раскладок для печати:</b> Загрузите изображения карт для создания готового к печати PDF.",
        frontsSame: "Изображения лиц (или ZIP):",
        frontsDiff: "Изображения (Чередуются: Лицо, Рубашка... или ZIP):",
        warnStretch: "⚠️ Внимание: Пропорции изображений не совпадают с заданным размером. Картинки будут растянуты.",
        btnGenerate: "Создать PDF"
    },
    ua: {
        plInstructions: "<b>Генератор розкладок для друку:</b> Завантажте зображення карт для створення готового до друку PDF.",
        frontsSame: "Зображення лиць (або ZIP):",
        frontsDiff: "Зображення (Черегуються: Лице, Рубашка... або ZIP):",
        warnStretch: "⚠️ Увага: Пропорції зображень не збігаються із заданим розміром. Картинки будуть розтягнуті.",
        btnGenerate: "Згенерувати PDF"
    }
};

export function updateLanguage() {
    const lang = document.getElementById('plLangSelect').value;
    const t = translations[lang];
    if (!t) return;
    
    document.getElementById('plInstructions').innerHTML = t.plInstructions;
    
    const backType = document.getElementById('plBackType').value;
    document.getElementById('plFrontsLabel').innerText = backType === 'different' ? t.frontsDiff : t.frontsSame;
    document.getElementById('plWarning').innerText = t.warnStretch;
    document.getElementById('plGenerateBtn').innerText = t.btnGenerate;
}

export function showWarning(show) {
    document.getElementById('plWarning').style.display = show ? 'block' : 'none';
}
