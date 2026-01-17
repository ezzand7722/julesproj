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
    connectorStartId: null,
    // History
    history: [],
    historyIndex: -1,
    // Viewport
    zoom: 1,
    pan: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 }
};

// DOM Elements
const canvas = document.getElementById('main-canvas');
const viewport = document.getElementById('viewport');
const layerShapes = document.getElementById('layer-shapes');
const layerConnectors = document.getElementById('layer-connectors');
const textEditor = document.getElementById('text-editor');
const propPanel = document.getElementById('prop-controls');
const propEmpty = document.getElementById('prop-empty');

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
    const x = (e.clientX - rect.left - state.pan.x) / state.zoom;
    const y = (e.clientY - rect.top - state.pan.y) / state.zoom;

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
    pushToHistory(); // Save state before creation

    const id = 'shape-' + state.nextId++;
    const shape = {
        id,
        type,
        x,
        y,
        text: textStr,
        width: 100,
        height: 50,
        fill: '#ffffff',
        stroke: '#333333',
        strokeWidth: 2,
        textColor: '#333333'
    };

    if (type === 'circle') {
        shape.width = 60; // radius * 2 essentially
        shape.height = 60;
    } else if (type === 'diamond') {
        shape.width = 100;
        shape.height = 60;
    } else if (type === 'triangle' || type === 'star' || type === 'hexagon') {
        shape.width = 80;
        shape.height = 80;
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
    } else if (shape.type === 'triangle') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        geometry.setAttribute('points', `0,-${h} ${w},${h} -${w},${h}`);
    } else if (shape.type === 'star') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        // Simple star approximation
        const outer = shape.width / 2;
        const inner = outer * 0.4;
        let points = '';
        for(let i=0; i<10; i++) {
            const r = (i % 2 === 0) ? outer : inner;
            const a = Math.PI * i / 5 - Math.PI/2;
            points += `${Math.cos(a)*r},${Math.sin(a)*r} `;
        }
        geometry.setAttribute('points', points);
    } else if (shape.type === 'hexagon') {
        geometry = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        // Pointy top hexagon
        // points: top, top-right, bot-right, bot, bot-left, top-left
        geometry.setAttribute('points', `0,-${h} ${w},-${h/2} ${w},${h/2} 0,${h} -${w},${h/2} -${w},-${h/2}`);
    }

    // Apply Styles
    if (geometry) {
        geometry.setAttribute('fill', shape.fill || '#fff');
        geometry.setAttribute('stroke', shape.stroke || '#333');
        geometry.setAttribute('stroke-width', shape.strokeWidth || 2);
    }

    el.appendChild(geometry);

    // Draw Text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = shape.text;
    text.setAttribute('fill', shape.textColor || '#333');
    el.appendChild(text);

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

    // Middle click or Space+Click for Pan
    if (e.button === 1 || (state.mode === 'select' && e.code === 'Space')) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    const group = e.target.closest('.shape-group');

    if (group) {
        const id = group.id;
        selectElement(id);

        if (state.mode === 'select') {
            pushToHistory(); // Save before potential move
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
    } else if (state.isPanning) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;

        state.pan.x += dx;
        state.pan.y += dy;

        state.panStart = { x: e.clientX, y: e.clientY };
        updateViewport();
    }
}

function handleMouseUp(e) {
    if (state.isDragging) {
        state.isDragging = false;
        state.draggedShapeId = null;
        saveState(); // Update current state
    }
    if (state.isPanning) {
        state.isPanning = false;
        canvas.style.cursor = 'default';
        saveState();
    }
}

function getSVGPoint(e) {
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    // We need to account for viewport transform manually or use getScreenCTM of the viewport group?
    // Using viewport group CTM is better.
    return pt.matrixTransform(viewport.getScreenCTM().inverse());
}

function selectElement(id) {
    state.selectedId = id;
    // Re-render all to update selection class? Or just toggle class.
    // Toggling is faster.
    document.querySelectorAll('.shape-group, .connector').forEach(el => el.classList.remove('selected'));
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');

        // Update Property Panel
        const shape = state.shapes.find(s => s.id === id);
        if (shape) {
            propEmpty.style.display = 'none';
            propPanel.style.display = 'block';
            document.getElementById('prop-fill').value = shape.fill || '#ffffff';
            document.getElementById('prop-stroke').value = shape.stroke || '#333333';
            document.getElementById('prop-stroke-width').value = shape.strokeWidth || 2;
            document.getElementById('prop-text-color').value = shape.textColor || '#333333';
        } else {
            // Connector selected
             propEmpty.style.display = 'block';
             propPanel.style.display = 'none';
        }
    } else {
        propEmpty.style.display = 'block';
        propPanel.style.display = 'none';
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
    // Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
    }
}

function deleteElement(id) {
    pushToHistory();
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
    selectElement(null); // Clear selection
    saveState();
}

function saveState() {
    // We don't save history to local storage to avoid quota issues
    const { history, historyIndex, ...persistentState } = state;
    localStorage.setItem('flowchartState', JSON.stringify(persistentState));
}

