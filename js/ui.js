import { state } from './state.js';
import { render } from './renderer.js';
import { generateId, getShapeIcon, sanitizeName } from './utils.js';
import { saveToStorage, deleteProject, loadFromStorage, generateExport, loadCurrentProject, getSavedProjects, downloadProjectFile, loadFromFile } from './io.js';
import { createRoundedRectangle } from './geometry.js';

export function bindUI(canvas) {
    bindToolbar(canvas);
    bindPanelTabs();
    bindSettings(canvas);
    bindModals(canvas);
    bindKeyboard(canvas);
}

function bindToolbar(canvas) {
    const ctx = canvas.getContext('2d');

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentTool = btn.dataset.tool;
            state.drawingPoints = [];
            state.tempShape = null;
            render(canvas, ctx);
        });
    });

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => {
        state.zoom = Math.min(4, state.zoom * 1.2);
        document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
        render(canvas, ctx);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        state.zoom = Math.max(0.25, state.zoom / 1.2);
        document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
        render(canvas, ctx);
    });

    document.getElementById('zoomReset').addEventListener('click', () => {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        document.getElementById('zoomLevel').textContent = '100%';
        render(canvas, ctx);
    });
}

function bindPanelTabs() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.getElementById('hierarchyPanel').style.display = 'none';
            document.getElementById('inspectorPanel').style.display = 'none';
            document.getElementById('settingsPanel').style.display = 'none';
            document.getElementById(tab.dataset.panel + 'Panel').style.display = 'block';
        });
    });

    // Hierarchy actions
    document.getElementById('btnAddGroup').addEventListener('click', () => {
        const group = {
            id: 'group_' + Date.now(),
            name: 'group_' + state.groups.length,
            shapes: []
        };
        state.groups.push(group);
        updateHierarchy();
        saveToStorage(document.getElementById('projectName'));
    });

    document.getElementById('btnDeleteSelected').addEventListener('click', () => {
        state.shapes = state.shapes.filter(s => !state.selectedIds.includes(s.id));
        state.selectedIds = [];
        updateHierarchy();
        updateInspector();
        saveToStorage(document.getElementById('projectName'));
        const canvas = document.getElementById('mainCanvas');
        render(canvas, canvas.getContext('2d'));
    });
}

function bindSettings(canvas) {
    const ctx = canvas.getContext('2d');
    const showGrid = document.getElementById('showGrid');
    const gridDivisions = document.getElementById('gridDivisions');
    const snapToGrid = document.getElementById('snapToGrid');
    const snapToVertex = document.getElementById('snapToVertex');
    const circleSegments = document.getElementById('circleSegments');
    const polygonSides = document.getElementById('polygonSides');
    const defaultColor = document.getElementById('defaultColor');

    showGrid.addEventListener('change', () => {
        state.settings.showGrid = showGrid.checked;
        render(canvas, ctx);
    });

    gridDivisions.addEventListener('input', () => {
        state.settings.gridDivisions = parseInt(gridDivisions.value);
        document.getElementById('gridDivisionsValue').textContent = gridDivisions.value;
        render(canvas, ctx);
    });

    snapToGrid.addEventListener('change', () => {
        state.settings.snapToGrid = snapToGrid.checked;
    });

    snapToVertex.addEventListener('change', () => {
        state.settings.snapToVertex = snapToVertex.checked;
    });

    circleSegments.addEventListener('input', () => {
        state.settings.circleSegments = parseInt(circleSegments.value);
        document.getElementById('circleSegmentsValue').textContent = circleSegments.value;
    });

    polygonSides.addEventListener('input', () => {
        state.settings.polygonSides = parseInt(polygonSides.value);
        document.getElementById('polygonSidesValue').textContent = polygonSides.value;
    });

    // Rounded Rectangle settings
    const roundedCornerRadius = document.getElementById('roundedCornerRadius');
    const roundedCornerSegments = document.getElementById('roundedCornerSegments');

    roundedCornerRadius.addEventListener('input', () => {
        state.settings.roundedCornerRadius = parseInt(roundedCornerRadius.value) / 100;
        document.getElementById('roundedCornerRadiusValue').textContent = roundedCornerRadius.value + '%';
    });

    roundedCornerSegments.addEventListener('input', () => {
        state.settings.roundedCornerSegments = parseInt(roundedCornerSegments.value);
        document.getElementById('roundedCornerSegmentsValue').textContent = roundedCornerSegments.value;
    });

    defaultColor.addEventListener('input', () => {
        state.settings.defaultColor = defaultColor.value;
    });
}

