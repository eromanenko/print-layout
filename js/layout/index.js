import { initUI, updateLanguage, showWarning } from './ui.js';
import { processFiles } from './files.js';
import { checkRatioMismatch } from './canvas.js';

let loadedFaces = [];
let loadedBacks = [];

const APP_VERSION = '1.0.0';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('appVersion').innerText = `v${APP_VERSION}`;
    initUI();
    
    const facesInput = document.getElementById('plFacesFileInput');
    const backInput = document.getElementById('plBackFileInput');
    const generateBtn = document.getElementById('plGenerateBtn');
    
    // Config values
    const getNum = (id) => parseFloat(document.getElementById(id).value) || 0;
    
    const getConfig = () => {
        const cardW = getNum('plCardWidth');
        const cardH = getNum('plCardHeight');
        const foldMarginStr = document.getElementById('plFoldMargin').value;
        const layoutMode = document.getElementById('plLayoutMode').value;
        
        return {
            pageSize: document.getElementById('plPageSize').value,
            orientation: document.getElementById('plOrientation').value,
            pageBgColor: document.getElementById('plPageBgColor').value,
            margins: parseFloat(document.getElementById('plPageMargins').value) || 0,
            gap: parseFloat(document.getElementById('plCardGaps').value) || 0,
            cardWidth: cardW,
            cardHeight: cardH,
            layoutMode: layoutMode,
            foldMargin: (layoutMode === 'foldable-v' || layoutMode === 'foldable-h') ? (parseFloat(foldMarginStr) || 0) : 0,
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
        };
    };

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
    
    document.getElementById('plLayoutMode').addEventListener('change', (e) => {
        const isFoldable = e.target.value === 'foldable-v' || e.target.value === 'foldable-h';
        document.getElementById('plFoldMarginContainer').style.display = isFoldable ? 'block' : 'none';
    });

    // Trigger change initially to set up correct visibility state
    document.getElementById('plLayoutMode').dispatchEvent(new Event('change'));

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
        
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'flex';
        previewContainer.style.flexDirection = 'row';
        previewContainer.style.flexWrap = 'wrap';
        previewContainer.style.alignItems = 'flex-start';
        previewContainer.style.justifyContent = 'center';
        previewContainer.style.gap = '30px';

        // scale down to fit container width. Make it slightly smaller so 2 pages can fit side-by-side
        const scale = Math.min(380 / pageWidth, 600 / pageHeight); 
        
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
        const foldMargin = config.foldMargin;
        const isFoldableV = config.layoutMode === 'foldable-v';
        const isFoldableH = config.layoutMode === 'foldable-h';
        const isFoldable = isFoldableV || isFoldableH;
        
        const usableW = isFoldableV ? (pageWidth / 2) - margins - foldMargin : pageWidth - 2 * margins;
        const usableH = isFoldableH ? (pageHeight / 2) - margins - foldMargin : pageHeight - 2 * margins;
        
        const cols = Math.floor((usableW + gap) / (totalCardW + gap));
        const rows = Math.floor((usableH + gap) / (totalCardH + gap));
        
        if (cols === 0 || rows === 0) {
            previewContainer.innerHTML = '<p style="color:red;text-align:center;margin-top:50px;font-family:sans-serif;width:100%;">Card size is too large for the page</p>';
            return;
        }

        const gridW = cols * totalCardW + (cols - 1) * gap;
        const gridH = rows * totalCardH + (rows - 1) * gap;
        const startX = isFoldableV ? (pageWidth / 2) - foldMargin - gridW : (pageWidth - gridW) / 2;
        const startY = isFoldableH ? (pageHeight / 2) - foldMargin - gridH : (pageHeight - gridH) / 2;

        const createPage = (isBack) => {
            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.display = 'flex';
            wrapperDiv.style.flexDirection = 'column';
            wrapperDiv.style.alignItems = 'center';
            wrapperDiv.style.gap = '10px';

            const title = document.createElement('h4');
            title.innerText = isFoldable ? 'Page 1 (Foldable: Front & Back)' : (isBack ? 'Page 2 (Backs)' : 'Page 1 (Fronts)');
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

            const svgNS = 'http://www.w3.org/2000/svg';
            const svgOverlay = document.createElementNS(svgNS, 'svg');
            svgOverlay.setAttribute('width', '100%');
            svgOverlay.setAttribute('height', '100%');
            svgOverlay.style.position = 'absolute';
            svgOverlay.style.top = '0';
            svgOverlay.style.left = '0';
            svgOverlay.style.pointerEvents = 'none';
            svgOverlay.style.zIndex = '20';
            pageDiv.appendChild(svgOverlay);

            if (isFoldableV) {
                const foldLine = document.createElement('div');
                foldLine.style.position = 'absolute';
                foldLine.style.left = `${(pageWidth / 2) * scale}px`;
                foldLine.style.top = '0';
                foldLine.style.bottom = '0';
                foldLine.style.width = '0';
                foldLine.style.borderLeft = '1px dashed rgba(0,0,0,0.4)';
                foldLine.style.zIndex = '10';
                pageDiv.appendChild(foldLine);
            } else if (isFoldableH) {
                const foldLine = document.createElement('div');
                foldLine.style.position = 'absolute';
                foldLine.style.top = `${(pageHeight / 2) * scale}px`;
                foldLine.style.left = '0';
                foldLine.style.right = '0';
                foldLine.style.height = '0';
                foldLine.style.borderTop = '1px dashed rgba(0,0,0,0.4)';
                foldLine.style.zIndex = '10';
                pageDiv.appendChild(foldLine);
            }

            const maxCards = cols * rows;
            
            const renderGrid = (renderBacks) => {
                for(let i=0; i < Math.min(loadedFaces.length, maxCards); i++) {
                    const row = Math.floor(i / cols);
                    const col = i % cols;

                    let x = startX + col * (totalCardW + gap);
                    let y = startY + row * (totalCardH + gap);
                    
                    if (renderBacks) {
                        if (isFoldableV || !isFoldable) {
                            x = pageWidth - x - totalCardW;
                        }
                        if (isFoldableH) {
                            y = pageHeight - y - totalCardH;
                        }
                    }

                    let imgSrc;
                    if (renderBacks) {
                        if (config.backType === 'same' && loadedBacks.length > 0) {
                            imgSrc = loadedBacks[0].img.src;
                        } else if (config.backType === 'different' && loadedBacks.length > 0) {
                            imgSrc = (loadedBacks[i] || loadedBacks[0]).img.src;
                        }
                    } else {
                        imgSrc = loadedFaces[i].img.src;
                    }

                    if (imgSrc) {
                        const sideBleedType = renderBacks ? config.back.bleedType : config.front.bleedType;
                        const sideBleedW = renderBacks ? backBleedW : frontBleedW;
                        const sideBleedColor = renderBacks ? config.back.bleedColor : config.front.bleedColor;
                        
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
                        
                        if (isFoldableH && renderBacks) {
                            cardImg.style.transform = 'rotate(180deg)';
                        }
                        
                        if (sideBleedType === 'frame') {
                            cardImg.style.border = `${sideBleedW * scale}px solid ${sideBleedColor}`;
                            cardImg.style.boxSizing = 'border-box';
                        }
                        cardImg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
                        pageDiv.appendChild(cardImg);
                    }
                }
            };
            
            const drawCropMarks = (drawForBacks) => {
                const sideConfig = drawForBacks ? config.back : config.front;
                
                const lineLen = 3 * scale; 
                const cropColor = sideConfig.cropColor;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        let cx = startX + col * (totalCardW + gap);
                        let cy = startY + row * (totalCardH + gap);
                        
                        if (drawForBacks) {
                            if (isFoldableV || !isFoldable) {
                                cx = pageWidth - cx - totalCardW;
                            }
                            if (isFoldableH) {
                                cy = pageHeight - cy - totalCardH;
                            }
                        }
                        
                        const cellX = cx * scale;
                        const cellY = cy * scale;

                        const left = cellX + maxBleedW * scale;
                        const right = cellX + (totalCardW - maxBleedW) * scale;
                        const top = cellY + maxBleedW * scale;
                        const bottom = cellY + (totalCardH - maxBleedW) * scale;
                        
                        // Draw dashed trim line for all cards to show safe area
                        const trimRect = document.createElementNS(svgNS, 'rect');
                        trimRect.setAttribute('x', left);
                        trimRect.setAttribute('y', top);
                        trimRect.setAttribute('width', right - left);
                        trimRect.setAttribute('height', bottom - top);
                        trimRect.setAttribute('fill', 'none');
                        trimRect.setAttribute('stroke', 'rgba(255, 0, 0, 0.4)');
                        trimRect.setAttribute('stroke-width', '1');
                        trimRect.setAttribute('stroke-dasharray', '4,4');
                        svgOverlay.appendChild(trimRect);

                        if (sideConfig.cropMarks === 'none') continue;

                        const addLine = (x1, y1, x2, y2) => {
                            const line = document.createElementNS(svgNS, 'line');
                            line.setAttribute('x1', x1);
                            line.setAttribute('y1', y1);
                            line.setAttribute('x2', x2);
                            line.setAttribute('y2', y2);
                            line.setAttribute('stroke', cropColor);
                            line.setAttribute('stroke-width', '1');
                            svgOverlay.appendChild(line);
                        };

                        if (sideConfig.cropMarks === 'lines') {
                            addLine(left, top - 1, left, top - 1 - lineLen);
                            addLine(left - 1, top, left - 1 - lineLen, top);
                            addLine(right, top - 1, right, top - 1 - lineLen);
                            addLine(right + 1, top, right + 1 + lineLen, top);
                            addLine(left, bottom + 1, left, bottom + 1 + lineLen);
                            addLine(left - 1, bottom, left - 1 - lineLen, bottom);
                            addLine(right, bottom + 1, right, bottom + 1 + lineLen);
                            addLine(right + 1, bottom, right + 1 + lineLen, bottom);
                        } else if (sideConfig.cropMarks === 'crosses') {
                            const corners = [
                                {x: left, y: top}, {x: right, y: top},
                                {x: left, y: bottom}, {x: right, y: bottom}
                            ];
                            corners.forEach(c => {
                                addLine(c.x - lineLen, c.y, c.x + lineLen, c.y);
                                addLine(c.x, c.y - lineLen, c.x, c.y + lineLen);
                            });
                        }
                    }
                }
            };

            // If standard, draw either front or back. If foldable, draw both front and back on the same page.
            if (isFoldable) {
                renderGrid(false); // Fronts
                drawCropMarks(false);
                if (config.backType !== 'none') {
                    renderGrid(true); // Backs
                    drawCropMarks(true);
                }
            } else {
                renderGrid(isBack);
                drawCropMarks(isBack);
            }

            wrapperDiv.appendChild(pageDiv);
            return wrapperDiv;
        };

        previewContainer.appendChild(createPage(false)); // Front Page (or Foldable page)
        if (!isFoldable && config.backType !== 'none') {
            previewContainer.appendChild(createPage(true));  // Back Page for standard duplex
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
        
        const toggleContainer = document.getElementById('plModeToggleContainer');
        if (toggleContainer) {
            toggleContainer.style.display = loadedFaces.length > 0 ? 'flex' : 'none';
        }
        
        renderPreview();
    };

    document.addEventListener('modeChange', renderPreview);

    // Recheck proportions and logic on inputs change
    const inputsToWatch = [
        'plPageSize', 'plOrientation', 'plPageMargins', 'plCardGaps',
        'plCardWidth', 'plCardHeight', 'plLayoutMode', 'plFoldMargin', 'plBackType',
        'plFrontBleedWidth', 'plFrontBleedType', 'plFrontBleedColor', 'plFrontCropMarks', 'plFrontCropColor',
        'plBackBleedWidth', 'plBackBleedType', 'plBackBleedColor', 'plBackCropMarks', 'plBackCropColor'
    ];
    const presetSelect = document.getElementById('plCardPreset');
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                const [w, h] = val.split(',').map(Number);
                document.getElementById('plCardWidth').value = w;
                document.getElementById('plCardHeight').value = h;
                updateAll();
            }
        });
    }

    inputsToWatch.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
        if (el && el.type === 'number') {
            el.addEventListener('input', () => {
                if ((id === 'plCardWidth' || id === 'plCardHeight') && presetSelect) {
                    presetSelect.value = '';
                }
                updateAll();
            });
        }
    });

    generateBtn.addEventListener('click', () => {
        const config = getConfig();
        const status = document.getElementById('plStatus');
        status.innerText = "Starting worker...";
        generateBtn.disabled = true;
        
        try {
            const worker = new Worker('js/layout/pdfWorker.js');
            
            worker.onmessage = (e) => {
                if (e.data.type === 'progress') {
                    status.innerText = e.data.message;
                } else if (e.data.type === 'done') {
                    status.innerText = "Downloading...";
                    const pdfBytes = e.data.payload;
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `print_layout_${Date.now()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    status.innerText = "Done!";
                    setTimeout(() => status.innerText = "", 3000);
                    generateBtn.disabled = false;
                    worker.terminate();
                } else if (e.data.type === 'error') {
                    console.error("Worker error:", e.data.error);
                    alert("Error generating PDF: " + e.data.error);
                    status.innerText = "Error";
                    generateBtn.disabled = false;
                    worker.terminate();
                }
            };
            
            worker.onerror = (err) => {
                console.error("Worker fatal error:", err);
                alert("Fatal error generating PDF.");
                status.innerText = "Error";
                generateBtn.disabled = false;
                worker.terminate();
            };
            
            const faceUrls = loadedFaces.map(f => f.img.src);
            const backUrls = loadedBacks.map(b => b.img.src);
            
            worker.postMessage({
                faces: faceUrls,
                backs: backUrls,
                config: config
            });
            
        } catch (e) {
            console.error(e);
            alert("Error starting worker: " + e.message);
            status.innerText = "Error";
            generateBtn.disabled = false;
        }
    });
    
    // Save Config
    document.getElementById('plSaveSettingsBtn').addEventListener('click', () => {
        const currentConfig = {
            version: APP_VERSION,
            config: getConfig()
        };
        const json = JSON.stringify(currentConfig, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `print-layout-settings-v${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Load Config
    const loadInput = document.getElementById('plLoadSettingsInput');
    document.getElementById('plLoadSettingsBtn').addEventListener('click', () => {
        loadInput.click();
    });

    loadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.version) {
                    alert('Invalid config file format.');
                    return;
                }
                if (data.version !== APP_VERSION) {
                    const proceed = confirm(`Warning: Config version (${data.version}) does not match current app version (${APP_VERSION}). Some settings might not load correctly. Proceed?`);
                    if (!proceed) return;
                }
                
                const cfg = data.config;
                if (!cfg) return;

                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el && val !== undefined) el.value = val;
                };

                setVal('plPageSize', cfg.pageSize);
                setVal('plOrientation', cfg.orientation);
                setVal('plPageBgColor', cfg.pageBgColor);
                setVal('plPageMargins', cfg.margins);
                setVal('plCardGaps', cfg.gap);
                setVal('plCardWidth', cfg.cardWidth);
                setVal('plCardHeight', cfg.cardHeight);
                setVal('plLayoutMode', cfg.layoutMode);
                setVal('plFoldMargin', cfg.foldMargin);
                setVal('plBackType', cfg.backType);
                
                if (cfg.front) {
                    setVal('plFrontBleedType', cfg.front.bleedType);
                    setVal('plFrontBleedWidth', cfg.front.bleedWidth);
                    setVal('plFrontBleedColor', cfg.front.bleedColor);
                    setVal('plFrontCropMarks', cfg.front.cropMarks);
                    setVal('plFrontCropColor', cfg.front.cropColor);
                }
                
                if (cfg.back) {
                    setVal('plBackBleedType', cfg.back.bleedType);
                    setVal('plBackBleedWidth', cfg.back.bleedWidth);
                    setVal('plBackBleedColor', cfg.back.bleedColor);
                    setVal('plBackCropMarks', cfg.back.cropMarks);
                    setVal('plBackCropColor', cfg.back.cropColor);
                }

                // Trigger change events to update UI visibility
                inputsToWatch.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.dispatchEvent(new Event('change'));
                });

            } catch (err) {
                alert('Failed to parse settings file.');
                console.error(err);
            }
            loadInput.value = '';
        };
        reader.readAsText(file);
    });
});
