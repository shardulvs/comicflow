// Comic Viewer JavaScript

// Global Variables
let comicPages = [];
let currentPageIndex = 0;
let scale = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let isWesternMode = true;
let isDoublePageLayout = false;
let panelDetectionEnabled = false;
let detectPanelsTimeout;
let speechBubbles = [];
let bubbleBeingEdited = null;

// DOM Elements
const comicContainer = document.getElementById('comic-container');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileSelectButton = document.getElementById('file-select');
const pageInfo = document.getElementById('page-info');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const zoomResetButton = document.getElementById('zoom-reset');
const fitToWidthButton = document.getElementById('fit-to-width');
const fitToHeightButton = document.getElementById('fit-to-height');
const toggleDarkModeButton = document.getElementById('toggle-dark-mode');
const toggleFullscreenButton = document.getElementById('toggle-fullscreen');
const openComicButton = document.getElementById('open-comic');
const saveStateButton = document.getElementById('save-state');
const loadStateButton = document.getElementById('load-state');
const westernModeButton = document.getElementById('western-mode');
const mangaModeButton = document.getElementById('manga-mode');
const singlePageButton = document.getElementById('single-page');
const doublePageButton = document.getElementById('double-page');
const autoDetectButton = document.getElementById('auto-detect');
const speechBubbleEditor = document.getElementById('speech-bubble-editor');
const bubbleText = document.getElementById('bubble-text');
const addBubbleButton = document.getElementById('add-bubble');
const bubbleTypeSelect = document.getElementById('bubble-type');
const closeEditorButton = document.getElementById('close-editor');
const keyboardShortcuts = document.getElementById('keyboard-shortcuts');
const closeShortcutsButton = document.getElementById('close-shortcuts');

// Initialize the comic viewer
function initializeViewer() {
    // Add event listeners
    setupEventListeners();

    // Check local storage for saved state
    loadStateFromLocalStorage();

    // Update UI
    updatePageInfo();
    updateDarkModeUI();
}

// Setup all event listeners
function setupEventListeners() {
    // File input and drag & drop
    fileSelectButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Navigation buttons
    prevPageButton.addEventListener('click', prevPage);
    nextPageButton.addEventListener('click', nextPage);

    // Zoom controls
    zoomInButton.addEventListener('click', zoomIn);
    zoomOutButton.addEventListener('click', zoomOut);
    zoomResetButton.addEventListener('click', resetZoom);
    fitToWidthButton.addEventListener('click', fitToWidth);
    fitToHeightButton.addEventListener('click', fitToHeight);

    // UI toggle buttons
    toggleDarkModeButton.addEventListener('click', toggleDarkMode);
    toggleFullscreenButton.addEventListener('click', toggleFullscreen);

    // Save/Load state
    saveStateButton.addEventListener('click', saveState);
    loadStateButton.addEventListener('click', loadState);
    
    // Reading mode
    westernModeButton.addEventListener('click', () => setReadingMode('western'));
    mangaModeButton.addEventListener('click', () => setReadingMode('manga'));
    
    // Layout mode
    singlePageButton.addEventListener('click', () => setLayoutMode('single'));
    doublePageButton.addEventListener('click', () => setLayoutMode('double'));
    autoDetectButton.addEventListener('click', togglePanelDetection);

    // Mouse and touch events for pan and zoom
    comicContainer.addEventListener('mousedown', startDrag);
    comicContainer.addEventListener('mousemove', drag);
    comicContainer.addEventListener('mouseup', endDrag);
    comicContainer.addEventListener('mouseleave', endDrag);
    comicContainer.addEventListener('wheel', handleWheel);
    
    // Touch events
    comicContainer.addEventListener('touchstart', handleTouchStart);
    comicContainer.addEventListener('touchmove', handleTouchMove);
    comicContainer.addEventListener('touchend', handleTouchEnd);

    // Speech bubble editor
    closeEditorButton.addEventListener('click', closeSpeechBubbleEditor);
    addBubbleButton.addEventListener('click', addSpeechBubble);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    closeShortcutsButton.addEventListener('click', hideKeyboardShortcuts);
}

