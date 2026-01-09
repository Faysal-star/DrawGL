import { state } from './state.js';
import { screenToNDC, ndcToScreen, generateId } from './utils.js';
import { render } from './renderer.js';
import { hitTest, createRectangle, createRoundedRectangle, createCircle, createPolygon } from './geometry.js';
import { saveToStorage } from './io.js';
import { updateHierarchy, updateInspector } from './ui.js';

export function bindInput(canvas) {
    canvas.addEventListener('mousedown', (e) => onMouseDown(e, canvas));
    canvas.addEventListener('mousemove', (e) => onMouseMove(e, canvas));
    canvas.addEventListener('mouseup', (e) => onMouseUp(e, canvas));
    canvas.addEventListener('wheel', (e) => onWheel(e, canvas));
    canvas.addEventListener('dblclick', (e) => onDoubleClick(e, canvas));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function onMouseDown(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const ndc = screenToNDC(screenX, screenY, canvas, state, state.settings);
    const ctx = canvas.getContext('2d');

    // Middle mouse or space+click for panning
    if (e.button === 1) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        return;
    }

    if (e.button !== 0) return;

    // Tool-specific handling
    switch (state.currentTool) {
        case 'select':
            handleSelectDown(screenX, screenY, ndc, e.shiftKey, canvas, ctx);
            break;
        case 'move':
            handleMoveDown(ndc);
            break;
        case 'vertex':
            handleVertexDown(screenX, screenY, ndc, canvas);
            break;
        case 'point':
            addPoint(ndc, canvas, ctx);
            break;
        case 'line':
            handleLineDown(ndc, canvas, ctx);
            break;
        case 'polyline':
        case 'lineloop':
        case 'fan':
            handlePolylineDown(ndc, canvas, ctx);
            break;
        case 'triangle':
            handleTriangleDown(ndc, canvas, ctx);
            break;
        case 'rectangle':
        case 'roundedrect':
        case 'circle':
        case 'polygon':
            state.isDrawing = true;
            state.drawingPoints = [ndc];
            break;
    }
}

function onMouseMove(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const ndc = screenToNDC(screenX, screenY, canvas, state, state.settings);
    const ctx = canvas.getContext('2d');

    // Update coordinates display
    document.getElementById('coordX').textContent = ndc.x.toFixed(3);
    document.getElementById('coordY').textContent = ndc.y.toFixed(3);

    // Panning
    if (state.isPanning) {
        state.panX += e.clientX - state.panStart.x;
        state.panY += e.clientY - state.panStart.y;
        state.panStart = { x: e.clientX, y: e.clientY };
        render(canvas, ctx);
        return;
    }

    // Tool-specific handling
    switch (state.currentTool) {
        case 'move':
            if (state.isDrawing && state.selectedIds.length > 0) {
                handleMoveMove(ndc, canvas, ctx);
            }
            break;
        case 'vertex':
            handleVertexMove(screenX, screenY, ndc, canvas, ctx);
            break;
        case 'rectangle':
            if (state.isDrawing) {
                state.tempShape = createRectangle(state.drawingPoints[0], ndc, state.settings.defaultColor);
                render(canvas, ctx);
            }
            break;
        case 'roundedrect':
            if (state.isDrawing) {
                state.tempShape = createRoundedRectangle(state.drawingPoints[0], ndc, state.settings.roundedCornerRadius, state.settings.roundedCornerSegments, state.settings.defaultColor);
                render(canvas, ctx);
            }
            break;
        case 'circle':
            if (state.isDrawing) {
                state.tempShape = createCircle(state.drawingPoints[0], ndc, state.settings.circleSegments, state.settings.defaultColor);
                render(canvas, ctx);
            }
            break;
        case 'polygon':
            if (state.isDrawing) {
                state.tempShape = createPolygon(state.drawingPoints[0], ndc, state.settings.polygonSides, state.settings.defaultColor);
                render(canvas, ctx);
            }
            break;
        case 'line':
            if (state.drawingPoints.length === 1) {
                state.tempShape = {
                    type: 'line',
                    primitiveType: 'GL_LINES',
                    vertices: [state.drawingPoints[0], ndc],
                    color: state.settings.defaultColor
                };
                render(canvas, ctx);
            }
            break;
        case 'polyline':
        case 'lineloop':
        case 'fan':
            if (state.drawingPoints.length > 0) {
                state.tempShape = {
                    type: state.currentTool,
                    primitiveType: state.currentTool === 'polyline' ? 'GL_LINE_STRIP' :
                        state.currentTool === 'lineloop' ? 'GL_LINE_LOOP' : 'GL_TRIANGLE_FAN',
                    vertices: [...state.drawingPoints, ndc],
                    color: state.settings.defaultColor
                };
                render(canvas, ctx);
            }
            break;
        case 'triangle':
            if (state.drawingPoints.length > 0 && state.drawingPoints.length < 3) {
                state.tempShape = {
                    type: 'triangle',
                    primitiveType: 'GL_TRIANGLES',
                    vertices: [...state.drawingPoints, ndc],
                    color: state.settings.defaultColor
                };
                render(canvas, ctx);
            }
            break;
    }
}

