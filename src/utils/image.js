/* Achica una imagen elegida en el celular y la devuelve como data URI (para escudos y portadas).
   Así no se suben fotos de 8 MB. */
export function resizeImage(file, max = 640, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * k));
            c.height = Math.max(1, Math.round(img.height * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            const png = file.type === 'image/png' || file.type === 'image/svg+xml';
            resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
        img.src = url;
    });
}

/** Abre el selector de imágenes del celular y devuelve el archivo elegido (o null si se cancela). */
export function pickImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
        input.addEventListener('cancel', () => resolve(null), { once: true });
        input.click();
    });
}
/** Recorta la imagen al centro en un cuadrado y la achica (fotos de perfil: ~15 KB en vez de varios MB). */
export function cropSquare(file, size = 256, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/'))
            return reject(new Error('Elegí un archivo de imagen.'));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const side = Math.min(img.width, img.height);
            const c = document.createElement('canvas');
            c.width = c.height = size;
            c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
        img.src = url;
    });
}
