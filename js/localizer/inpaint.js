import { state, els } from './state.js';
import { redrawCanvas } from './renderer.js';
import { autosaveConfig } from './io.js';

export function loadOpenCV() {
    return new Promise((resolve, reject) => {
        if (state.cvLoaded) {
            resolve();
            return;
        }
        if (state.cvLoading) {
            // Already loading, just wait
            const check = setInterval(() => {
                if (state.cvLoaded) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            return;
        }

        state.cvLoading = true;
        els.inpaintLoading.style.display = 'block';

        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        script.async = true;
        
        script.onload = () => {
            const checkCv = setInterval(() => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    clearInterval(checkCv);
                    state.cvLoaded = true;
                    state.cvLoading = false;
                    els.inpaintLoading.style.display = 'none';
                    resolve();
                } else if (typeof cv !== 'undefined' && cv.onRuntimeInitialized === undefined) {
                    cv.onRuntimeInitialized = () => {
                        clearInterval(checkCv);
                        state.cvLoaded = true;
                        state.cvLoading = false;
                        els.inpaintLoading.style.display = 'none';
                        resolve();
                    };
                }
            }, 100);
        };
        
        script.onerror = () => {
            state.cvLoading = false;
            els.inpaintLoading.style.display = 'none';
            reject(new Error("Failed to load OpenCV.js"));
        };
        
        document.body.appendChild(script);
    });
}

let inpaintTimeouts = {};

export function scheduleInpaint(p, img, canvasW, canvasH) {
    if (!state.cvLoaded) return;
    
    if (inpaintTimeouts[p.id]) clearTimeout(inpaintTimeouts[p.id]);
    
    // Debounce to prevent freezing UI during rapid changes
    inpaintTimeouts[p.id] = setTimeout(() => {
        runInpaint(p, img, canvasW, canvasH);
        delete inpaintTimeouts[p.id];
    }, 300);
}

export function invalidateInpaintCache(patchId) {
    if (state.inpaintCache[patchId]) {
        delete state.inpaintCache[patchId];
    }
}

