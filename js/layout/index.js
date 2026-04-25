import { initUI, updateLanguage, showWarning } from './ui.js';
import { processFiles } from './files.js';
import { processImageToCanvas, checkRatioMismatch } from './canvas.js';
import { generatePDF } from './pdf.js';

let loadedFaces = [];
let loadedBacks = [];

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    
    const facesInput = document.getElementById('plFacesFileInput');
    const backInput = document.getElementById('plBackFileInput');
    const generateBtn = document.getElementById('plGenerateBtn');
    
    // Config values
    const getNum = (id) => parseFloat(document.getElementById(id).value) || 0;
    
    const getConfig = () => ({
        pageSize: document.getElementById('plPageSize').value,
        orientation: document.getElementById('plOrientation').value,
        pageBgColor: document.getElementById('plPageBgColor').value,
        cardWidth: getNum('plCardWidth'),
        cardHeight: getNum('plCardHeight'),
        margins: getNum('plPageMargins'),
        gap: getNum('plCardGaps'),
        bleedType: document.getElementById('plBleedType').value,
        bleedWidth: getNum('plBleedWidth'),
        bleedColor: document.getElementById('plBleedColor').value,
        cropMarks: document.getElementById('plCropMarks').value,
        cropColor: document.getElementById('plCropColor').value,
        backType: document.getElementById('plBackType').value
    });

    const checkProportions = () => {
        const config = getConfig();
        const allImages = [...loadedFaces, ...loadedBacks];
        const hasMismatch = checkRatioMismatch(allImages, config.cardWidth, config.cardHeight);
        showWarning(hasMismatch);
    };

    const updateGenerateBtn = () => {
        const config = getConfig();
        let ready = false;
        if (config.backType === 'same') {
            ready = loadedFaces.length > 0 && loadedBacks.length > 0;
        } else if (config.backType === 'different' || config.backType === 'none') {
            ready = loadedFaces.length > 0;
        }
        generateBtn.disabled = !ready;
    };

    facesInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        document.getElementById('plStatus').innerText = "Loading fronts...";
        loadedFaces = await processFiles(e.target.files);
        
        const config = getConfig();
        if (config.backType === 'different') {
            // Interleaved: Face, Back, Face, Back
            const faces = [];
            const backs = [];
            for (let i = 0; i < loadedFaces.length; i++) {
                if (i % 2 === 0) faces.push(loadedFaces[i]);
                else backs.push(loadedFaces[i]);
            }
            loadedFaces = faces;
            loadedBacks = backs;
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} pairs loaded`;
        } else {
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} files loaded`;
        }
        
        checkProportions();
        updateGenerateBtn();
        renderPreview();
        document.getElementById('plStatus').innerText = "";
    });

    backInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        document.getElementById('plStatus').innerText = "Loading back...";
        loadedBacks = await processFiles(e.target.files);
        document.getElementById('plBackFileCount').innerText = "1 file loaded";
        checkProportions();
        updateGenerateBtn();
        renderPreview();
        document.getElementById('plStatus').innerText = "";
    });

    const renderPreview = () => {
        const previewContainer = document.getElementById('plPreviewContainer');
        if (loadedFaces.length === 0) {
            previewContainer.innerHTML = '<p>Upload images to generate PDF</p>';
            previewContainer.style.background = 'transparent';
            previewContainer.style.border = '2px dashed #ccc';
            return;
        }

        const config = getConfig();
        let pageWidth, pageHeight;
        switch(config.pageSize) {
            case 'A4': pageWidth = 210; pageHeight = 297; break;
            case 'A3': pageWidth = 297; pageHeight = 420; break;
            case 'Letter': pageWidth = 215.9; pageHeight = 279.4; break;
            default: pageWidth = 210; pageHeight = 297;
        }
        if (config.orientation === 'landscape') {
            [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        // scale down to fit container width, assuming container is ~400-500px wide
        const scale = Math.min(500 / pageWidth, 800 / pageHeight); 
        
        previewContainer.innerHTML = '';
        previewContainer.style.border = 'none';
        previewContainer.style.background = '#e9ecef';
        previewContainer.style.display = 'flex';
        previewContainer.style.flexDirection = 'column';
        previewContainer.style.alignItems = 'center';
        previewContainer.style.justifyContent = 'center';

        const pageDiv = document.createElement('div');
        pageDiv.style.width = `${pageWidth * scale}px`;
        pageDiv.style.height = `${pageHeight * scale}px`;
        pageDiv.style.backgroundColor = config.pageBgColor;
        pageDiv.style.position = 'relative';
        pageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        pageDiv.style.overflow = 'hidden';

        const cardW = config.cardWidth;
        const cardH = config.cardHeight;
        const bleedW = config.bleedType !== 'none' ? config.bleedWidth : 0;
        const totalCardW = cardW + 2 * bleedW;
        const totalCardH = cardH + 2 * bleedW;
        const gap = config.gap;
        const margins = config.margins;
        
        const usableW = pageWidth - 2 * margins;
        const usableH = pageHeight - 2 * margins;
        
        const cols = Math.floor((usableW + gap) / (totalCardW + gap));
        const rows = Math.floor((usableH + gap) / (totalCardH + gap));
        
        if (cols === 0 || rows === 0) {
            pageDiv.innerHTML = '<p style="color:red;text-align:center;margin-top:50px;font-family:sans-serif;">Card size is too large for the page</p>';
        } else {
            const gridW = cols * totalCardW + (cols - 1) * gap;
            const gridH = rows * totalCardH + (rows - 1) * gap;
            const startX = (pageWidth - gridW) / 2;
            const startY = (pageHeight - gridH) / 2;

            const maxCards = cols * rows;
            for(let i=0; i < Math.min(loadedFaces.length, maxCards); i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const x = startX + col * (totalCardW + gap);
                const y = startY + row * (totalCardH + gap);

                const cardImg = document.createElement('img');
                cardImg.src = loadedFaces[i].img.src;
                cardImg.style.position = 'absolute';
                cardImg.style.left = `${x * scale}px`;
                cardImg.style.top = `${y * scale}px`;
                cardImg.style.width = `${totalCardW * scale}px`;
                cardImg.style.height = `${totalCardH * scale}px`;
                cardImg.style.objectFit = 'cover';
                if (config.bleedType === 'frame') {
                    cardImg.style.border = `${bleedW * scale}px solid ${config.bleedColor}`;
                    cardImg.style.boxSizing = 'border-box';
                }
                cardImg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
                
                pageDiv.appendChild(cardImg);
            }
        }
        
        previewContainer.appendChild(pageDiv);
    };

    const updateAll = () => {
        checkProportions();
        updateGenerateBtn();
        renderPreview();
    };

    // Recheck proportions and logic on inputs change
    const inputsToWatch = [
        'plCardWidth', 'plCardHeight', 'plBackType', 'plPageSize', 
        'plOrientation', 'plPageBgColor', 'plPageMargins', 'plCardGaps', 
        'plBleedType', 'plBleedWidth', 'plBleedColor'
    ];
    inputsToWatch.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
        if (el && el.type === 'number') el.addEventListener('input', updateAll);
    });

    generateBtn.addEventListener('click', async () => {
        const config = getConfig();
        const status = document.getElementById('plStatus');
        status.innerText = "Processing images...";
        generateBtn.disabled = true;
        
        try {
            // Target pixels at 300 DPI (300 dots per 25.4 mm)
            const dpi = 300;
            const pxPerMm = dpi / 25.4;
            const extraBleed = config.bleedType !== 'none' ? config.bleedWidth : 0;
            
            const targetW_px = Math.round((config.cardWidth + 2 * extraBleed) * pxPerMm);
            const targetH_px = Math.round((config.cardHeight + 2 * extraBleed) * pxPerMm);
            
            const bleedSettings = {
                type: config.bleedType,
                widthPx: Math.round(extraBleed * pxPerMm),
                color: config.bleedColor
            };

            const processedFaces = loadedFaces.map(img => processImageToCanvas(img, targetW_px, targetH_px, bleedSettings));
            const processedBacks = loadedBacks.map(img => processImageToCanvas(img, targetW_px, targetH_px, bleedSettings));

            const pdfBytes = await generatePDF(processedFaces, processedBacks, config, (msg) => {
                status.innerText = msg;
            });
            
            status.innerText = "Downloading...";
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `print-layout-${new Date().getTime()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            
            status.innerText = "Done!";
            setTimeout(() => { status.innerText = ""; }, 3000);
        } catch (err) {
            console.error(err);
            status.innerText = `Error: ${err.message}`;
        }
        
        generateBtn.disabled = false;
    });
});