// History Functions
function pushToHistory() {
    // Remove future states if we are in the middle of history
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Deep copy state (excluding history itself)
    const snapshot = JSON.stringify({
        shapes: state.shapes,
        connectors: state.connectors,
        nextId: state.nextId
    });

    state.history.push(snapshot);
    state.historyIndex++;

    // Limit history size
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
}

function undo() {
    if (state.historyIndex >= 0) {
        // Save current state to "redo" slot (effectively index + 1)
        const currentSnapshot = JSON.stringify({
            shapes: state.shapes,
            connectors: state.connectors,
            nextId: state.nextId
        });

        if (state.historyIndex === state.history.length - 1) {
            state.history.push(currentSnapshot);
        } else {
            state.history[state.historyIndex + 1] = currentSnapshot;
        }

        const prevSnapshot = state.history[state.historyIndex];
        loadSnapshot(prevSnapshot);
        state.historyIndex--;
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 2) {
         state.historyIndex++;
         const nextSnapshot = state.history[state.historyIndex + 1];
         loadSnapshot(nextSnapshot);
    }
}

function loadSnapshot(json) {
    const data = JSON.parse(json);
    state.shapes = data.shapes;
    state.connectors = data.connectors;
    state.nextId = data.nextId;

    layerShapes.innerHTML = '';
    layerConnectors.innerHTML = '';
    state.shapes.forEach(renderShape);
    state.connectors.forEach(renderConnector);
    saveState();
}

// Toolbar Buttons
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

document.getElementById('btn-zoom-in').addEventListener('click', () => {
    state.zoom *= 1.2;
    updateViewport();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
    state.zoom /= 1.2;
    updateViewport();
});
document.getElementById('btn-reset-view').addEventListener('click', () => {
    state.zoom = 1;
    state.pan = {x: 0, y: 0};
    updateViewport();
});

document.getElementById('btn-pointer').addEventListener('click', () => setMode('select'));
document.getElementById('btn-connector').addEventListener('click', () => setMode('connect'));
document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.selectedId) deleteElement(state.selectedId);
});
document.getElementById('btn-clear').addEventListener('click', () => {
    pushToHistory();
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
    pushToHistory();
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
    // Calculate vector
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check for zero distance
    if (dist === 0) return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;

    // Approximate edge intersection
    // We want to stop at target's edge so arrowhead is visible
    // Simple approach: subtract half of target's approx size
    // Most shapes are roughly 60-100px wide.
    // Let's assume a safe buffer of ~40px (half of 80)

    // Better: use specific shape width
    const targetRadius = (target.width + target.height) / 4;

    // Shorten the line by targetRadius + arrowhead size (10)
    const shortenBy = targetRadius + 5;

    if (dist < shortenBy) return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;

    const scale = (dist - shortenBy) / dist;

    const targetX = source.x + dx * scale;
    const targetY = source.y + dy * scale;

    return `M ${source.x} ${source.y} L ${targetX} ${targetY}`;
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

// Viewport Logic
function updateViewport() {
    viewport.setAttribute('transform', `translate(${state.pan.x}, ${state.pan.y}) scale(${state.zoom})`);
    // Store in local storage?
    saveState();
}

canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        state.zoom *= zoomFactor;
        updateViewport();
    }
});

// Property Panel Logic
function updateSelectedShapeProp(prop, value) {
    if (!state.selectedId || !state.selectedId.startsWith('shape-')) return;

    // We should probably save history here too, but maybe debounce it?
    // For simplicity, let's save history on "change" which is what color inputs trigger.
    pushToHistory();

    const shape = state.shapes.find(s => s.id === state.selectedId);
    if (shape) {
        shape[prop] = value;
        renderShape(shape);
        saveState();
    }
}

document.getElementById('prop-fill').addEventListener('change', (e) => updateSelectedShapeProp('fill', e.target.value));
document.getElementById('prop-stroke').addEventListener('change', (e) => updateSelectedShapeProp('stroke', e.target.value));
document.getElementById('prop-stroke-width').addEventListener('input', (e) => updateSelectedShapeProp('strokeWidth', e.target.value));
document.getElementById('prop-text-color').addEventListener('change', (e) => updateSelectedShapeProp('textColor', e.target.value));

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
    // Position centered on shape considering zoom/pan
    const screenX = shape.x * state.zoom + state.pan.x + canvasRect.left;
    const screenY = shape.y * state.zoom + state.pan.y + canvasRect.top;

    textEditor.style.left = screenX + 'px';
    textEditor.style.top = screenY + 'px';
    textEditor.style.transform = 'translate(-50%, -50%)';
    textEditor.innerText = shape.text;
    textEditor.style.color = shape.textColor || '#333';

    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(textEditor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    textEditor.focus();

    const onBlur = () => {
        pushToHistory();
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

            // Restore Viewport
            state.zoom = loadedState.zoom || 1;
            state.pan = loadedState.pan || { x: 0, y: 0 };
            updateViewport();

            // Restore shapes
            state.shapes.forEach(renderShape);
            // Restore connectors
            state.connectors.forEach(renderConnector);
        } catch (e) {
            console.error('Failed to load state', e);
        }
    }
}
