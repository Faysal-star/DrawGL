import { DEFAULT_SETTINGS } from './config.js';

class AppState {
    constructor() {
        // Data
        this.shapes = [];
        this.groups = [];
        this.selectedIds = [];

        // Settings
        this.settings = { ...DEFAULT_SETTINGS };

        // Tool State
        this.currentTool = 'select';
        this.isDrawing = false;
        this.drawingPoints = [];
        this.tempShape = null;

        // Interaction State
        this.dragStart = null;
        this.editingVertexIndex = -1;
        this.hoveredVertexIndex = -1;

        // Viewport State
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStart = null;
    }

    reset() {
        this.shapes = [];
        this.groups = [];
        this.selectedIds = [];
        this.drawingPoints = [];
        this.tempShape = null;
        this.editingVertexIndex = -1;
        this.hoveredVertexIndex = -1;
    }
}

export const state = new AppState();