function bindModals(canvas) {
    const ctx = canvas.getContext('2d');

    // Export modal
    document.getElementById('btnExport').addEventListener('click', () => {
        openExportModal();
    });

    document.getElementById('closeExportModal').addEventListener('click', () => {
        document.getElementById('exportModal').classList.remove('active');
    });

    document.getElementById('copyExport').addEventListener('click', () => {
        const preview = document.getElementById('exportPreview').textContent;
        navigator.clipboard.writeText(preview);
        showToast('Copied to clipboard!', 'success');
    });

    document.getElementById('downloadExport').addEventListener('click', () => {
        const preview = document.getElementById('exportPreview').textContent;
        const filename = document.getElementById('exportFilename').value || 'assets.h';
        const blob = new Blob([preview], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast('File downloaded!', 'success');
    });

    ['exportNamespace', 'exportFilename', 'exportComments', 'exportColors'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateExportPreview);
            el.addEventListener('input', updateExportPreview);
        }
    });

    // Load modal
    document.getElementById('btnLoad').addEventListener('click', () => {
        openLoadModal(canvas);
    });

    document.getElementById('closeLoadModal').addEventListener('click', () => {
        document.getElementById('loadModal').classList.remove('active');
    });

    // New project
    document.getElementById('btnNew').addEventListener('click', () => {
        if (state.shapes.length > 0 && !confirm('Create new project? Unsaved changes will be lost.')) {
            return;
        }
        state.reset();
        document.getElementById('projectName').value = 'untitled_project';
        updateHierarchy();
        updateInspector();
        render(canvas, ctx);
        showToast('New project created', 'success');
    });

    // Save project
    document.getElementById('btnSave').addEventListener('click', () => {
        const projectNameInput = document.getElementById('projectName');
        const projectName = projectNameInput.value || 'untitled_project';

        // Save to browser storage
        saveToStorage(projectNameInput);

        // Also download to device
        downloadProjectFile(projectName);

        showToast('Project saved and downloaded!', 'success');
    });
}

function bindKeyboard(canvas) {
    const ctx = canvas.getContext('2d');

    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        const key = e.key.toLowerCase();

        const toolMap = {
            'v': 'select',
            'm': 'move',
            'p': 'point',
            'l': 'line',
            'k': 'polyline',
            'o': 'lineloop',
            't': 'triangle',
            'r': 'rectangle',
            'u': 'roundedrect',
            'c': 'circle',
            'g': 'polygon',
            'f': 'fan',
            'e': 'vertex'
        };

        if (toolMap[key]) {
            const btn = document.querySelector(`[data-tool="${toolMap[key]}"]`);
            if (btn) btn.click();
        }

        if (key === 'delete' || key === 'backspace') {
            if (state.selectedIds.length > 0) {
                state.shapes = state.shapes.filter(s => !state.selectedIds.includes(s.id));
                state.selectedIds = [];
                updateHierarchy();
                updateInspector();
                saveToStorage(document.getElementById('projectName'));
                render(canvas, ctx);
            }
        }

        if (key === 'escape') {
            state.selectedIds = [];
            state.drawingPoints = [];
            state.tempShape = null;
            updateHierarchy();
            updateInspector();
            render(canvas, ctx);
        }

        if (e.ctrlKey && key === 's') {
            e.preventDefault();
            saveToStorage(document.getElementById('projectName'));
            showToast('Project saved!', 'success');
        }

        if (e.ctrlKey && key === 'e') {
            e.preventDefault();
            openExportModal();
        }

        if (e.ctrlKey && key === 'd') {
            e.preventDefault();
            if (state.selectedIds.length === 1) {
                const shape = state.shapes.find(s => s.id === state.selectedIds[0]);
                if (shape) {
                    const newShape = JSON.parse(JSON.stringify(shape));
                    newShape.id = generateId();
                    newShape.name = shape.name + '_copy';
                    newShape.vertices = newShape.vertices.map(v => ({
                        x: v.x + 0.05,
                        y: v.y + 0.05
                    }));
                    state.shapes.push(newShape);
                    state.selectedIds = [newShape.id];
                    updateHierarchy();
                    updateInspector();
                    saveToStorage(document.getElementById('projectName'));
                    render(canvas, ctx);
                }
            }
        }
    });
}

