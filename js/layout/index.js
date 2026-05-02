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
        backType: document.getElementById('plBackType').value,
        front: {
            bleedType: document.getElementById('plFrontBleedType').value,
            bleedWidth: getNum('plFrontBleedWidth'),
            bleedColor: document.getElementById('plFrontBleedColor').value,
            cropMarks: document.getElementById('plFrontCropMarks').value,
            cropColor: document.getElementById('plFrontCropColor').value
        },
        back: {
            bleedType: document.getElementById('plBackBleedType').value,
            bleedWidth: getNum('plBackBleedWidth'),
            bleedColor: document.getElementById('plBackBleedColor').value,
            cropMarks: document.getElementById('plBackCropMarks').value,
            cropColor: document.getElementById('plBackCropColor').value
        }
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

    let previousBackType = document.getElementById('plBackType').value;
    
    document.getElementById('plBackType').addEventListener('change', (e) => {
        const newType = e.target.value;
        if (previousBackType === newType) return;
        
        const allCombined = [];
        if (previousBackType === 'different') {
            const maxLen = Math.max(loadedFaces.length, loadedBacks.length);
            for (let i = 0; i < maxLen; i++) {
                if (loadedFaces[i]) allCombined.push(loadedFaces[i]);
                if (loadedBacks[i]) allCombined.push(loadedBacks[i]);
            }
        } else {
            allCombined.push(...loadedFaces);
        }
        
        loadedFaces = [];
        loadedBacks = [];
        
        if (newType === 'different') {
            for (let i = 0; i < allCombined.length; i++) {
                if (i % 2 === 0) loadedFaces.push(allCombined[i]);
                else loadedBacks.push(allCombined[i]);
            }
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} pairs loaded`;
            document.getElementById('plBackFileCount').innerText = '';
        } else {
            loadedFaces = allCombined;
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} files loaded`;
            document.getElementById('plBackFileCount').innerText = '';
        }
        
        previousBackType = newType;
        // updateAll will be called naturally by the inputsToWatch listener
    });

    facesInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        document.getElementById('plStatus').innerText = "Loading fronts...";
        const newImages = await processFiles(e.target.files);
        
        const config = getConfig();
        if (config.backType === 'different') {
            // Interleaved: Face, Back, Face, Back
            for (let i = 0; i < newImages.length; i++) {
                if (i % 2 === 0) loadedFaces.push(newImages[i]);
                else loadedBacks.push(newImages[i]);
            }
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} pairs loaded`;
        } else {
            loadedFaces.push(...newImages);
            document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} files loaded`;
        }
        
        facesInput.value = ''; // Clear to allow re-uploading same file
        updateAll();
        document.getElementById('plStatus').innerText = "";
    });

    backInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        document.getElementById('plStatus').innerText = "Loading back...";
        loadedBacks = await processFiles(e.target.files); // Overwrite global back
        document.getElementById('plBackFileCount').innerText = "1 file loaded";
        
        backInput.value = '';
        updateAll();
        document.getElementById('plStatus').innerText = "";
    });

    const renderPreviewPairs = (previewContainer) => {
        const config = getConfig();
        previewContainer.innerHTML = '';
        previewContainer.style.border = 'none';
        previewContainer.style.background = 'transparent';
        previewContainer.style.display = 'flex';
        previewContainer.style.flexDirection = 'row';
        previewContainer.style.flexWrap = 'wrap';
        previewContainer.style.gap = '20px';
        previewContainer.style.alignItems = 'flex-start';
        previewContainer.style.justifyContent = 'center';
        
        const hasBacks = config.backType !== 'none';
        let draggedPairIndex = null;

        loadedFaces.forEach((face, i) => {
            const pairDiv = document.createElement('div');
            pairDiv.style.position = 'relative';
            pairDiv.style.display = 'flex';
            pairDiv.style.flexDirection = 'column';
            pairDiv.style.alignItems = 'center';
            pairDiv.style.gap = '8px';
            pairDiv.style.background = 'white';
            pairDiv.style.padding = '15px 10px 10px 10px';
            pairDiv.style.borderRadius = '8px';
            pairDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            pairDiv.style.border = '1px solid #ddd';

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '5px';
            closeBtn.style.right = '5px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#dc3545';
            closeBtn.style.fontSize = '14px';
            closeBtn.style.fontWeight = 'bold';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '0';
            closeBtn.style.lineHeight = '1';
            closeBtn.title = 'Delete Pair';
            closeBtn.onclick = () => {
                loadedFaces.splice(i, 1);
                if (hasBacks && config.backType === 'different') {
                    loadedBacks.splice(i, 1);
                }
                document.getElementById('plFacesFileCount').innerText = `${loadedFaces.length} items loaded`;
                updateAll();
            };
            pairDiv.appendChild(closeBtn);

            const title = document.createElement('div');
            title.innerText = `Pair ${i + 1}`;
            title.style.fontSize = '12px';
            title.style.fontWeight = 'bold';
            title.style.color = '#555';
            pairDiv.appendChild(title);

            const imgContainer = document.createElement('div');
            imgContainer.style.display = 'flex';
            imgContainer.style.gap = '5px';
            imgContainer.style.justifyContent = 'center';

            // Front image
            const frontImg = document.createElement('img');
            frontImg.src = face.img.src;
            frontImg.style.width = '80px';
            frontImg.style.height = 'auto';
            frontImg.style.objectFit = 'contain';
            frontImg.style.borderRadius = '4px';
            frontImg.style.border = '1px solid #eee';
            frontImg.title = 'Front';
            imgContainer.appendChild(frontImg);

            // Back image
            if (hasBacks) {
                let backSrc;
                if (config.backType === 'same' && loadedBacks.length > 0) {
                    backSrc = loadedBacks[0].img.src;
                } else if (config.backType === 'different' && loadedBacks.length > 0) {
                    backSrc = (loadedBacks[i] || loadedBacks[0]).img.src;
                }

                if (backSrc) {
                    const backImg = document.createElement('img');
                    backImg.src = backSrc;
                    backImg.style.width = '80px';
                    backImg.style.height = 'auto';
                    backImg.style.objectFit = 'contain';
                    backImg.style.borderRadius = '4px';
                    backImg.style.border = '1px solid #eee';
                    backImg.title = 'Back';
                    imgContainer.appendChild(backImg);
                }
            }

            pairDiv.appendChild(imgContainer);

            // Drag and drop reordering
            pairDiv.draggable = true;
            pairDiv.style.cursor = 'grab';

            pairDiv.addEventListener('dragstart', (e) => {
                draggedPairIndex = i;
                pairDiv.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                // Required for Firefox
                e.dataTransfer.setData('text/plain', i);
            });

            pairDiv.addEventListener('dragend', () => {
                pairDiv.style.opacity = '1';
                draggedPairIndex = null;
            });

            pairDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            pairDiv.addEventListener('dragenter', (e) => {
                e.preventDefault();
                pairDiv.style.boxShadow = '0 0 0 2px #007bff';
            });

            pairDiv.addEventListener('dragleave', () => {
                pairDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            });

            pairDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                pairDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                if (draggedPairIndex !== null && draggedPairIndex !== i) {
                    const movedFace = loadedFaces.splice(draggedPairIndex, 1)[0];
                    loadedFaces.splice(i, 0, movedFace);
                    
                    if (hasBacks && config.backType === 'different') {
                        const movedBack = loadedBacks.splice(draggedPairIndex, 1)[0];
                        loadedBacks.splice(i, 0, movedBack);
                    }
                    updateAll();
                }
            });

            previewContainer.appendChild(pairDiv);
        });
    };

    const renderPreviewLayout = (previewContainer) => {
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

        // scale down to fit container width. Make it slightly smaller so 2 pages can fit side-by-side
        const scale = Math.min(380 / pageWidth, 600 / pageHeight); 
        
        previewContainer.innerHTML = '';
        previewContainer.style.border = 'none';
        previewContainer.style.background = '#e9ecef';
        previewContainer.style.display = 'flex';
        previewContainer.style.flexDirection = 'row';
        previewContainer.style.flexWrap = 'wrap';
        previewContainer.style.alignItems = 'flex-start';
        previewContainer.style.justifyContent = 'center';
        previewContainer.style.gap = '30px';

        const cardW = config.cardWidth;
        const cardH = config.cardHeight;
        
        const frontBleedW = config.front.bleedType !== 'none' ? config.front.bleedWidth : 0;
        const backBleedW = config.backType !== 'none' && config.back.bleedType !== 'none' ? config.back.bleedWidth : 0;
        const maxBleedW = Math.max(frontBleedW, backBleedW);
        
        const totalCardW = cardW + 2 * maxBleedW;
        const totalCardH = cardH + 2 * maxBleedW;
        const gap = config.gap;
        const margins = config.margins;
        
        const usableW = pageWidth - 2 * margins;
        const usableH = pageHeight - 2 * margins;
        
        const cols = Math.floor((usableW + gap) / (totalCardW + gap));
        const rows = Math.floor((usableH + gap) / (totalCardH + gap));
        
        if (cols === 0 || rows === 0) {
            previewContainer.innerHTML = '<p style="color:red;text-align:center;margin-top:50px;font-family:sans-serif;width:100%;">Card size is too large for the page</p>';
            return;
        }

        const gridW = cols * totalCardW + (cols - 1) * gap;
        const gridH = rows * totalCardH + (rows - 1) * gap;
        const startX = (pageWidth - gridW) / 2;
        const startY = (pageHeight - gridH) / 2;

        const createPage = (isBack) => {
            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.display = 'flex';
            wrapperDiv.style.flexDirection = 'column';
            wrapperDiv.style.alignItems = 'center';
            wrapperDiv.style.gap = '10px';

            const title = document.createElement('h4');
            title.innerText = isBack ? 'Page 2 (Backs)' : 'Page 1 (Fronts)';
            title.style.margin = '0';
            title.style.fontFamily = 'sans-serif';
            title.style.color = '#333';
            wrapperDiv.appendChild(title);

            const pageDiv = document.createElement('div');
            pageDiv.style.width = `${pageWidth * scale}px`;
            pageDiv.style.height = `${pageHeight * scale}px`;
            pageDiv.style.backgroundColor = config.pageBgColor;
            pageDiv.style.position = 'relative';
            pageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            pageDiv.style.overflow = 'hidden';

            const maxCards = cols * rows;
            for(let i=0; i < Math.min(loadedFaces.length, maxCards); i++) {
                const row = Math.floor(i / cols);
                let col = i % cols;
                
                if (isBack) {
                    // Mirror column for back page print layout
                    col = (cols - 1) - col; 
                }

                const x = startX + col * (totalCardW + gap);
                const y = startY + row * (totalCardH + gap);

                let imgSrc;
                if (isBack) {
                    if (config.backType === 'same' && loadedBacks.length > 0) {
                        imgSrc = loadedBacks[0].img.src;
                    } else if (config.backType === 'different' && loadedBacks.length > 0) {
                        imgSrc = (loadedBacks[i] || loadedBacks[0]).img.src;
                    }
                } else {
                    imgSrc = loadedFaces[i].img.src;
                }

                if (imgSrc) {
                    const sideBleedType = isBack ? config.back.bleedType : config.front.bleedType;
                    const sideBleedW = isBack ? backBleedW : frontBleedW;
                    const sideBleedColor = isBack ? config.back.bleedColor : config.front.bleedColor;
                    
                    const drawW = cardW + 2 * sideBleedW;
                    const drawH = cardH + 2 * sideBleedW;
                    
                    const offsetX = maxBleedW - sideBleedW;
                    const offsetY = maxBleedW - sideBleedW;

                    const cardImg = document.createElement('img');
                    cardImg.src = imgSrc;
                    cardImg.style.position = 'absolute';
                    cardImg.style.left = `${(x + offsetX) * scale}px`;
                    cardImg.style.top = `${(y + offsetY) * scale}px`;
                    cardImg.style.width = `${drawW * scale}px`;
                    cardImg.style.height = `${drawH * scale}px`;
                    cardImg.style.objectFit = 'cover';
                    if (sideBleedType === 'frame') {
                        cardImg.style.border = `${sideBleedW * scale}px solid ${sideBleedColor}`;
                        cardImg.style.boxSizing = 'border-box';
                    }
                    cardImg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
                    pageDiv.appendChild(cardImg);
                }
            }

            wrapperDiv.appendChild(pageDiv);
            return wrapperDiv;
        };

        previewContainer.appendChild(createPage(false)); // Front Page
        if (config.backType !== 'none') {
            previewContainer.appendChild(createPage(true));  // Back Page
        }
    };

    const renderPreview = () => {
        const previewContainer = document.getElementById('plPreviewContainer');
        if (loadedFaces.length === 0) {
            previewContainer.innerHTML = '<p>Upload images to generate PDF</p>';
            previewContainer.style.background = 'transparent';
            previewContainer.style.border = '2px dashed #ccc';
            previewContainer.style.display = 'flex';
            return;
        }

        const modeBtn = document.querySelector('#plPreviewModeToggle .active');
        const mode = modeBtn ? modeBtn.getAttribute('data-mode') : 'pairs';

        if (mode === 'pairs') {
            renderPreviewPairs(previewContainer);
        } else {
            renderPreviewLayout(previewContainer);
        }
    };

    const updateAll = () => {
        checkProportions();
        updateGenerateBtn();
        renderPreview();
    };

    document.addEventListener('modeChange', renderPreview);

    // Recheck proportions and logic on inputs change
    const inputsToWatch = [
        'plCardWidth', 'plCardHeight', 'plBackType', 'plPageSize', 
        'plOrientation', 'plPageBgColor', 'plPageMargins', 'plCardGaps', 
        'plFrontBleedType', 'plFrontBleedWidth', 'plFrontBleedColor',
        'plFrontCropMarks', 'plFrontCropColor',
        'plBackBleedType', 'plBackBleedWidth', 'plBackBleedColor',
        'plBackCropMarks', 'plBackCropColor'
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
            const frontBleedW = config.front.bleedType !== 'none' ? config.front.bleedWidth : 0;
            const backBleedW = config.backType !== 'none' && config.back.bleedType !== 'none' ? config.back.bleedWidth : 0;
            
            const processSide = (images, bleedConf, bleedW) => {
                const targetW_px = Math.round((config.cardWidth + 2 * bleedW) * pxPerMm);
                const targetH_px = Math.round((config.cardHeight + 2 * bleedW) * pxPerMm);
                const settings = {
                    type: bleedConf.bleedType,
                    widthPx: Math.round(bleedW * pxPerMm),
                    color: bleedConf.bleedColor
                };
                return images.map(img => processImageToCanvas(img, targetW_px, targetH_px, settings));
            };

            const processedFaces = processSide(loadedFaces, config.front, frontBleedW);
            const processedBacks = processSide(loadedBacks, config.back, backBleedW);

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