function onMouseUp(e, canvas) {
    if (e.button === 1) {
        state.isPanning = false;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const ndc = screenToNDC(screenX, screenY, canvas, state, state.settings);
    const ctx = canvas.getContext('2d');

    switch (state.currentTool) {
        case 'move':
            state.isDrawing = false;
            saveToStorage(document.getElementById('projectName'));
            break;
        case 'vertex':
            state.editingVertexIndex = -1;
            saveToStorage(document.getElementById('projectName'));
            break;
        case 'rectangle':
        case 'roundedrect':
        case 'circle':
        case 'polygon':
            if (state.isDrawing && state.tempShape) {
                addShape(state.tempShape, canvas, ctx);
                state.tempShape = null;
            }
            state.isDrawing = false;
            state.drawingPoints = [];
            break;
    }
}

function onWheel(e, canvas) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(0.25, Math.min(4, state.zoom * delta));
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    render(canvas, canvas.getContext('2d'));
}

function onDoubleClick(e, canvas) {
    const ctx = canvas.getContext('2d');
    if (['polyline', 'lineloop', 'fan'].includes(state.currentTool) && state.drawingPoints.length >= 2) {
        const shape = {
            id: generateId(),
            name: state.currentTool + '_' + state.shapes.length,
            type: state.currentTool,
            primitiveType: state.currentTool === 'polyline' ? 'GL_LINE_STRIP' :
                state.currentTool === 'lineloop' ? 'GL_LINE_LOOP' : 'GL_TRIANGLE_FAN',
            vertices: [...state.drawingPoints],
            color: state.settings.defaultColor
        };
        addShape(shape, canvas, ctx);
        state.drawingPoints = [];
        state.tempShape = null;
        render(canvas, ctx);
    }
}

// Handlers
function handleSelectDown(screenX, screenY, ndc, shiftKey, canvas, ctx) {
    const hit = hitTest(screenX, screenY, state.shapes, canvas, state);

    if (hit) {
        if (shiftKey) {
            const idx = state.selectedIds.indexOf(hit.id);
            if (idx >= 0) {
                state.selectedIds.splice(idx, 1);
            } else {
                state.selectedIds.push(hit.id);
            }
        } else {
            if (!state.selectedIds.includes(hit.id)) {
                state.selectedIds = [hit.id];
            }
        }
    } else {
        if (!shiftKey) {
            state.selectedIds = [];
        }
    }

    updateHierarchy();
    updateInspector();
    render(canvas, ctx);
}

function handleMoveDown(ndc) {
    if (state.selectedIds.length > 0) {
        state.isDrawing = true;
        state.dragStart = ndc;
    }
}

