
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
