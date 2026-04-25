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
    const cropColor = hexToRgb(config.cropColor);

    const drawCropMarks = (page) => {
        if (config.cropMarks === 'none') return;
        
        const pt = (mm) => mm * MM_TO_PT;
        const lineLen = 3; 
        const offset = 0; 
        
        for (let r = 0; r <= rows; r++) {
            const y = startY + r * totalCardH + (r > 0 ? (r - 1) * gap + gap : 0);
            const pdfY = pt(pageHeight - y);
            for (let c = 0; c <= cols; c++) {
                const x = startX + c * totalCardW + (c > 0 ? (c - 1) * gap + gap : 0);
                const pdfX = pt(x);
                
                if (config.cropMarks === 'lines') {
                    if (r === 0 || r === rows) {
                        page.drawLine({ start: { x: pdfX, y: pt(pageHeight) }, end: { x: pdfX, y: 0 }, thickness: 0.5, color: cropColor, opacity: 0.3 });
                    }
                    if (c === 0 || c === cols) {
                        page.drawLine({ start: { x: 0, y: pdfY }, end: { x: pt(pageWidth), y: pdfY }, thickness: 0.5, color: cropColor, opacity: 0.3 });
                    }
                } else if (config.cropMarks === 'crosses') {
                    page.drawLine({ start: { x: pdfX - pt(offset+lineLen), y: pdfY }, end: { x: pdfX - pt(offset), y: pdfY }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfX + pt(offset), y: pdfY }, end: { x: pdfX + pt(offset+lineLen), y: pdfY }, thickness: 0.5, color: cropColor });
                    
                    page.drawLine({ start: { x: pdfX, y: pdfY - pt(offset+lineLen) }, end: { x: pdfX, y: pdfY - pt(offset) }, thickness: 0.5, color: cropColor });
                    page.drawLine({ start: { x: pdfX, y: pdfY + pt(offset) }, end: { x: pdfX, y: pdfY + pt(offset+lineLen) }, thickness: 0.5, color: cropColor });
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
            
            frontPage.drawImage(pdfImage, {
                x: x * MM_TO_PT,
                y: (pageHeight - y - totalCardH) * MM_TO_PT,
                width: totalCardW * MM_TO_PT,
                height: totalCardH * MM_TO_PT
            });
        }
        
        drawCropMarks(frontPage);
        
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
                    backPage.drawImage(pdfImage, {
                        x: x * MM_TO_PT,
                        y: (pageHeight - y - totalCardH) * MM_TO_PT,
                        width: totalCardW * MM_TO_PT,
                        height: totalCardH * MM_TO_PT
                    });
                }
            }
            drawCropMarks(backPage);
        }
        await new Promise(r => setTimeout(r, 10));
    }
    
    statusCallback(`Saving PDF...`);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
