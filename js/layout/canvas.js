export function processImageToCanvas(imageObj, targetWidthPx, targetHeightPx, bleedSettings) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidthPx;
    canvas.height = targetHeightPx;
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const { type, widthPx, color } = bleedSettings;
    
    if (type === 'frame') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);
        ctx.drawImage(imageObj.img, widthPx, widthPx, targetWidthPx - 2 * widthPx, targetHeightPx - 2 * widthPx);
    } 
    else if (type === 'mirror') {
        const innerW = targetWidthPx - 2 * widthPx;
        const innerH = targetHeightPx - 2 * widthPx;
        
        ctx.drawImage(imageObj.img, widthPx, widthPx, innerW, innerH);
        
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
        ctx.drawImage(imageObj.img, 0, 0, targetWidthPx, targetHeightPx);
    }
    
    return canvas.toDataURL('image/jpeg', 0.9);
}

export function checkRatioMismatch(images, cardWidthMm, cardHeightMm) {
    if (images.length === 0) return false;
    const targetRatio = cardWidthMm / cardHeightMm;
    for (let img of images) {
        const imgRatio = img.width / img.height;
        if (Math.abs(imgRatio - targetRatio) / targetRatio > 0.02) {
            return true;
        }
    }
    return false;
}
