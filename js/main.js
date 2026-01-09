import { state } from './state.js';
import { render } from './renderer.js';
import { bindInput } from './input.js';
import { bindUI } from './ui.js';
import { loadFromStorage, loadCurrentProject } from './io.js';

function init() {
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    resizeCanvas(canvas);
    window.addEventListener('resize', () => resizeCanvas(canvas));

    bindInput(canvas);
    bindUI(canvas);

    // Load initial data
    const currentProject = loadCurrentProject();
    if (currentProject) {
        loadFromStorage(currentProject);
    }

    render(canvas, ctx);
}

function resizeCanvas(canvas) {
    const container = document.getElementById('canvasContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    render(canvas, canvas.getContext('2d'));
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