// Handle file selection from input
function handleFileSelect(event) {
    const files = event.target.files;
    processFiles(files);
}

// Handle drag over event
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add('dragover');
}

// Handle drag leave event
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('dragover');
}

// Handle file drop event
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    processFiles(files);
}

// Process the selected files
function processFiles(files) {
    // Clear existing pages
    comicPages = [];
    currentPageIndex = 0;
    
    // Show loading spinner
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'loading-spinner';
    comicContainer.appendChild(loadingSpinner);
    
    // Hide drop zone
    dropZone.style.display = 'none';
    
    // Process each file
    const promises = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if the file is an image
        if (file.type.startsWith('image/')) {
            promises.push(loadImage(file));
        }
    }
    
    // Wait for all images to load
    Promise.all(promises)
        .then(images => {
            // Sort images by name
            images.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }));
            
            // Add sorted images to comicPages
            comicPages = images.map(img => ({
                element: img.element,
                fileName: img.fileName,
                width: img.element.naturalWidth,
                height: img.element.naturalHeight,
                panels: []
            }));
            
            // Remove loading spinner
            comicContainer.removeChild(loadingSpinner);
            
            // Show first page
            showPage(0);
            
            // Save state to local storage
            saveStateToLocalStorage();
        })
        .catch(error => {
            console.error('Error loading images:', error);
            // Remove loading spinner
            comicContainer.removeChild(loadingSpinner);
            // Show drop zone again
            dropZone.style.display = 'flex';
        });
}

// Load an image from a file
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            
            img.onload = function() {
                resolve({
                    element: img,
                    fileName: file.name
                });
            };
            
            img.onerror = function() {
                reject(new Error(`Failed to load image: ${file.name}`));
            };
            
            img.src = e.target.result;
            img.classList.add('comic-page');
            img.classList.add('hidden');
            img.setAttribute('data-filename', file.name);
            img.setAttribute('draggable', 'false');
        };
        
        reader.onerror = function() {
            reject(new Error(`Failed to read file: ${file.name}`));
        };
        
        reader.readAsDataURL(file);
    });
}

// Show a specific page
function showPage(index) {
    if (comicPages.length === 0) return;
    
    // Ensure index is within bounds
    index = Math.max(0, Math.min(comicPages.length - 1, index));
    
    // Remove all current pages
    while (comicContainer.firstChild) {
        comicContainer.removeChild(comicContainer.firstChild);
    }
    
    // Reset transform
    comicContainer.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    
    currentPageIndex = index;
    
    if (isDoublePageLayout && index < comicPages.length - 1) {
        // Show two pages side by side
        const leftIndex = isWesternMode ? index : index + 1;
        const rightIndex = isWesternMode ? index + 1 : index;
        
        const leftPage = comicPages[leftIndex].element.cloneNode(true);
        const rightPage = comicPages[rightIndex].element.cloneNode(true);
        
        leftPage.classList.remove('hidden');
        rightPage.classList.remove('hidden');
        
        comicContainer.appendChild(leftPage);
        comicContainer.appendChild(rightPage);
        
        comicContainer.classList.add('double-page');
    } else {
        // Show single page
        const page = comicPages[index].element.cloneNode(true);
        page.classList.remove('hidden');
        comicContainer.appendChild(page);
        comicContainer.classList.remove('double-page');
    }
    
    // Add panels if panel detection is enabled
    if (panelDetectionEnabled) {
        detectPanels();
    }
    
    // Add speech bubbles for this page
    addSpeechBubblesToPage();
    
    // Update page info
    updatePageInfo();
}

// Navigate to the previous page
function prevPage() {
    if (currentPageIndex > 0) {
        showPage(isDoublePageLayout ? currentPageIndex - 2 : currentPageIndex - 1);
    }
}