function runInpaint(p, img, canvasW, canvasH) {
    if (!cv || !state.cvLoaded || !img) return;

    // Convert % coordinates to pixels
    const pxX = (p.x / 100) * canvasW;
    const pxY = (p.y / 100) * canvasH;
    const pxW = (p.width / 100) * canvasW;
    const pxH = (p.height / 100) * canvasH;

    // We add padding around the patch to give OpenCV context for inpainting
    const padding = 20; 
    
    const startX = Math.floor(Math.max(0, pxX - padding));
    const startY = Math.floor(Math.max(0, pxY - padding));
    const endX = Math.ceil(Math.min(canvasW, pxX + pxW + padding));
    const endY = Math.ceil(Math.min(canvasH, pxY + pxH + padding));
    
    const roiW = endX - startX;
    const roiH = endY - startY;
    
    if (roiW <= 0 || roiH <= 0) return;

    // Extract ROI from the original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roiW;
    tempCanvas.height = roiH;
    const tCtx = tempCanvas.getContext('2d');
    
    // For rotation, wait, if the patch is rotated, the ROI needs to be a bounding box of the rotated patch
    // To keep it simple, we just extract an axis-aligned bounding box that contains the rotated patch.
    // For now, let's just do an unrotated bounding box.
    
    // Calculate bounding box of the rotated patch
    let minX = pxX, minY = pxY, maxX = pxX + pxW, maxY = pxY + pxH;
    
    if (p.rotation) {
        const cx = pxX + pxW/2;
        const cy = pxY + pxH/2;
        const rad = p.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const pts = [
            [-pxW/2, -pxH/2],
            [pxW/2, -pxH/2],
            [pxW/2, pxH/2],
            [-pxW/2, pxH/2]
        ];
        
        let xs = [], ys = [];
        for (let pt of pts) {
            const rx = pt[0] * cos - pt[1] * sin;
            const ry = pt[0] * sin + pt[1] * cos;
            xs.push(cx + rx);
            ys.push(cy + ry);
        }
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
    }
    
    const rStartX = Math.floor(Math.max(0, minX - padding));
    const rStartY = Math.floor(Math.max(0, minY - padding));
    const rEndX = Math.ceil(Math.min(canvasW, maxX + padding));
    const rEndY = Math.ceil(Math.min(canvasH, maxY + padding));
    
    const rRoiW = rEndX - rStartX;
    const rRoiH = rEndY - rStartY;

    if (rRoiW <= 0 || rRoiH <= 0) return;

    tempCanvas.width = rRoiW;
    tempCanvas.height = rRoiH;

    tCtx.drawImage(img, rStartX, rStartY, rRoiW, rRoiH, 0, 0, rRoiW, rRoiH);
    const imageData = tCtx.getImageData(0, 0, rRoiW, rRoiH);

    try {
        let srcRgba = cv.matFromImageData(imageData);
        let src = new cv.Mat();
        cv.cvtColor(srcRgba, src, cv.COLOR_RGBA2RGB, 0);
        let gray = new cv.Mat();
        cv.cvtColor(srcRgba, gray, cv.COLOR_RGBA2GRAY, 0);

    // Apply Canny Edge Detection
    let edges = new cv.Mat();
    // sensitivity from 10 to 200, mapped to threshold.
    // Lower slider value = more edges detected.
    let thresh1 = p.inpaintSensitivity || 50;
    let thresh2 = thresh1 * 3;
    cv.Canny(gray, edges, thresh1, thresh2);

    // Apply Dilation to cover the text fully
    let mask = new cv.Mat();
    let thickness = p.inpaintThickness || 5;
    let M = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(thickness, thickness));
    cv.dilate(edges, mask, M, new cv.Point(-1, -1), 1);

    // Actually limit the mask to ONLY the patch area, so we don't inpaint outside the patch!
    // We only want to erase text INSIDE the patch.
    // We draw the patch polygon onto a mask matrix using HTML5 Canvas!
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = rRoiW;
    maskCanvas.height = rRoiH;
    const mCtx = maskCanvas.getContext('2d');
    
    // Fill black
    mCtx.fillStyle = 'black';
    mCtx.fillRect(0, 0, rRoiW, rRoiH);
    
    // Draw white rotated patch
    mCtx.save();
    mCtx.translate(pxX + pxW/2 - rStartX, pxY + pxH/2 - rStartY);
    if (p.rotation) mCtx.rotate(p.rotation * Math.PI / 180);
    mCtx.fillStyle = 'white';
    mCtx.fillRect(-pxW/2, -pxH/2, pxW, pxH);
    mCtx.restore();
    
    const maskImageData = mCtx.getImageData(0, 0, rRoiW, rRoiH);
    let patchMaskRgba = cv.matFromImageData(maskImageData);
    let patchMask = new cv.Mat();
    cv.cvtColor(patchMaskRgba, patchMask, cv.COLOR_RGBA2GRAY, 0);
    
    // Intersect edge mask with patch mask
    cv.bitwise_and(mask, patchMask, mask);

    // Inpaint
    let dst = new cv.Mat();
    cv.inpaint(src, mask, dst, 3, cv.INPAINT_TELEA);

    // Convert back to canvas
    cv.imshow(tempCanvas, dst);
    
    // Save to cache
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = rRoiW;
    cachedCanvas.height = rRoiH;
    cachedCanvas.getContext('2d').drawImage(tempCanvas, 0, 0);
    
    state.inpaintCache[p.id] = {
        canvas: cachedCanvas,
        x: rStartX,
        y: rStartY
    };

        // Cleanup
        srcRgba.delete(); src.delete(); gray.delete(); edges.delete(); mask.delete(); M.delete(); dst.delete();
        patchMaskRgba.delete(); patchMask.delete();

        // Trigger re-render to show the inpainted result
        redrawCanvas();
    } catch (err) {
        console.error("OpenCV inpaint error:", err);
    }
}
