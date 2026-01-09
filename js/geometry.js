import { generateId, ndcToScreen } from './utils.js';

export function createRectangle(p1, p2, color) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    return {
        id: generateId(),
        name: 'rect_' + Date.now(),
        type: 'rectangle',
        primitiveType: 'GL_TRIANGLES',
        vertices: [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY }
        ],
        color: color
    };
}

export function createRoundedRectangle(p1, p2, radiusRatio, segments, color) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    const width = maxX - minX;
    const height = maxY - minY;

    // Corner radius is a ratio of the smaller dimension (capped at 0.5)
    const maxRadius = Math.min(width, height) / 2;
    const radius = Math.min(maxRadius, Math.min(width, height) * Math.min(radiusRatio, 0.5));

    // Center of the rectangle for triangle fan
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const vertices = [{ x: centerX, y: centerY }]; // Center point for fan

    // Generate vertices going around the perimeter COUNTER-CLOCKWISE
    // Starting from the right edge of top-right corner

    // Corner centers
    const trCenterX = maxX - radius;  // Top-right
    const trCenterY = maxY - radius;
    const tlCenterX = minX + radius;  // Top-left
    const tlCenterY = maxY - radius;
    const blCenterX = minX + radius;  // Bottom-left
    const blCenterY = minY + radius;
    const brCenterX = maxX - radius;  // Bottom-right
    const brCenterY = minY + radius;

    // Top-right corner arc: from 0 (right) to PI/2 (up)
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * (Math.PI / 2);
        vertices.push({
            x: trCenterX + Math.cos(angle) * radius,
            y: trCenterY + Math.sin(angle) * radius
        });
    }

    // Top-left corner arc: from PI/2 (up) to PI (left)
    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI / 2 + (i / segments) * (Math.PI / 2);
        vertices.push({
            x: tlCenterX + Math.cos(angle) * radius,
            y: tlCenterY + Math.sin(angle) * radius
        });
    }

    // Bottom-left corner arc: from PI (left) to 3*PI/2 (down)
    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI + (i / segments) * (Math.PI / 2);
        vertices.push({
            x: blCenterX + Math.cos(angle) * radius,
            y: blCenterY + Math.sin(angle) * radius
        });
    }

    // Bottom-right corner arc: from 3*PI/2 (down) to 2*PI (right)
    for (let i = 0; i <= segments; i++) {
        const angle = (3 * Math.PI / 2) + (i / segments) * (Math.PI / 2);
        vertices.push({
            x: brCenterX + Math.cos(angle) * radius,
            y: brCenterY + Math.sin(angle) * radius
        });
    }

    // Close the loop by repeating the first perimeter vertex
    vertices.push({ ...vertices[1] });

    return {
        id: generateId(),
        name: 'roundrect_' + Date.now(),
        type: 'roundedrect',
        primitiveType: 'GL_TRIANGLE_FAN',
        vertices: vertices,
        color: color,
        cornerRadius: radiusRatio,
        cornerSegments: segments
    };
}

export function createCircle(center, edge, segments, color) {
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    const vertices = [center];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        });
    }

    return {
        id: generateId(),
        name: 'circle_' + Date.now(),
        type: 'circle',
        primitiveType: 'GL_TRIANGLE_FAN',
        vertices: vertices,
        color: color
    };
}

export function createPolygon(center, edge, sides, color) {
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    const vertices = [center];
    const angleOffset = -Math.PI / 2;

    for (let i = 0; i <= sides; i++) {
        const angle = angleOffset + (i / sides) * Math.PI * 2;
        vertices.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        });
    }

    return {
        id: generateId(),
        name: 'polygon_' + Date.now(),
        type: 'polygon',
        primitiveType: 'GL_TRIANGLE_FAN',
        vertices: vertices,
        color: color
    };
}

// Hit Testing
export function hitTest(screenX, screenY, shapes, canvas, viewport) {
    // Reverse order for proper z-order (top shapes first)
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (pointInShape(screenX, screenY, shape, canvas, viewport)) {
            return shape;
        }
    }
    return null;
}

function pointInShape(screenX, screenY, shape, canvas, viewport) {
    const threshold = 10;

    if (shape.type === 'point') {
        const screen = ndcToScreen(shape.vertices[0].x, shape.vertices[0].y, canvas, viewport);
        return Math.hypot(screen.x - screenX, screen.y - screenY) < threshold;
    }

    if (shape.type === 'line') {
        return pointNearLine(screenX, screenY, shape.vertices[0], shape.vertices[1], threshold, canvas, viewport);
    }

    if (['polyline', 'lineloop'].includes(shape.type)) {
        for (let i = 0; i < shape.vertices.length - 1; i++) {
            if (pointNearLine(screenX, screenY, shape.vertices[i], shape.vertices[i + 1], threshold, canvas, viewport)) {
                return true;
            }
        }
        if (shape.type === 'lineloop' && shape.vertices.length > 2) {
            if (pointNearLine(screenX, screenY, shape.vertices[shape.vertices.length - 1], shape.vertices[0], threshold, canvas, viewport)) {
                return true;
            }
        }
        return false;
    }

    // For filled shapes, check if point is inside polygon
    return pointInPolygon(screenX, screenY, shape.vertices, canvas, viewport);
}

function pointNearLine(px, py, v1, v2, threshold, canvas, viewport) {
    const p1 = ndcToScreen(v1.x, v1.y, canvas, viewport);
    const p2 = ndcToScreen(v2.x, v2.y, canvas, viewport);

    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (lineLen === 0) return Math.hypot(px - p1.x, py - p1.y) < threshold;

    const t = Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / (lineLen * lineLen)));
    const projX = p1.x + t * (p2.x - p1.x);
    const projY = p1.y + t * (p2.y - p1.y);

    return Math.hypot(px - projX, py - projY) < threshold;
}

function pointInPolygon(px, py, vertices, canvas, viewport) {
    const screenVerts = vertices.map(v => ndcToScreen(v.x, v.y, canvas, viewport));
    let inside = false;

    for (let i = 0, j = screenVerts.length - 1; i < screenVerts.length; j = i++) {
        const xi = screenVerts[i].x, yi = screenVerts[i].y;
        const xj = screenVerts[j].x, yj = screenVerts[j].y;

        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}