function handleMoveMove(ndc, canvas, ctx) {
    const dx = ndc.x - state.dragStart.x;
    const dy = ndc.y - state.dragStart.y;

    state.selectedIds.forEach(id => {
        const shape = state.shapes.find(s => s.id === id);
        if (shape) {
            shape.vertices = shape.vertices.map(v => ({
                x: Math.max(-1, Math.min(1, v.x + dx)),
                y: Math.max(-1, Math.min(1, v.y + dy))
            }));
        }
    });

    state.dragStart = ndc;
    updateInspector();
    render(canvas, ctx);
}

function handleVertexDown(screenX, screenY, ndc, canvas) {
    if (state.selectedIds.length !== 1) return;

    const shape = state.shapes.find(s => s.id === state.selectedIds[0]);
    if (!shape) return;

    let minDist = Infinity;
    let closestIdx = -1;

    shape.vertices.forEach((v, i) => {
        const screen = ndcToScreen(v.x, v.y, canvas, state);
        const dist = Math.hypot(screen.x - screenX, screen.y - screenY);
        if (dist < minDist && dist < 15) {
            minDist = dist;
            closestIdx = i;
        }
    });

    if (closestIdx >= 0) {
        state.editingVertexIndex = closestIdx;
    }
}

function handleVertexMove(screenX, screenY, ndc, canvas, ctx) {
    if (state.selectedIds.length !== 1) return;

    const shape = state.shapes.find(s => s.id === state.selectedIds[0]);
    if (!shape) return;

    let minDist = Infinity;
    state.hoveredVertexIndex = -1;

    shape.vertices.forEach((v, i) => {
        const screen = ndcToScreen(v.x, v.y, canvas, state);
        const dist = Math.hypot(screen.x - screenX, screen.y - screenY);
        if (dist < minDist && dist < 15) {
            minDist = dist;
            state.hoveredVertexIndex = i;
        }
    });

    if (state.editingVertexIndex >= 0) {
        shape.vertices[state.editingVertexIndex] = {
            x: Math.max(-1, Math.min(1, ndc.x)),
            y: Math.max(-1, Math.min(1, ndc.y))
        };
        updateInspector();
    }

    render(canvas, ctx);
}

function addPoint(ndc, canvas, ctx) {
    const shape = {
        id: generateId(),
        name: 'point_' + state.shapes.length,
        type: 'point',
        primitiveType: 'GL_POINTS',
        vertices: [ndc],
        color: state.settings.defaultColor
    };
    addShape(shape, canvas, ctx);
}

function handleLineDown(ndc, canvas, ctx) {
    if (state.drawingPoints.length === 0) {
        state.drawingPoints = [ndc];
    } else {
        const shape = {
            id: generateId(),
            name: 'line_' + state.shapes.length,
            type: 'line',
            primitiveType: 'GL_LINES',
            vertices: [state.drawingPoints[0], ndc],
            color: state.settings.defaultColor
        };
        addShape(shape, canvas, ctx);
        state.drawingPoints = [];
        state.tempShape = null;
    }
}

function handlePolylineDown(ndc, canvas, ctx) {
    state.drawingPoints.push(ndc);
    render(canvas, ctx);
}

function handleTriangleDown(ndc, canvas, ctx) {
    state.drawingPoints.push(ndc);

    if (state.drawingPoints.length === 3) {
        const shape = {
            id: generateId(),
            name: 'triangle_' + state.shapes.length,
            type: 'triangle',
            primitiveType: 'GL_TRIANGLES',
            vertices: [...state.drawingPoints],
            color: state.settings.defaultColor
        };
        addShape(shape, canvas, ctx);
        state.drawingPoints = [];
        state.tempShape = null;
    }
}

function addShape(shape, canvas, ctx) {
    if (!shape.id) shape.id = generateId();
    state.shapes.push(shape);
    state.selectedIds = [shape.id];
    updateHierarchy();
    updateInspector();
    saveToStorage(document.getElementById('projectName'));
    render(canvas, ctx);
}
