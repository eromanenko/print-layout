importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

const MM_TO_PT = 72 / 25.4;

const reportProgress = (msg) => {
    postMessage({ type: 'progress', message: msg });
};

async function processImageToCanvas(url, targetWidthPx, targetHeightPx, bleedSettings) {
    const res = await fetch(url);
    const blob = await res.blob();
    const imageBitmap = await createImageBitmap(blob);
    
    const canvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const { type, widthPx, color } = bleedSettings;
    
    if (type === 'frame') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);
        ctx.drawImage(imageBitmap, widthPx, widthPx, targetWidthPx - 2 * widthPx, targetHeightPx - 2 * widthPx);
    } 
    else if (type === 'mirror') {
        const innerW = targetWidthPx - 2 * widthPx;
        const innerH = targetHeightPx - 2 * widthPx;
        
        ctx.drawImage(imageBitmap, widthPx, widthPx, innerW, innerH);
        
        // Mirror Top
        ctx.save();
        ctx.translate(0, widthPx); 
        ctx.scale(1, -1);
        ctx.drawImage(canvas, widthPx, widthPx, innerW, widthPx, widthPx, 0, innerW, widthPx);
        ctx.restore();
        
        // Mirror Bottom
        ctx.save();
        ctx.translate(0, targetHeightPx - widthPx); 
        ctx.scale(1, -1);
        ctx.drawImage(canvas, widthPx, targetHeightPx - 2 * widthPx, innerW, widthPx, widthPx, -widthPx, innerW, widthPx);
        ctx.restore();

        // Mirror Left
        ctx.save();
        ctx.translate(widthPx, 0); 
        ctx.scale(-1, 1);
        ctx.drawImage(canvas, widthPx, widthPx, widthPx, innerH, 0, widthPx, widthPx, innerH);
        ctx.restore();

        // Mirror Right
        ctx.save();
        ctx.translate(targetWidthPx - widthPx, 0); 
        ctx.scale(-1, 1);
        ctx.drawImage(canvas, targetWidthPx - 2 * widthPx, widthPx, widthPx, innerH, -widthPx, widthPx, widthPx, innerH);
        ctx.restore();
        
        // Corners
        ctx.drawImage(canvas, widthPx, 0, widthPx, widthPx, 0, 0, widthPx, widthPx);
        ctx.drawImage(canvas, targetWidthPx - 2 * widthPx, 0, widthPx, widthPx, targetWidthPx - widthPx, 0, widthPx, widthPx);
        ctx.drawImage(canvas, widthPx, targetHeightPx - widthPx, widthPx, widthPx, 0, targetHeightPx - widthPx, widthPx, widthPx);
        ctx.drawImage(canvas, targetWidthPx - 2 * widthPx, targetHeightPx - widthPx, widthPx, widthPx, targetWidthPx - widthPx, targetHeightPx - widthPx, widthPx, widthPx);
        
    } else {
        // none
        ctx.drawImage(imageBitmap, 0, 0, targetWidthPx, targetHeightPx);
    }
    
    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const buffer = await outBlob.arrayBuffer();
    return new Uint8Array(buffer);
}

onmessage = async (e) => {
    try {
        const { faces, backs, config } = e.data;
        
        reportProgress("Processing images (this may take a moment)...");

        const dpi = 300;
        const pxPerMm = dpi / 25.4;
        const frontBleedW = config.front.bleedType !== 'none' ? config.front.bleedWidth : 0;
        const backBleedW = config.backType !== 'none' && config.back.bleedType !== 'none' ? config.back.bleedWidth : 0;
        
        const processSide = async (urls, bleedConf, bleedW) => {
            const targetW_px = Math.round((config.cardWidth + 2 * bleedW) * pxPerMm);
            const targetH_px = Math.round((config.cardHeight + 2 * bleedW) * pxPerMm);
            const settings = {
                type: bleedConf.bleedType,
                widthPx: Math.round(bleedW * pxPerMm),
                color: bleedConf.bleedColor
            };
            
            const processed = [];
            for (let i = 0; i < urls.length; i++) {
                if (urls[i]) {
                    const bytes = await processImageToCanvas(urls[i], targetW_px, targetH_px, settings);
                    processed.push(bytes);
                } else {
                    processed.push(null);
                }
            }
            return processed;
        };

        const processedFaces = await processSide(faces, config.front, frontBleedW);
        const processedBacks = await processSide(backs, config.back, backBleedW);

        reportProgress("Images processed. Generating PDF pages...");
        
        const pdfBytes = await generatePDF(processedFaces, processedBacks, config, reportProgress);
        
        postMessage({ type: 'done', payload: pdfBytes }, [pdfBytes.buffer]);
        
    } catch (error) {
        postMessage({ type: 'error', error: error.message });
    }
};

async function generatePDF(faces, backs, config, statusCallback) {
    const { PDFDocument, rgb } = self.PDFLib;
    const pdfDoc = await PDFDocument.create();
    
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
        throw new Error("Card size is too large for the page with current margins.");
    }
    
    const cardsPerPage = cols * rows;
    
    const gridW = cols * totalCardW + (cols - 1) * gap;
    const gridH = rows * totalCardH + (rows - 1) * gap;
    const startX = isFoldableV ? (pageWidth / 2) - foldMargin - gridW : (pageWidth - gridW) / 2;
    const startY = isFoldableH ? (pageHeight / 2) - foldMargin - gridH : (pageHeight - gridH) / 2;
    
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? rgb(
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ) : rgb(1, 1, 1);
    };

    const bgColor = hexToRgb(config.pageBgColor);

    const drawCropMarks = (page, isBack) => {
        const sideConfig = isBack ? config.back : config.front;
        if (sideConfig.cropMarks === 'none') return;
        
        const pt = (mm) => mm * MM_TO_PT;
        const lineLen = 3; 
        const cropColor = hexToRgb(sideConfig.cropColor);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let cx = startX + col * (totalCardW + gap);
                let cy = startY + row * (totalCardH + gap);
                
                if (isBack) {
                    if (isFoldableV || !isFoldable) {
                        cx = pageWidth - cx - totalCardW;
                    }
                    if (isFoldableH) {
                        cy = pageHeight - cy - totalCardH;
                    }
                }
                
                const cellX = cx;
                const cellY = cy;

                // Trim box bounds
                const left = cellX + maxBleedW;
                const right = cellX + totalCardW - maxBleedW;
                const top = cellY + maxBleedW;
                const bottom = cellY + totalCardH - maxBleedW;

                const pdfTop = pt(pageHeight - top);
                const pdfBottom = pt(pageHeight - bottom);
                const pdfLeft = pt(left);
                const pdfRight = pt(right);

                if (sideConfig.cropMarks === 'lines') {
                    // Top Left
                    page.drawLine({ start: { x: pdfLeft, y: pdfTop + pt(1) }, end: { x: pdfLeft, y: pdfTop + pt(1 + lineLen) }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfLeft - pt(1), y: pdfTop }, end: { x: pdfLeft - pt(1 + lineLen), y: pdfTop }, thickness: 0.5, color: cropColor });
                    // Top Right
                    page.drawLine({ start: { x: pdfRight, y: pdfTop + pt(1) }, end: { x: pdfRight, y: pdfTop + pt(1 + lineLen) }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfRight + pt(1), y: pdfTop }, end: { x: pdfRight + pt(1 + lineLen), y: pdfTop }, thickness: 0.5, color: cropColor });
                    // Bottom Left
                    page.drawLine({ start: { x: pdfLeft, y: pdfBottom - pt(1) }, end: { x: pdfLeft, y: pdfBottom - pt(1 + lineLen) }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfLeft - pt(1), y: pdfBottom }, end: { x: pdfLeft - pt(1 + lineLen), y: pdfBottom }, thickness: 0.5, color: cropColor });
                    // Bottom Right
                    page.drawLine({ start: { x: pdfRight, y: pdfBottom - pt(1) }, end: { x: pdfRight, y: pdfBottom - pt(1 + lineLen) }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfRight + pt(1), y: pdfBottom }, end: { x: pdfRight + pt(1 + lineLen), y: pdfBottom }, thickness: 0.5, color: cropColor });
                } else if (sideConfig.cropMarks === 'crosses') {
                    const corners = [
                        {x: pdfLeft, y: pdfTop}, {x: pdfRight, y: pdfTop},
                        {x: pdfLeft, y: pdfBottom}, {x: pdfRight, y: pdfBottom}
                    ];
                    corners.forEach(c => {
                        page.drawLine({ start: { x: c.x - pt(lineLen), y: c.y }, end: { x: c.x + pt(lineLen), y: c.y }, thickness: 0.5, color: cropColor });
                        page.drawLine({ start: { x: c.x, y: c.y - pt(lineLen) }, end: { x: c.x, y: c.y + pt(lineLen) }, thickness: 0.5, color: cropColor });
                    });
                }
            }
        }
    };

    let totalCards = faces.length;
    let pageCount = Math.ceil(totalCards / cardsPerPage);
    
    for (let p = 0; p < pageCount; p++) {
        if (isFoldable) {
            statusCallback(`Generating page ${p + 1} (Foldable: Fronts & Backs)`);
        } else {
            statusCallback(`Generating page ${config.backType !== 'none' ? p*2 + 1 : p + 1} (Fronts)`);
        }
        
        const frontPage = pdfDoc.addPage([pageWidth * MM_TO_PT, pageHeight * MM_TO_PT]);
        frontPage.drawRectangle({x:0, y:0, width: pageWidth * MM_TO_PT, height: pageHeight * MM_TO_PT, color: bgColor});
        
        if (isFoldableV) {
            frontPage.drawLine({
                start: { x: (pageWidth / 2) * MM_TO_PT, y: margins * MM_TO_PT },
                end: { x: (pageWidth / 2) * MM_TO_PT, y: (pageHeight - margins) * MM_TO_PT },
                thickness: 0.5,
                color: rgb(0.5, 0.5, 0.5),
                dashArray: [5, 5]
            });
        } else if (isFoldableH) {
            frontPage.drawLine({
                start: { x: margins * MM_TO_PT, y: (pageHeight / 2) * MM_TO_PT },
                end: { x: (pageWidth - margins) * MM_TO_PT, y: (pageHeight / 2) * MM_TO_PT },
                thickness: 0.5,
                color: rgb(0.5, 0.5, 0.5),
                dashArray: [5, 5]
            });
        }
        
        let startIdx = p * cardsPerPage;
        let endIdx = Math.min(startIdx + cardsPerPage, totalCards);
        
        const drawGrid = async (page, renderBacks) => {
            for (let i = startIdx; i < endIdx; i++) {
                const localIdx = i - startIdx;
                let row = Math.floor(localIdx / cols);
                let col = localIdx % cols;
                
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
                
                let imgBytes;
                if (renderBacks) {
                    if (config.backType === 'same') {
                        imgBytes = backs[0];
                    } else if (config.backType === 'different') {
                        imgBytes = backs[i] || backs[0];
                    }
                } else {
                    imgBytes = faces[i];
                }
                
                if (imgBytes) {
                    const pdfImage = await pdfDoc.embedJpg(imgBytes);
                    
                    const sideBleedW = renderBacks ? backBleedW : frontBleedW;
                    const drawW = cardW + 2 * sideBleedW;
                    const drawH = cardH + 2 * sideBleedW;
                    const offX = maxBleedW - sideBleedW;
                    const offY = maxBleedW - sideBleedW;

                    const drawOpts = {
                        x: (x + offX) * MM_TO_PT,
                        y: (pageHeight - (y + offY) - drawH) * MM_TO_PT,
                        width: drawW * MM_TO_PT,
                        height: drawH * MM_TO_PT
                    };
                    
                    if (isFoldableH && renderBacks) {
                        drawOpts.x += drawW * MM_TO_PT;
                        drawOpts.y += drawH * MM_TO_PT;
                        drawOpts.rotate = PDFLib.degrees(180);
                    }

                    page.drawImage(pdfImage, drawOpts);
                }
            }
            drawCropMarks(page, renderBacks);
        };
        
        await drawGrid(frontPage, false);
        
        if (isFoldable) {
            if (config.backType !== 'none') {
                await drawGrid(frontPage, true);
            }
        } else {
            if (config.backType !== 'none') {
                statusCallback(`Generating page ${p*2 + 2} (Backs)`);
                const backPage = pdfDoc.addPage([pageWidth * MM_TO_PT, pageHeight * MM_TO_PT]);
                backPage.drawRectangle({x:0, y:0, width: pageWidth * MM_TO_PT, height: pageHeight * MM_TO_PT, color: bgColor});
                await drawGrid(backPage, true);
            }
        }
    }
    
    statusCallback(`Saving PDF...`);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
