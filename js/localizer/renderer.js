// ============================================================
// Localizer — Canvas Renderer
// Handles all canvas drawing: image, patches, text blocks.
// ============================================================

import { state, els } from './state.js';

export async function redrawCanvas() {
    await document.fonts.ready;
    if (state.images.length === 0) return;
    const card = state.images[state.currentIndex];
    const img = card.loadedImg;
    if (!img) return;

    els.canvas.width = img.width;
    els.canvas.height = img.height;

    els.ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.ctx.drawImage(img, 0, 0);

    const cardConfig = state.config.cards[card.name];
    if (cardConfig) {
        if (cardConfig.patches) {
            cardConfig.patches.forEach(p => {
                drawPatchOnCanvas(els.ctx, p, els.canvas.width, els.canvas.height, img);
            });
        }
        if (cardConfig.texts) {
            cardConfig.texts.forEach(t => {
                drawTextOnCanvas(els.ctx, t, els.canvas.width, els.canvas.height);
            });
        }
    }
}

export function drawPatchOnCanvas(ctx, p, canvasWidth, canvasHeight, img) {
    const pxX = (p.x / 100) * canvasWidth;
    const pxY = (p.y / 100) * canvasHeight;
    const pxW = (p.width / 100) * canvasWidth;
    const pxH = (p.height / 100) * canvasHeight;

    ctx.save();
    const mode = p.mode || 'solid';
    const rot = (p.rotation || 0) * Math.PI / 180;
    
    // Translate to center of patch for rotation
    ctx.translate(pxX + pxW / 2, pxY + pxH / 2);
    ctx.rotate(rot);

    if (mode === 'solid') {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.fillRect(-pxW / 2, -pxH / 2, pxW, pxH);
    } else if ((mode === 'blur' || mode === 'clone') && img) {
        ctx.beginPath();
        ctx.rect(-pxW / 2, -pxH / 2, pxW, pxH);
        ctx.clip();

        if (mode === 'blur') {
            ctx.filter = `blur(${p.blurRadius || 8}px)`;
        }

        ctx.rotate(-rot);
        
        let offsetX = 0;
        let offsetY = 0;
        if (mode === 'clone') {
            offsetX = -((p.cloneDx || 0) / 100) * canvasWidth;
            offsetY = -((p.cloneDy || 0) / 100) * canvasHeight;
        }

        ctx.translate(-(pxX + pxW / 2) + offsetX, -(pxY + pxH / 2) + offsetY);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    } else if (mode === 'inpaint') {
        const cached = state.inpaintCache[p.id];
        if (cached) {
            ctx.beginPath();
            ctx.rect(-pxW / 2, -pxH / 2, pxW, pxH);
            ctx.clip();
            
            ctx.rotate(-rot);
            ctx.translate(-(pxX + pxW / 2), -(pxY + pxH / 2));
            ctx.drawImage(cached.canvas, cached.x, cached.y);
        } else {
            // Draw placeholder loading state or just blur
            ctx.beginPath();
            ctx.rect(-pxW / 2, -pxH / 2, pxW, pxH);
            ctx.clip();
            ctx.filter = `blur(4px)`;
            ctx.rotate(-rot);
            ctx.translate(-(pxX + pxW / 2), -(pxY + pxH / 2));
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        }
    }
    
    ctx.restore();
}

export function getShrunkFontSize(ctx, textContent, font, pxW, pxH) {
    if (!textContent.trim() || !font) return font ? font.size : 20;
    let fontSize = font.size;
    const minFontSize = 4;
    while (fontSize >= minFontSize) {
        ctx.font = `400 ${fontSize}px "${font.family}", sans-serif`;
        const lines = calculateWordWrap(ctx, textContent, pxW);
        const totalHeight = lines.length * (fontSize * 1.2);
        if (totalHeight <= pxH) break;
        fontSize--;
    }
    return fontSize;
}

export function calculateWordWrap(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word || "";
            }
        }
        lines.push(currentLine);
    });

    return lines;
}

export function drawTextOnCanvas(ctx, t, canvasWidth, canvasHeight) {
    const lang = state.config.currentLang;
    const textContent = t.content[lang] || '';
    if (!textContent.trim()) return;

    const font = state.config.fonts[t.fontId];
    if (!font) return;

    const pxX = (t.x / 100) * canvasWidth;
    const pxY = (t.y / 100) * canvasHeight;
    const pxW = (t.width / 100) * canvasWidth;
    const pxH = (t.height / 100) * canvasHeight;

    ctx.save();
    ctx.translate(pxX, pxY);
    ctx.rotate((t.rotation || 0) * Math.PI / 180);

    const fontSize = getShrunkFontSize(ctx, textContent, font, pxW, pxH);
    const italic = font.italic ? 'italic ' : '';
    ctx.font = `400 ${italic}${fontSize}px "${font.family}", sans-serif`;
    ctx.fillStyle = font.color || '#000';
    ctx.textBaseline = 'top';

    const lines = calculateWordWrap(ctx, textContent, pxW);
    const lineHeight = fontSize * 1.2;
    const align = t.align || 'center';
    ctx.textAlign = align;
    let currentY = 0;

    lines.forEach(line => {
        let textX = 0;
        if (align === 'center') textX = pxW / 2;
        else if (align === 'right') textX = pxW;
        else textX = 0;

        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
    });

    ctx.restore();
}
