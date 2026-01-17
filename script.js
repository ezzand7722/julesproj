// State
const state = {
    shapes: [],
    connectors: [],
    selectedId: null,
    nextId: 1,
    mode: 'select', // 'select' or 'connect'
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    draggedShapeId: null,
    connectorStartId: null
};

// DOM Elements
const canvas = document.getElementById('main-canvas');
const layerShapes = document.getElementById('layer-shapes');
const layerConnectors = document.getElementById('layer-connectors');
const textEditor = document.getElementById('text-editor');

// Toolbar Events - Drag and Drop
const draggables = document.querySelectorAll('.draggable-shape');
draggables.forEach(el => {
    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('shape-type', el.dataset.shape);
        e.dataTransfer.setData('shape-text', el.querySelector('span').innerText);
    });
});

const canvasContainer = document.getElementById('canvas-container');
canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('shape-type');
    const text = e.dataTransfer.getData('shape-text');
    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    createShape(type, x, y, text);
});

// Canvas Interactions
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('dblclick', handleDblClick);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
window.addEventListener('keydown', handleKeyDown);

// Functions
function createShape(type, x, y, textStr = 'Text') {
    const id = 'shape-' + state.nextId++;
    const shape = {
        id,
        type,
        x,
        y,
        text: textStr,
        width: 100,
        height: 50
    };

    if (type === 'circle') {
        shape.width = 60; // radius * 2 essentially
        shape.height = 60;
    } else if (type === 'diamond') {
        shape.width = 100;
        shape.height = 60;
    }

    state.shapes.push(shape);
    renderShape(shape);
    saveState();
    return shape;
}

function renderShape(shape) {
    let el = document.getElementById(shape.id);
    if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        el.setAttribute('id', shape.id);
        el.setAttribute('class', 'shape-group');
        layerShapes.appendChild(el);
    }

    el.innerHTML = ''; // Clear content to re-render

    // Draw the geometry
    let geometry;
    if (shape.type === 'rect') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        geometry.setAttribute('x', -shape.width / 2);
        geometry.setAttribute('y', -shape.height / 2);
        geometry.setAttribute('width', shape.width);
        geometry.setAttribute('height', shape.height);
        geometry.setAttribute('rx', 2);
    } else if (shape.type === 'round-rect') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        geometry.setAttribute('x', -shape.width / 2);
        geometry.setAttribute('y', -shape.height / 2);
        geometry.setAttribute('width', shape.width);
        geometry.setAttribute('height', shape.height);
        geometry.setAttribute('rx', 15);
    } else if (shape.type === 'circle') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        geometry.setAttribute('r', shape.width / 2);
    } else if (shape.type === 'diamond') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        geometry.setAttribute('points', `0,-${h} ${w},0 0,${h} -${w},0`);
    }

    el.appendChild(geometry);

    // Draw Text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = shape.text;
    el.appendChild(text); // Centered by CSS

    // Position
    el.setAttribute('transform', `translate(${shape.x}, ${shape.y})`);

    // Selection state
    if (state.selectedId === shape.id) {
        el.classList.add('selected');
    } else {
        el.classList.remove('selected');
    }
}

function handleMouseDown(e) {
    if (e.target.closest('#text-editor')) return; // Ignore clicks in editor

    const group = e.target.closest('.shape-group');

    if (group) {
        const id = group.id;
        selectElement(id);

        if (state.mode === 'select') {
            state.isDragging = true;
            state.draggedShapeId = id;
            const shape = state.shapes.find(s => s.id === id);

            // Calculate offset within the shape
            const pt = getSVGPoint(e);
            state.dragOffset = {
                x: pt.x - shape.x,
                y: pt.y - shape.y
            };
        } else if (state.mode === 'connect') {
            // Start connection
            if (!state.connectorStartId) {
                state.connectorStartId = id;
                // Highlight source?
            } else {
                // Complete connection
                if (state.connectorStartId !== id) {
                    createConnector(state.connectorStartId, id);
                }
                state.connectorStartId = null;
            }
        }
    } else {
        // Clicked on empty canvas
        selectElement(null);
    }
}

function handleMouseMove(e) {
    if (state.isDragging && state.draggedShapeId) {
        const pt = getSVGPoint(e);
        const shape = state.shapes.find(s => s.id === state.draggedShapeId);
        if (shape) {
            shape.x = pt.x - state.dragOffset.x;
            shape.y = pt.y - state.dragOffset.y;

            // Snap to grid (optional, simple 10px snap)
            shape.x = Math.round(shape.x / 10) * 10;
            shape.y = Math.round(shape.y / 10) * 10;

            renderShape(shape);
            updateConnectors(shape.id); // We'll implement this next
        }
    }
}

function handleMouseUp(e) {
    if (state.isDragging) {
        state.isDragging = false;
        state.draggedShapeId = null;
        saveState();
    }
}

function getSVGPoint(e) {
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function selectElement(id) {
    state.selectedId = id;
    // Re-render all to update selection class? Or just toggle class.
    // Toggling is faster.
    document.querySelectorAll('.shape-group, .connector').forEach(el => el.classList.remove('selected'));
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');
    }
}

function handleKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedId) {
            // Prevent backspace from navigating back if not editing text
            if (document.activeElement !== textEditor) {
                deleteElement(state.selectedId);
            }
        }
    }
}

