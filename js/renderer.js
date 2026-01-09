import { state } from './state.js';
import { ndcToScreen } from './utils.js';

export function render(canvas, ctx) {
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (state.settings.showGrid) {
        drawGrid(canvas, ctx);
    }

    // Draw shapes
    state.shapes.forEach(shape => {
        drawShape(ctx, shape, state.selectedIds.includes(shape.id), canvas);
    });

    // Draw temp shape
    if (state.tempShape) {
        drawShape(ctx, state.tempShape, false, canvas, true);
    }

    // Draw vertex handles if in vertex edit mode
    if (state.currentTool === 'vertex' && state.selectedIds.length === 1) {
        const shape = state.shapes.find(s => s.id === state.selectedIds[0]);
        if (shape) {
            drawVertexHandles(ctx, shape, canvas);
        }
    }
}

function drawGrid(canvas, ctx) {
    const divisions = state.settings.gridDivisions;
    const viewport = state; // state acts as viewport (pan/zoom)

    // Draw minor grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    for (let i = -divisions; i <= divisions; i++) {
        const ndc = i / divisions;
        const p1 = ndcToScreen(ndc, -1, canvas, viewport);
        const p2 = ndcToScreen(ndc, 1, canvas, viewport);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const p3 = ndcToScreen(-1, ndc, canvas, viewport);
        const p4 = ndcToScreen(1, ndc, canvas, viewport);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
    }

    // Draw major grid lines (every 5)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    const majorStep = Math.ceil(divisions / 4);

    for (let i = -divisions; i <= divisions; i += majorStep) {
        const ndc = i / divisions;
        const p1 = ndcToScreen(ndc, -1, canvas, viewport);
        const p2 = ndcToScreen(ndc, 1, canvas, viewport);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const p3 = ndcToScreen(-1, ndc, canvas, viewport);
        const p4 = ndcToScreen(1, ndc, canvas, viewport);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.6)';
    ctx.lineWidth = 2;
    const origin = ndcToScreen(0, 0, canvas, viewport);
    const xEnd = ndcToScreen(1, 0, canvas, viewport);
    const yEnd = ndcToScreen(0, 1, canvas, viewport);
    const xStart = ndcToScreen(-1, 0, canvas, viewport);
    const yStart = ndcToScreen(0, -1, canvas, viewport);

    ctx.beginPath();
    ctx.moveTo(xStart.x, xStart.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.beginPath();
    ctx.moveTo(yStart.x, yStart.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();

    // Draw boundary
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    const tl = ndcToScreen(-1, 1, canvas, viewport);
    const tr = ndcToScreen(1, 1, canvas, viewport);
    const br = ndcToScreen(1, -1, canvas, viewport);
    const bl = ndcToScreen(-1, -1, canvas, viewport);

    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText('-1', tl.x + 5, tl.y + 15);
    ctx.fillText('1', tr.x - 15, tr.y + 15);
    ctx.fillText('1', ndcToScreen(0, 1, canvas, viewport).x + 5, ndcToScreen(0, 1, canvas, viewport).y + 15);
    ctx.fillText('-1', ndcToScreen(0, -1, canvas, viewport).x + 5, ndcToScreen(0, -1, canvas, viewport).y - 5);
}

function drawShape(ctx, shape, selected, canvas, isTemp = false) {
    const vertices = shape.vertices;
    const viewport = state;

    if (vertices.length === 0) return;

    // Convert to screen coordinates
    const screenVerts = vertices.map(v => ndcToScreen(v.x, v.y, canvas, viewport));

    // Set styles
    ctx.fillStyle = isTemp ? shape.color + '80' : shape.color + 'cc';
    ctx.strokeStyle = selected ? '#ffffff' : shape.color;
    ctx.lineWidth = selected ? 3 : 2;

    switch (shape.type) {
        case 'point':
            ctx.beginPath();
            ctx.arc(screenVerts[0].x, screenVerts[0].y, 6, 0, Math.PI * 2);
            ctx.fill();
            if (selected) ctx.stroke();
            break;

        case 'line':
            ctx.beginPath();
            ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
            ctx.lineTo(screenVerts[1].x, screenVerts[1].y);
            ctx.stroke();
            break;

        case 'polyline':
            ctx.beginPath();
            ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
            for (let i = 1; i < screenVerts.length; i++) {
                ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
            }
            ctx.stroke();
            break;

        case 'lineloop':
            ctx.beginPath();
            ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
            for (let i = 1; i < screenVerts.length; i++) {
                ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
            }
            ctx.closePath();
            ctx.stroke();
            break;

        case 'triangle':
        case 'rectangle':
        case 'roundedrect':
        case 'circle':
        case 'polygon':
        case 'fan':
            ctx.beginPath();
            ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
            for (let i = 1; i < screenVerts.length; i++) {
                ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
    }

    // Draw selection handles
    if (selected && !isTemp && state.currentTool !== 'vertex') {
        ctx.fillStyle = '#ffffff';
        screenVerts.forEach(v => {
            ctx.beginPath();
            ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

function drawVertexHandles(ctx, shape, canvas) {
    const viewport = state;
    shape.vertices.forEach((v, i) => {
        const screen = ndcToScreen(v.x, v.y, canvas, viewport);

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);

        if (i === state.editingVertexIndex) {
            ctx.fillStyle = '#e94560';
        } else if (i === state.hoveredVertexIndex) {
            ctx.fillStyle = '#fbbf24';
        } else {
            ctx.fillStyle = '#4ade80';
        }

        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw vertex index
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), screen.x, screen.y);
    });
}
