
export function generateId() {
    return 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}

export function screenToNDC(screenX, screenY, canvas, viewport, settings) {
    const centerX = canvas.width / 2 + viewport.panX;
    const centerY = canvas.height / 2 + viewport.panY;
    const scale = Math.min(canvas.width, canvas.height) / 2 * viewport.zoom;

    let x = (screenX - centerX) / scale;
    let y = -(screenY - centerY) / scale;

    // Snapping
    if (settings && settings.snapToGrid) {
        const gridStep = 2 / settings.gridDivisions;
        x = Math.round(x / gridStep) * gridStep;
        y = Math.round(y / gridStep) * gridStep;
    }

    // Clamp to NDC range
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    return { x, y };
}

export function ndcToScreen(ndcX, ndcY, canvas, viewport) {
    const centerX = canvas.width / 2 + viewport.panX;
    const centerY = canvas.height / 2 + viewport.panY;
    const scale = Math.min(canvas.width, canvas.height) / 2 * viewport.zoom;

    return {
        x: centerX + ndcX * scale,
        y: centerY - ndcY * scale
    };
}

export function getShapeIcon(type) {
    const icons = {
        point: '●',
        line: '╱',
        polyline: '📈',
        lineloop: '⬠',
        triangle: '△',
        rectangle: '▭',
        circle: '○',
        polygon: '⬡',
        fan: '✦'
    };
    return icons[type] || '◇';
}