// Navigate to the next page
function nextPage() {
    if (currentPageIndex < comicPages.length - 1) {
        showPage(isDoublePageLayout ? currentPageIndex + 2 : currentPageIndex + 1);
    }
}

// Update the page info display
function updatePageInfo() {
    if (comicPages.length === 0) {
        pageInfo.textContent = 'Page 0 of 0';
        return;
    }
    
    const currentPage = currentPageIndex + 1;
    const totalPages = comicPages.length;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Zoom in on the comic
function zoomIn() {
    scale *= 1.2;
    updateTransform();
}

// Zoom out of the comic
function zoomOut() {
    scale /= 1.2;
    updateTransform();
}

// Reset the zoom level
function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

// Fit the comic to the width of the viewport
function fitToWidth() {
    if (comicPages.length === 0) return;
    
    const viewerWidth = comicContainer.parentElement.clientWidth;
    const pageWidth = isDoublePageLayout ? 
        comicPages[currentPageIndex].width + comicPages[Math.min(currentPageIndex + 1, comicPages.length - 1)].width : 
        comicPages[currentPageIndex].width;
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    scale = viewerWidth / pageWidth * 0.9;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

// Fit the comic to the height of the viewport
function fitToHeight() {
    if (comicPages.length === 0) return;
    
    const viewerHeight = comicContainer.parentElement.clientHeight;
    const pageHeight = comicPages[currentPageIndex].height;
    
    scale = viewerHeight / pageHeight * 0.9;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

// Update the transform style for zooming and panning
function updateTransform() {
    comicContainer.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    updateDarkModeUI();
    saveStateToLocalStorage();
}

// Update the dark mode button UI
function updateDarkModeUI() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    toggleDarkModeButton.innerHTML = isDarkMode ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
}

// Toggle fullscreen mode
function toggleFullscreen() {
    const appContainer = document.querySelector('.app-container');
    
    if (!document.fullscreenElement) {
        if (appContainer.requestFullscreen) {
            appContainer.requestFullscreen();
        } else if (appContainer.mozRequestFullScreen) { // Firefox
            appContainer.mozRequestFullScreen();
        } else if (appContainer.webkitRequestFullscreen) { // Chrome, Safari, Opera
            appContainer.webkitRequestFullscreen();
        } else if (appContainer.msRequestFullscreen) { // IE/Edge
            appContainer.msRequestFullscreen();
        }
        appContainer.classList.add('fullscreen');
        toggleFullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        appContainer.classList.remove('fullscreen');
        toggleFullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

// Handle fullscreen change events
document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('mozfullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
document.addEventListener('msfullscreenchange', updateFullscreenUI);

// Update fullscreen UI based on current state
function updateFullscreenUI() {
    const appContainer = document.querySelector('.app-container');
    
    if (!document.fullscreenElement) {
        appContainer.classList.remove('fullscreen');
        toggleFullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
    } else {
        appContainer.classList.add('fullscreen');
        toggleFullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
    }
}

// Start dragging for panning
function startDrag(event) {
    // Don't pan if we're interacting with a panel or speech bubble
    if (event.target.classList.contains('comic-panel') || 
        event.target.classList.contains('speech-bubble')) {
        return;
    }
    
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    comicContainer.style.cursor = 'grabbing';
}

// Handle dragging for panning
function drag(event) {
    if (!isDragging) return;
    
    const deltaX = (event.clientX - startX) / scale;
    const deltaY = (event.clientY - startY) / scale;
    
    translateX += deltaX;
    translateY += deltaY;
    
    updateTransform();
    
    startX = event.clientX;
    startY = event.clientY;
}

// End dragging
function endDrag() {
    isDragging = false;
    comicContainer.style.cursor = 'default';
}

// Handle mouse wheel for zooming
function handleWheel(event) {
    event.preventDefault();
    
    // Calculate where in the image the cursor is pointing
    const rect = comicContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert to coordinates in the transformed space
    const transformX = (mouseX / scale) - translateX;
    const transformY = (mouseY / scale) - translateY;
    
    // Zoom in or out
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    scale *= delta;
    
    // Adjust translation to zoom toward the cursor
    translateX = (mouseX / scale) - transformX;
    translateY = (mouseY / scale) - transformY;
    
    updateTransform();
}

// Handle touch start for mobile
function handleTouchStart(event) {
    if (event.touches.length === 1) {
        // Single touch for panning
        isDragging = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
        // Pinch to zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        
        event.currentDistance = dist;
    }
}

// Handle touch move for mobile
function handleTouchMove(event) {
    event.preventDefault();
    
    if (event.touches.length === 1 && isDragging) {
        // Single touch for panning
        const deltaX = (event.touches[0].clientX - startX) / scale;
        const deltaY = (event.touches[0].clientY - startY) / scale;
        
        translateX += deltaX;
        translateY += deltaY;
        
        updateTransform();
        
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
        // Pinch to zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        
        if (event.currentDistance) {
            const delta = dist / event.currentDistance;
            
            // Calculate center of pinch
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            // Convert to coordinates in the transformed space
            const rect = comicContainer.getBoundingClientRect();
            const transformX = ((centerX - rect.left) / scale) - translateX;
            const transformY = ((centerY - rect.top) / scale) - translateY;
            
            // Zoom
            scale *= delta;
            
            // Adjust translation to zoom toward the pinch center
            translateX = ((centerX - rect.left) / scale) - transformX;
            translateY = ((centerY - rect.top) / scale) - transformY;
            
            updateTransform();
        }
        
        event.currentDistance = dist;
    }
}

// Handle touch end for mobile
function handleTouchEnd() {
    isDragging = false;
}

// Save the current state
function saveState() {
    const state = createSaveState();
    
    // Create a data URL for the state
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    
    // Create a download link
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "comic_state.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Create a save state object
function createSaveState() {
    return {
        currentPageIndex: currentPageIndex,
        scale: scale,
        translateX: translateX,
        translateY: translateY,
        isWesternMode: isWesternMode,
        isDoublePageLayout: isDoublePageLayout,
        panelDetectionEnabled: panelDetectionEnabled,
        isDarkMode: document.body.classList.contains('dark-mode'),
        speechBubbles: speechBubbles
    };
}

// Load a previously saved state
function loadState() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                applyLoadedState(state);
            } catch (error) {
                console.error('Error parsing state file:', error);
                alert('Invalid state file. Please select a valid comic state file.');
            }
        };
        
        reader.onerror = () => {
            console.error('Error reading state file');
            alert('Failed to read the state file.');
        };
        
        reader.readAsText(file);
    };
    
    fileInput.click();
}

// Apply a loaded state
function applyLoadedState(state) {
    currentPageIndex = state.currentPageIndex || 0;
    scale = state.scale || 1;
    translateX = state.translateX || 0;
    translateY = state.translateY || 0;
    isWesternMode = state.isWesternMode !== undefined ? state.isWesternMode : true;
    isDoublePageLayout = state.isDoublePageLayout || false;
    panelDetectionEnabled = state.panelDetectionEnabled || false;
    
    // Apply dark mode
    if (state.isDarkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    updateDarkModeUI();
    
    // Apply speech bubbles
    if (state.speechBubbles) {
        speechBubbles = state.speechBubbles;
    }
    
    // Show current page
    showPage(currentPageIndex);
}

// Save state to local storage
function saveStateToLocalStorage() {
    try {
        const state = createSaveState();
        localStorage.setItem('comicViewerState', JSON.stringify(state));
    } catch (error) {
        console.error('Error saving state to local storage:', error);
    }
}

// Load state from local storage
function loadStateFromLocalStorage() {
    try {
        const savedState = localStorage.getItem('comicViewerState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Only apply display settings, not page-specific settings
            isWesternMode = state.isWesternMode !== undefined ? state.isWesternMode : true;
            isDoublePageLayout = state.isDoublePageLayout || false;
            panelDetectionEnabled = state.panelDetectionEnabled || false;
            
            // Apply dark mode
            if (state.isDarkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            updateDarkModeUI();
        }
    } catch (error) {
        console.error('Error loading state from local storage:', error);
    }
}

// Set the reading mode (western or manga)
function setReadingMode(mode) {
    isWesternMode = mode === 'western';
    
    if (isWesternMode) {
        comicContainer.classList.remove('manga-mode');
    } else {
        comicContainer.classList.add('manga-mode');
    }
    
    // Reload current page to apply changes
    showPage(currentPageIndex);
    
    // Save settings
    saveStateToLocalStorage();
}

// Set the layout mode (single or double)
function setLayoutMode(mode) {
    isDoublePageLayout = mode === 'double';
    
    // Reload current page to apply changes
    showPage(currentPageIndex);
    
    // Save settings
    saveStateToLocalStorage();
}

// Toggle panel detection
function togglePanelDetection() {
    panelDetectionEnabled = !panelDetectionEnabled;
    
    if (panelDetectionEnabled) {
        detectPanels();
    } else {
        // Remove panel overlays
        const panels = document.querySelectorAll('.comic-panel');
        panels.forEach(panel => panel.remove());
    }
    
    // Save settings
    saveStateToLocalStorage();
}

// Detect panels in the current page
function detectPanels() {
    if (comicPages.length === 0) return;
    
    // Clear existing timeout
    if (detectPanelsTimeout) {
        clearTimeout(detectPanelsTimeout);
    }
    
    // Wait for the page to fully render
    detectPanelsTimeout = setTimeout(() => {
        // Show loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner';
        comicContainer.appendChild(loadingSpinner);
        
        // Use a timeout to allow the spinner to render
        setTimeout(() => {
            // Get the current page image
            const currentPage = comicPages[currentPageIndex];
            const img = comicContainer.querySelector('.comic-page:not(.hidden)');
            
            if (!img) {
                comicContainer.removeChild(loadingSpinner);
                return;
            }
            
            // Check if we already have panels for this page
            if (currentPage.panels.length > 0) {
                // Add existing panels
                currentPage.panels.forEach(panel => {
                    addPanelOverlay(panel.x, panel.y, panel.width, panel.height);
                });
                
                comicContainer.removeChild(loadingSpinner);
                return;
            }
            
            // Create a canvas to analyze the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = currentPage.width;
            canvas.height = currentPage.height;
            
            // Draw the image on the canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Simple panel detection algorithm
            // Find contiguous white/light regions surrounded by dark borders
            
            // For simplicity, we'll divide the image into a grid and find areas with
            // certain characteristics
            
            const gridSize = 20;
            const panelThreshold = 0.8;
            const rows = Math.floor(canvas.height / gridSize);
            const cols = Math.floor(canvas.width / gridSize);
            
            // Create a grid to track potential panel areas
            const grid = Array(rows).fill().map(() => Array(cols).fill(0));
            
            // Analyze each grid cell
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const startX = x * gridSize;
                    const startY = y * gridSize;
                    
                    let darkPixels = 0;
                    let totalPixels = 0;
                    
                    // Analyze pixels in this grid cell
                    for (let j = 0; j < gridSize && startY + j < canvas.height; j++) {
                        for (let i = 0; i < gridSize && startX + i < canvas.width; i++) {
                            const index = ((startY + j) * canvas.width + (startX + i)) * 4;
                            const r = data[index];
                            const g = data[index + 1];
                            const b = data[index + 2];
                            
                            // Calculate brightness
                            const brightness = (r + g + b) / 3;
                            
                            if (brightness < 200) {
                                darkPixels++;
                            }
                            
                            totalPixels++;
                        }
                    }
                    
                    // Mark as potential panel edge if it has enough dark pixels
                    if (darkPixels / totalPixels > 0.3) {
                        grid[y][x] = 1;
                    }
                }
            }
            
            // Find connected components (potential panels)
            const visited = Array(rows).fill().map(() => Array(cols).fill(false));
            const panels = [];
            
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (grid[y][x] === 0 && !visited[y][x]) {
                        // Start of a potential panel
                        const panelCells = [];
                        const queue = [{x, y}];
                        visited[y][x] = true;
                        
                        while (queue.length > 0) {
                            const current = queue.shift();
                            panelCells.push(current);
                            
                            // Check neighbors
                            const directions = [
                                {dx: -1, dy: 0}, // left
                                {dx: 1, dy: 0},  // right
                                {dx: 0, dy: -1}, // up
                                {dx: 0, dy: 1}   // down
                            ];
                            
                            for (const dir of directions) {
                                const nx = current.x + dir.dx;
                                const ny = current.y + dir.dy;
                                
                                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && 
                                    grid[ny][nx] === 0 && !visited[ny][nx]) {
                                    queue.push({x: nx, y: ny});
                                    visited[ny][nx] = true;
                                }
                            }
                        }
                        
                        // If the panel is large enough, add it
                        if (panelCells.length > 4) {
                            // Find bounding box
                            let minX = cols, minY = rows, maxX = 0, maxY = 0;
                            
                            for (const cell of panelCells) {
                                minX = Math.min(minX, cell.x);
                                minY = Math.min(minY, cell.y);
                                maxX = Math.max(maxX, cell.x);
                                maxY = Math.max(maxY, cell.y);
                            }
                            
                            // Convert to pixel coordinates
                            const panelX = minX * gridSize;
                            const panelY = minY * gridSize;
                            const panelWidth = (maxX - minX + 1) * gridSize;
                            const panelHeight = (maxY - minY + 1) * gridSize;
                            
                            // Add panel
                            panels.push({
                                x: panelX,
                                y: panelY,
                                width: panelWidth,
                                height: panelHeight
                            });
                        }
                    }
                }
            }
            
            // Filter out panels that are too small
            const filteredPanels = panels.filter(panel => 
                panel.width > canvas.width * 0.1 && 
                panel.height > canvas.height * 0.1);
            
            // Store panels for this page
            currentPage.panels = filteredPanels;
            
            // Add panel overlays
            filteredPanels.forEach(panel => {
                addPanelOverlay(panel.x, panel.y, panel.width, panel.height);
            });
            
            // Remove loading spinner
            comicContainer.removeChild(loadingSpinner);
        }, 50);
    }, 300);
}