function deleteElement(id) {
    if (id.startsWith('shape-')) {
        state.shapes = state.shapes.filter(s => s.id !== id);
        // Also remove associated connectors
        state.connectors = state.connectors.filter(c => c.source !== id && c.target !== id);
        const el = document.getElementById(id);
        if (el) el.remove();

        // Remove connector elements
        renderAllConnectors(); // Simplest way
    } else if (id.startsWith('conn-')) {
        state.connectors = state.connectors.filter(c => c.id !== id);
        const el = document.getElementById(id);
        if (el) el.remove();
    }
    state.selectedId = null;
    saveState();
}

function saveState() {
    localStorage.setItem('flowchartState', JSON.stringify(state));
}

// Toolbar Buttons
document.getElementById('btn-pointer').addEventListener('click', () => setMode('select'));
document.getElementById('btn-connector').addEventListener('click', () => setMode('connect'));
document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.selectedId) deleteElement(state.selectedId);
});
document.getElementById('btn-clear').addEventListener('click', () => {
    state.shapes = [];
    state.connectors = [];
    state.nextId = 1;
    layerShapes.innerHTML = '';
    layerConnectors.innerHTML = '';
    saveState();
});
document.getElementById('btn-save').addEventListener('click', () => {
    // Simple SVG export by serializing
    const svgData = new XMLSerializer().serializeToString(canvas);
    const blob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flowchart.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

function setMode(mode) {
    state.mode = mode;
    state.selectedId = null;
    state.connectorStartId = null;
    selectElement(null);

    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (mode === 'select') {
        document.getElementById('btn-pointer').classList.add('active');
        canvas.classList.remove('mode-connect');
        canvas.classList.add('mode-select');
    } else {
        document.getElementById('btn-connector').classList.add('active');
        canvas.classList.remove('mode-select');
        canvas.classList.add('mode-connect');
    }
}

// Connector Logic
function createConnector(sourceId, targetId) {
    // Check if already connected
    const exists = state.connectors.find(c => c.source === sourceId && c.target === targetId);
    if (exists) return;

    const id = 'conn-' + state.nextId++;
    const connector = { id, source: sourceId, target: targetId };
    state.connectors.push(connector);
    renderConnector(connector);
    saveState();
}

function renderConnector(connector) {
    let el = document.getElementById(connector.id);
    if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('id', connector.id);
        el.setAttribute('class', 'connector');
        el.setAttribute('marker-end', 'url(#arrowhead)');
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(connector.id);
        });
        layerConnectors.appendChild(el);
    }

    const sourceShape = state.shapes.find(s => s.id === connector.source);
    const targetShape = state.shapes.find(s => s.id === connector.target);

    if (sourceShape && targetShape) {
        const d = getConnectorPath(sourceShape, targetShape);
        el.setAttribute('d', d);
    }

    if (state.selectedId === connector.id) {
        el.classList.add('selected');
    } else {
        el.classList.remove('selected');
    }
}

function getConnectorPath(source, target) {
    // Simple straight line for now: Center to Center
    // Since lines are behind shapes, this looks okay.
    // For better visuals, we could calculate intersection with bounding box, but let's start simple.
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

function updateConnectors(shapeId) {
    const affected = state.connectors.filter(c => c.source === shapeId || c.target === shapeId);
    affected.forEach(c => renderConnector(c));
}

function renderAllConnectors() {
    // Remove deleted
    const currentIds = state.connectors.map(c => c.id);
    Array.from(layerConnectors.children).forEach(el => {
        if (!currentIds.includes(el.id)) el.remove();
    });

    state.connectors.forEach(renderConnector);
}

// Text Editing
function handleDblClick(e) {
    const group = e.target.closest('.shape-group');
    if (group) {
        const id = group.id;
        const shape = state.shapes.find(s => s.id === id);
        if (shape) {
            startTextEdit(shape);
        }
    }
}

function startTextEdit(shape) {
    const canvasRect = canvas.getBoundingClientRect();

    textEditor.style.display = 'block';
    // Position centered on shape
    textEditor.style.left = (canvasRect.left + shape.x) + 'px';
    textEditor.style.top = (canvasRect.top + shape.y) + 'px';
    textEditor.style.transform = 'translate(-50%, -50%)';
    textEditor.innerText = shape.text;

    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(textEditor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    textEditor.focus();

    const onBlur = () => {
        shape.text = textEditor.innerText;
        renderShape(shape);
        textEditor.style.display = 'none';
        saveState();
        textEditor.removeEventListener('blur', onBlur);
        textEditor.removeEventListener('keydown', onEnter);
    };

    const onEnter = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textEditor.blur();
        }
    };

    textEditor.addEventListener('blur', onBlur);
    textEditor.addEventListener('keydown', onEnter);
}

// Initialize
loadState();

function loadState() {
    const saved = localStorage.getItem('flowchartState');
    if (saved) {
        try {
            const loadedState = JSON.parse(saved);
            state.shapes = loadedState.shapes || [];
            state.connectors = loadedState.connectors || [];
            state.nextId = loadedState.nextId || 1;

            // Restore shapes
            state.shapes.forEach(renderShape);
            // Restore connectors
            state.connectors.forEach(renderConnector);
        } catch (e) {
            console.error('Failed to load state', e);
        }
    }
}
