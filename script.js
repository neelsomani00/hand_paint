const videoElement = document.querySelector('.input_video');
const inkCanvas = document.getElementById('ink_layer');
const uiCanvas = document.getElementById('ui_layer');
const inkCtx = inkCanvas.getContext('2d');
const uiCtx = uiCanvas.getContext('2d');

let brush = { color: '#00f3ff', size: 10, x: 0, y: 0, isDrawing: false, lastX: 0, lastY: 0 };
const palette = [
    { name: 'CYAN', hex: '#00f3ff', y: 150 },
    { name: 'MAGENTA', hex: '#ff0055', y: 250 },
    { name: 'LIME', hex: '#00ff88', y: 350 },
    { name: 'GOLD', hex: '#ffff00', y: 450 }
];

function resize() {
    inkCanvas.width = uiCanvas.width = window.innerWidth;
    inkCanvas.height = uiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function onResults(results) {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    drawInterface();

    if (!results.multiHandLandmarks) return;

    results.multiHandLandmarks.forEach((lm, i) => {
        const x = lm[8].x * uiCanvas.width;
        const y = lm[8].y * uiCanvas.height;
        const isRightHand = lm[0].x < 0.5; // Mirrored: Right of screen is User's Left

        if (isRightHand) {
            // --- MODULE: INTERACTIVE DOCK (USER LEFT HAND) ---
            palette.forEach(p => {
                const dist = Math.hypot(x - (uiCanvas.width - 80), y - p.y);
                if (dist < 40) {
                    brush.color = p.hex;
                    // Visual feedback for selection
                    uiCtx.beginPath();
                    uiCtx.arc(uiCanvas.width - 80, p.y, 45, 0, Math.PI*2);
                    uiCtx.strokeStyle = p.hex;
                    uiCtx.stroke();
                }
            });

            // Size Slider Zone
            if (x > uiCanvas.width - 150 && x < uiCanvas.width - 120) {
                brush.size = Math.max(2, Math.floor((1 - (y / uiCanvas.height)) * 100));
            }
            drawCursor(x, y, '#fff', false);

        } else {
            // --- MODULE: NEURAL PEN (USER RIGHT HAND) ---
            const indexFolded = lm[8].y > lm[6].y;
            const middleFolded = lm[12].y > lm[10].y;

            if (indexFolded && middleFolded) {
                // FIST = INK
                inkCtx.globalCompositeOperation = 'source-over';
                smoothDraw(x, y);
            } else if (!indexFolded && !middleFolded) {
                // PALM = ERASE
                inkCtx.globalCompositeOperation = 'destination-out';
                smoothDraw(x, y);
            } else {
                brush.isDrawing = false;
            }
            drawCursor(x, y, brush.color, true);
        }
    });
}

function drawInterface() {
    const W = uiCanvas.width;
    // Draw Color Swatches
    palette.forEach(p => {
        uiCtx.beginPath();
        uiCtx.arc(W - 80, p.y, 30, 0, Math.PI*2);
        uiCtx.fillStyle = 'rgba(0,0,0,0.5)';
        uiCtx.fill();
        uiCtx.strokeStyle = p.hex;
        uiCtx.lineWidth = (brush.color === p.hex) ? 5 : 2;
        uiCtx.stroke();
        
        uiCtx.fillStyle = p.hex;
        uiCtx.font = '10px Courier New';
        uiCtx.fillText(p.name, W - 100, p.y + 50);
    });

    // Draw Size Slider Beam
    uiCtx.fillStyle = 'rgba(0, 243, 255, 0.1)';
    uiCtx.fillRect(W - 140, 100, 20, uiCanvas.height - 200);
    const sliderY = uiCanvas.height - 100 - (brush.size * (uiCanvas.height - 200) / 100);
    uiCtx.fillStyle = '#00f3ff';
    uiCtx.fillRect(W - 145, sliderY, 30, 4);
    uiCtx.fillText(`SIZE:${brush.size}`, W - 180, sliderY + 5);
}

function smoothDraw(x, y) {
    inkCtx.lineWidth = brush.size;
    inkCtx.lineCap = 'round';
    inkCtx.lineJoin = 'round';
    inkCtx.strokeStyle = brush.color;

    if (!brush.isDrawing) {
        inkCtx.beginPath();
        inkCtx.moveTo(x, y);
        brush.isDrawing = true;
    } else {
        // Predictive Interpolation
        const midX = (brush.lastX + x) / 2;
        const midY = (brush.lastY + y) / 2;
        inkCtx.quadraticCurveTo(brush.lastX, brush.lastY, midX, midY);
        inkCtx.stroke();
    }
    brush.lastX = x; brush.lastY = y;
}

function drawCursor(x, y, col, isPen) {
    uiCtx.beginPath();
    uiCtx.arc(x, y, isPen ? brush.size/2 : 15, 0, Math.PI*2);
    uiCtx.strokeStyle = col;
    uiCtx.lineWidth = 2;
    uiCtx.stroke();
    if (isPen) {
        uiCtx.moveTo(x - 20, y); uiCtx.lineTo(x + 20, y);
        uiCtx.moveTo(x, y - 20); uiCtx.lineTo(x, y + 20);
        uiCtx.stroke();
    }
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.7 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();