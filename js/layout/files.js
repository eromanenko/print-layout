export async function processFiles(files) {
    let images = [];
    
    for (let file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            const zipImages = await processZip(file);
            images = images.concat(zipImages);
        } else if (file.type.startsWith('image/')) {
            const imgData = await fileToImageData(file);
            images.push(imgData);
        }
    }
    
    // Sort images by name to ensure consistent ordering
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
    
    return images;
}

async function processZip(zipFile) {
    const images = [];
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    
    for (const [filename, fileData] of Object.entries(contents.files)) {
        if (fileData.dir || filename.startsWith('__MACOSX/')) continue;
        
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'].includes(ext)) {
            const blob = await fileData.async('blob');
            const file = new File([blob], filename.split('/').pop(), { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
            const imgData = await fileToImageData(file);
            images.push(imgData);
        }
    }
    
    return images;
}

export function fileToImageData(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({
                name: file.name,
                img: img,
                width: img.width,
                height: img.height,
                url: url
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image: ${file.name}`));
        };
        img.src = url;
    });
}
