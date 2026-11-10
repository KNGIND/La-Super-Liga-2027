/* Colores: lo justo para escudos y acentos de equipo. */
export function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m)
        return [128, 128, 128];
    let h = m[1];
    if (h.length === 3)
        h = h.replace(/./g, '$&$&');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const isHex = (v) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test((v || '').trim());
export function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
/** Color de texto legible sobre `bg`. */
export const ink = (bg) => (luminance(bg) > 0.6 ? '#0b0b0c' : '#ffffff');
export function alpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