// Add a panel overlay element
function addPanelOverlay(x, y, width, height) {
    const panel = document.createElement('div');
    panel.className = 'comic-panel';
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    
    // Add click event to focus on this panel
    panel.addEventListener('click', () => {
        focusOnPanel(x, y, width, height);
    });
    
    comicContainer.appendChild(panel);
}

// Focus on a specific panel
function focusOnPanel(x, y, width, height) {
    const viewerWidth = comicContainer.parentElement.clientWidth;
    const viewerHeight = comicContainer.parentElement.clientHeight;
    
    // Calculate scale to fit the panel
    const scaleX = viewerWidth / width * 0.9;
    const scaleY = viewerHeight / height * 0.9;
    scale = Math.min(scaleX, scaleY);
    
    // Calculate translation to center the panel
    translateX = -x - width / 2 + viewerWidth / 2 / scale;
    translateY = -y - height / 2 + viewerHeight / 2 / scale;
    
    updateTransform();
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(event) {
    // Don't handle shortcuts if focus is in textarea
    if (event.target.tagName === 'TEXTAREA') return;
    
    switch (event.key) {
        case 'ArrowRight':
        case ' ':
            event.preventDefault();
            nextPage();
            break;
        case 'ArrowLeft':
        case 'Backspace':
            event.preventDefault();
            prevPage();
            break;
        case 'Home':
            event.preventDefault();
            showPage(0);
            break;
        case 'End':
            event.preventDefault();
            showPage(comicPages.length - 1);
            break;
        case '+':
        case '=':
            event.preventDefault();
            zoomIn();
            break;
        case '-':
            event.preventDefault();
            zoomOut();
            break;
        case '0':
            event.preventDefault();
            resetZoom();
            break;
        case 'f':
        case 'F':
            event.preventDefault();
            toggleFullscreen();
            break;
        case 'd':
        case 'D':
            event.preventDefault();
            toggleDarkMode();
            break;
        case 's':
        case 'S':
            event.preventDefault();
            saveState();
            break;
        case 'l':
        case 'L':
            event.preventDefault();
            loadState();
            break;
        case '1':
            event.preventDefault();
            setLayoutMode('single');
            break;
        case '2':
            event.preventDefault();
            setLayoutMode('double');
            break;
        case 'm':
        case 'M':
            event.preventDefault();
            setReadingMode(isWesternMode ? 'manga' : 'western');
            break;
        case 'p':
        case 'P':
            event.preventDefault();
            togglePanelDetection();
            break;
        case '?':
            event.preventDefault();
            toggleKeyboardShortcuts();
            break;
        case 'b':
        case 'B':
            event.preventDefault();
            openSpeechBubbleEditor();
            break;
    }
}

// Toggle keyboard shortcuts display
function toggleKeyboardShortcuts() {
    keyboardShortcuts.classList.toggle('active');
}

// Hide keyboard shortcuts
function hideKeyboardShortcuts() {
    keyboardShortcuts.classList.remove('active');
}

// Open speech bubble editor
function openSpeechBubbleEditor() {
    speechBubbleEditor.classList.add('active');
    bubbleText.focus();
}

// Close speech bubble editor
function closeSpeechBubbleEditor() {
    speechBubbleEditor.classList.remove('active');
    bubbleBeingEdited = null;
}

// Add a speech bubble
function addSpeechBubble() {
    const text = bubbleText.value.trim();
    if (text === '') return;
    
    const type = bubbleTypeSelect.value;
    
    const newBubble = {
        pageIndex: currentPageIndex,
        text: text,
        type: type,
        x: 100,
        y: 100
    };
    
    speechBubbles.push(newBubble);
    
    // Add bubble to current page
    addBubbleToPage(newBubble);
    
    // Clear editor
    bubbleText.value = '';
    closeSpeechBubbleEditor();
    
    // Save state
    saveStateToLocalStorage();
}

// Add speech bubbles to the current page
function addSpeechBubblesToPage() {
    const pageBubbles = speechBubbles.filter(bubble => bubble.pageIndex === currentPageIndex);
    
    pageBubbles.forEach(bubble => {
        addBubbleToPage(bubble);
    });
}

// Add a bubble element to the page
function addBubbleToPage(bubble) {
    const bubbleElem = document.createElement('div');
    bubbleElem.className = `speech-bubble ${bubble.type}`;
    bubbleElem.textContent = bubble.text;
    bubbleElem.style.left = `${bubble.x}px`;
    bubbleElem.style.top = `${bubble.y}px`;
    
    // Make bubble draggable
    bubbleElem.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = parseInt(bubbleElem.style.left);
        const startTop = parseInt(bubbleElem.style.top);
        
        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            
            const newLeft = startLeft + deltaX / scale;
            const newTop = startTop + deltaY / scale;
            
            bubbleElem.style.left = `${newLeft}px`;
            bubbleElem.style.top = `${newTop}px`;
            
            // Update bubble position in our data
            bubble.x = newLeft;
            bubble.y = newTop;
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Save state
            saveStateToLocalStorage();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    
    // Double click to edit
    bubbleElem.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        
        bubbleBeingEdited = bubble;
        bubbleText.value = bubble.text;
        bubbleTypeSelect.value = bubble.type;
        openSpeechBubbleEditor();
    });
    
    comicContainer.appendChild(bubbleElem);
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeViewer);