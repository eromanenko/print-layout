const MM_TO_PT = 72 / 25.4;

export async function generatePDF(faces, backs, config, statusCallback) {
    const { PDFDocument, rgb } = window.PDFLib;
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
    
    const usableW = pageWidth - 2 * margins;
    const usableH = pageHeight - 2 * margins;
    
    const cols = Math.floor((usableW + gap) / (totalCardW + gap));
    const rows = Math.floor((usableH + gap) / (totalCardH + gap));
    
    if (cols === 0 || rows === 0) {
        throw new Error("Card size is too large for the page with current margins.");
    }
    
    const cardsPerPage = cols * rows;
    
    const gridW = cols * totalCardW + (cols - 1) * gap;
    const gridH = rows * totalCardH + (rows - 1) * gap;
    const startX = (pageWidth - gridW) / 2;
    const startY = (pageHeight - gridH) / 2;
    
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
                const cellX = startX + col * (totalCardW + gap);
                const cellY = startY + row * (totalCardH + gap);

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
        statusCallback(`Generating page ${config.backType !== 'none' ? p*2 + 1 : p + 1} (Fronts)`);
        const frontPage = pdfDoc.addPage([pageWidth * MM_TO_PT, pageHeight * MM_TO_PT]);
        frontPage.drawRectangle({x:0, y:0, width: pageWidth * MM_TO_PT, height: pageHeight * MM_TO_PT, color: bgColor});
        
        let startIdx = p * cardsPerPage;
        let endIdx = Math.min(startIdx + cardsPerPage, totalCards);
        
        for (let i = startIdx; i < endIdx; i++) {
            const localIdx = i - startIdx;
            const row = Math.floor(localIdx / cols);
            const col = localIdx % cols;
            
            const x = startX + col * (totalCardW + gap);
            const y = startY + row * (totalCardH + gap);
            
            const imgBase64 = faces[i];
            const pdfImage = await pdfDoc.embedJpg(imgBase64);
            
            const drawW = cardW + 2 * frontBleedW;
            const drawH = cardH + 2 * frontBleedW;
            const offsetX = maxBleedW - frontBleedW;
            const offsetY = maxBleedW - frontBleedW;

            frontPage.drawImage(pdfImage, {
                x: (x + offsetX) * MM_TO_PT,
                y: (pageHeight - (y + offsetY) - drawH) * MM_TO_PT,
                width: drawW * MM_TO_PT,
                height: drawH * MM_TO_PT
            });
        }
        
        drawCropMarks(frontPage, false);
        
        if (config.backType !== 'none') {
            statusCallback(`Generating page ${p*2 + 2} (Backs)`);
            const backPage = pdfDoc.addPage([pageWidth * MM_TO_PT, pageHeight * MM_TO_PT]);
            backPage.drawRectangle({x:0, y:0, width: pageWidth * MM_TO_PT, height: pageHeight * MM_TO_PT, color: bgColor});
            
            for (let i = startIdx; i < endIdx; i++) {
                const localIdx = i - startIdx;
                const row = Math.floor(localIdx / cols);
                const mirrorCol = (cols - 1) - (localIdx % cols);
                
                const x = startX + mirrorCol * (totalCardW + gap);
                const y = startY + row * (totalCardH + gap);
                
                let backImgBase64;
                if (config.backType === 'same') {
                    backImgBase64 = backs[0];
                } else if (config.backType === 'different') {
                    backImgBase64 = backs[i] || backs[0];
                }
                
                if (backImgBase64) {
                    const pdfImage = await pdfDoc.embedJpg(backImgBase64);
                    
                    const drawW = cardW + 2 * backBleedW;
                    const drawH = cardH + 2 * backBleedW;
                    const offsetX = maxBleedW - backBleedW;
                    const offsetY = maxBleedW - backBleedW;

                    backPage.drawImage(pdfImage, {
                        x: (x + offsetX) * MM_TO_PT,
                        y: (pageHeight - (y + offsetY) - drawH) * MM_TO_PT,
                        width: drawW * MM_TO_PT,
                        height: drawH * MM_TO_PT
                    });
                }
            }
            drawCropMarks(backPage, true);
        }
        await new Promise(r => setTimeout(r, 10));
    }
    
    statusCallback(`Saving PDF...`);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