// Helpers
export function updateHierarchy() {
    const list = document.getElementById('hierarchyList');
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    if (state.shapes.length === 0) {
        list.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            </svg>
            <p>No shapes yet</p>
            <p style="font-size: 12px; margin-top: 8px;">Use the tools to draw shapes</p>
        </div>
        `;
        return;
    }

    list.innerHTML = state.shapes.map(shape => {
        const icon = getShapeIcon(shape.type);
        const selected = state.selectedIds.includes(shape.id);
        const primShort = shape.primitiveType.replace('GL_', '').substring(0, 3);

        return `
        <div class="hierarchy-item ${selected ? 'selected' : ''}" data-id="${shape.id}">
            <span class="hierarchy-icon">${icon}</span>
            <span class="hierarchy-name">${shape.name}</span>
            <span class="hierarchy-meta">${primShort} ${shape.vertices.length}v</span>
            <div class="hierarchy-actions">
                <button class="hierarchy-action" data-action="duplicate" title="Duplicate">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
                <button class="hierarchy-action" data-action="delete" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Bind click events
    list.querySelectorAll('.hierarchy-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.hierarchy-action')) return;

            const id = item.dataset.id;
            if (e.shiftKey) {
                const idx = state.selectedIds.indexOf(id);
                if (idx >= 0) {
                    state.selectedIds.splice(idx, 1);
                } else {
                    state.selectedIds.push(id);
                }
            } else {
                state.selectedIds = [id];
            }
            updateHierarchy();
            updateInspector();
            render(canvas, ctx);
        });
    });

    // Bind action buttons
    list.querySelectorAll('.hierarchy-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.hierarchy-item');
            const id = item.dataset.id;
            const action = btn.dataset.action;

            if (action === 'delete') {
                state.shapes = state.shapes.filter(s => s.id !== id);
                state.selectedIds = state.selectedIds.filter(i => i !== id);
            } else if (action === 'duplicate') {
                const shape = state.shapes.find(s => s.id === id);
                if (shape) {
                    const newShape = JSON.parse(JSON.stringify(shape));
                    newShape.id = generateId();
                    newShape.name = shape.name + '_copy';
                    newShape.vertices = newShape.vertices.map(v => ({
                        x: v.x + 0.05,
                        y: v.y + 0.05
                    }));
                    state.shapes.push(newShape);
                    state.selectedIds = [newShape.id];
                }
            }

            updateHierarchy();
            updateInspector();
            saveToStorage(document.getElementById('projectName'));
            render(canvas, ctx);
        });
    });
}

