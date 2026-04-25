export function initUI() {
    const bleedType = document.getElementById('plBleedType');
    const bleedSettings = document.getElementById('plBleedSettings');
    const bleedColorContainer = document.getElementById('plBleedColorContainer');

    bleedType.addEventListener('change', () => {
        if (bleedType.value === 'none') {
            bleedSettings.style.display = 'none';
        } else {
            bleedSettings.style.display = 'inline';
            bleedColorContainer.style.display = bleedType.value === 'frame' ? 'inline' : 'none';
        }
    });

    const cropMarks = document.getElementById('plCropMarks');
    const cropSettings = document.getElementById('plCropSettings');

    cropMarks.addEventListener('change', () => {
        cropSettings.style.display = cropMarks.value !== 'none' ? 'inline' : 'none';
    });

    const backType = document.getElementById('plBackType');
    const backUploadContainer = document.getElementById('plBackUploadContainer');

    backType.addEventListener('change', () => {
        if (backType.value === 'same') {
            backUploadContainer.style.display = 'flex';
        } else {
            backUploadContainer.style.display = 'none';
        }
        updateLanguage();
    });

    // Translation logic
    const langSelect = document.getElementById('plLangSelect');
    langSelect.addEventListener('change', updateLanguage);

    // Initial check
    bleedType.dispatchEvent(new Event('change'));
    cropMarks.dispatchEvent(new Event('change'));
    backType.dispatchEvent(new Event('change'));
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