export function updateInspector() {
    const content = document.getElementById('inspectorContent');
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    if (state.selectedIds.length === 0) {
        content.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
            <p>No selection</p>
            <p style="font-size: 12px; margin-top: 8px;">Select a shape to edit properties</p>
        </div>
        `;
        return;
    }

    if (state.selectedIds.length > 1) {
        content.innerHTML = `
        <div class="empty-state">
            <p>${state.selectedIds.length} shapes selected</p>
        </div>
        `;
        return;
    }

    const shape = state.shapes.find(s => s.id === state.selectedIds[0]);
    if (!shape) return;

    content.innerHTML = `
        <div class="panel-section">
            <div class="panel-section-title">Properties</div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="shapeName" value="${shape.name}">
            </div>
            <div class="form-group">
                <label>Primitive Type</label>
                <select id="shapePrimitive">
                    <option value="GL_POINTS" ${shape.primitiveType === 'GL_POINTS' ? 'selected' : ''}>GL_POINTS</option>
                    <option value="GL_LINES" ${shape.primitiveType === 'GL_LINES' ? 'selected' : ''}>GL_LINES</option>
                    <option value="GL_LINE_STRIP" ${shape.primitiveType === 'GL_LINE_STRIP' ? 'selected' : ''}>GL_LINE_STRIP</option>
                    <option value="GL_LINE_LOOP" ${shape.primitiveType === 'GL_LINE_LOOP' ? 'selected' : ''}>GL_LINE_LOOP</option>
                    <option value="GL_TRIANGLES" ${shape.primitiveType === 'GL_TRIANGLES' ? 'selected' : ''}>GL_TRIANGLES</option>
                    <option value="GL_TRIANGLE_STRIP" ${shape.primitiveType === 'GL_TRIANGLE_STRIP' ? 'selected' : ''}>GL_TRIANGLE_STRIP</option>
                    <option value="GL_TRIANGLE_FAN" ${shape.primitiveType === 'GL_TRIANGLE_FAN' ? 'selected' : ''}>GL_TRIANGLE_FAN</option>
                </select>
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="color" id="shapeColor" value="${shape.color}">
            </div>
        </div>
        ${shape.type === 'roundedrect' ? `
        <div class="panel-section">
            <div class="panel-section-title">Corner Settings</div>
            <div class="form-group">
                <label>Corner Radius</label>
                <div class="slider-container">
                    <input type="range" id="shapeCornerRadius" min="5" max="50" value="${Math.round((shape.cornerRadius || 0.2) * 100)}">
                    <span class="slider-value" id="shapeCornerRadiusValue">${Math.round((shape.cornerRadius || 0.2) * 100)}%</span>
                </div>
            </div>
            <div class="form-group">
                <label>Corner Segments</label>
                <div class="slider-container">
                    <input type="range" id="shapeCornerSegments" min="2" max="16" value="${shape.cornerSegments || 8}">
                    <span class="slider-value" id="shapeCornerSegmentsValue">${shape.cornerSegments || 8}</span>
                </div>
            </div>
            <button class="btn" id="btnRegenerateCorners" style="width: 100%; margin-top: 8px;">🔄 Regenerate Corners</button>
        </div>
        ` : ''}
        <div class="panel-section">
            <div class="panel-section-title">Vertices (${shape.vertices.length})</div>
            <div class="vertex-list">
                ${shape.vertices.map((v, i) => `
                <div class="vertex-row">
                    <span class="vertex-idx">${i}</span>
                    <span class="vertex-coord">${v.x.toFixed(3)}</span>
                    <span class="vertex-coord">${v.y.toFixed(3)}</span>
                </div>
                `).join('')}
            </div>
            <p class="help-text">Use Vertex Edit tool (E) to modify vertices</p>
        </div>
    `;

    // Bind inspector events
    document.getElementById('shapeName').addEventListener('change', (e) => {
        shape.name = e.target.value;
        updateHierarchy();
        saveToStorage(document.getElementById('projectName'));
    });

    document.getElementById('shapePrimitive').addEventListener('change', (e) => {
        shape.primitiveType = e.target.value;
        updateHierarchy();
        saveToStorage(document.getElementById('projectName'));
    });

    document.getElementById('shapeColor').addEventListener('input', (e) => {
        shape.color = e.target.value;
        render(canvas, ctx);
        saveToStorage(document.getElementById('projectName'));
    });

    // Rounded rectangle corner controls
    if (shape.type === 'roundedrect') {
        const radiusSlider = document.getElementById('shapeCornerRadius');
        const segmentsSlider = document.getElementById('shapeCornerSegments');

        radiusSlider.addEventListener('input', () => {
            document.getElementById('shapeCornerRadiusValue').textContent = radiusSlider.value + '%';
        });

        segmentsSlider.addEventListener('input', () => {
            document.getElementById('shapeCornerSegmentsValue').textContent = segmentsSlider.value;
        });

        document.getElementById('btnRegenerateCorners').addEventListener('click', () => {
            const newRadius = parseInt(radiusSlider.value) / 100;
            const newSegments = parseInt(segmentsSlider.value);

            // Find the bounding box from current vertices (excluding center)
            const perimeterVerts = shape.vertices.slice(1);
            const xs = perimeterVerts.map(v => v.x);
            const ys = perimeterVerts.map(v => v.y);
            const p1 = { x: Math.min(...xs), y: Math.min(...ys) };
            const p2 = { x: Math.max(...xs), y: Math.max(...ys) };

            // Create new rounded rectangle with same bounds
            const newShape = createRoundedRectangle(p1, p2, newRadius, newSegments, shape.color);

            // Update shape in place
            shape.vertices = newShape.vertices;
            shape.cornerRadius = newRadius;
            shape.cornerSegments = newSegments;

            render(canvas, ctx);
            updateInspector();
            saveToStorage(document.getElementById('projectName'));
        });
    }
}

function openExportModal() {
    document.getElementById('exportModal').classList.add('active');
    document.getElementById('exportNamespace').value = sanitizeName(document.getElementById('projectName').value);
    updateExportPreview();
}

function updateExportPreview() {
    const namespace = document.getElementById('exportNamespace').value || 'Assets';
    const filename = document.getElementById('exportFilename').value || 'assets.h';
    const options = {
        includeComments: document.getElementById('exportComments').checked,
        includeColors: document.getElementById('exportColors').checked
    };

    const code = generateExport(namespace, filename, options);
    document.getElementById('exportPreview').textContent = code;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openLoadModal(canvas) {
    const modal = document.getElementById('loadModal');
    const list = document.getElementById('savedProjectsList');
    const savedProjects = getSavedProjects();
    const projectNames = Object.keys(savedProjects);

    let html = `
        <div class="panel-section">
            <div class="panel-section-title">Load from Device</div>
            <div style="margin-bottom: 16px;">
                <input type="file" id="fileUploadInput" accept=".json,.drawgl.json" style="display:none;">
                <button class="btn" id="btnLoadFromFile" style="width: 100%;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:8px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Choose File to Load
                </button>
            </div>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Saved Projects (Browser Storage)</div>
    `;

    if (projectNames.length === 0) {
        html += `
        <div class="empty-state">
            <p>No saved projects</p>
        </div>
        `;
    } else {
        html += projectNames.map(name => `
        <div class="hierarchy-item" data-project="${name}">
            <span class="hierarchy-icon">📁</span>
            <span class="hierarchy-name">${name}</span>
            <span class="hierarchy-meta">${savedProjects[name].shapes?.length || 0} shapes</span>
            <div class="hierarchy-actions">
                <button class="hierarchy-action" data-action="delete" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
        `).join('');
    }

    html += `</div>`;
    list.innerHTML = html;

    // Bind file upload button
    const btnLoadFromFile = document.getElementById('btnLoadFromFile');
    const fileUploadInput = document.getElementById('fileUploadInput');

    if (btnLoadFromFile && fileUploadInput) {
        btnLoadFromFile.addEventListener('click', () => {
            fileUploadInput.click();
        });

        fileUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            loadFromFile(file, (result) => {
                if (result.success) {
                    // Extract project name from filename (remove .drawgl.json or .json extension)
                    const fileName = file.name.replace(/\.(drawgl\.)?json$/, '');
                    document.getElementById('projectName').value = fileName;
                    updateHierarchy();
                    updateInspector();
                    // Force update settings UI
                    document.getElementById('defaultColor').value = state.settings.defaultColor;
                    render(canvas, canvas.getContext('2d'));
                    modal.classList.remove('active');
                    showToast('Project loaded from file!', 'success');
                } else {
                    showToast('Error: ' + result.error, 'error');
                }
                // Reset file input
                fileUploadInput.value = '';
            });
        });
    }

    // Bind saved projects
    list.querySelectorAll('.hierarchy-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const projectName = item.dataset.project;
            if (e.target.closest('.hierarchy-action')) {
                deleteProject(projectName);
                openLoadModal(canvas); // Refresh list
                return;
            }

            if (loadFromStorage(projectName)) {
                document.getElementById('projectName').value = projectName;
                updateHierarchy();
                updateInspector();
                // Force update settings UI
                document.getElementById('defaultColor').value = state.settings.defaultColor;
                render(canvas, canvas.getContext('2d'));
                modal.classList.remove('active');
                showToast('Project loaded!', 'success');
            }
        });
    });

    modal.classList.add('active');
}
