// --- 1. SETUP MONACO EDITOR ---
let editor;

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: [
            '// 🚀 AI Hand-Controlled IDE',
            'function analyzeData() {',
            '    const data = [10, 20, 30, 40, 50];',
            '    console.log("Processing...");',
            '    return data.map(x => x * 2);',
            '}',
            '',
            'function uiController() {',
            '    // PINCH to scroll this window',
            '    // MAKE A FIST to fold this function',
            '    // OPEN PALM to unfold everything',
            '    console.log("Listening for gestures...");',
            '}',
            '',
            '// Adding filler lines for scrolling...',
            ...Array(30).fill(0).map((_, i) => `// Line entry #${i + 1}`)
        ].join('\n'),
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });
});

// --- 2. THE GEOMETRY ENGINE ---

function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

const gestureText = document.getElementById('gesture-text');

function detectGestures(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    // 1. PINCH DETECTION (Scroll)
    const pinchDist = getDist(thumbTip, indexTip);
    
    // 2. FIST DETECTION (Distance from all tips to wrist is small)
    const isFist = getDist(indexTip, wrist) < 0.2 && getDist(pinkyTip, wrist) < 0.2;
    
    // 3. OPEN PALM DETECTION (Tips are far from wrist)
    const isOpen = getDist(indexTip, wrist) > 0.5 && getDist(middleTip, wrist) > 0.5;

    if (pinchDist < 0.05) {
        gestureText.innerText = "SCROLLING DOWN";
        if(editor) editor.setScrollTop(editor.getScrollTop() + 10);
    } 
    else if (isFist) {
        gestureText.innerText = "FIST: FOLDING CODE";
        if(editor) editor.trigger('keyboard', 'editor.action.foldAll');
    }
    else if (isOpen) {
        gestureText.innerText = "PALM: UNFOLDING";
        if(editor) editor.trigger('keyboard', 'editor.action.unfoldAll');
    }
    else {
        gestureText.innerText = "Waiting...";
    }
}

// --- 3. MEDIAPIPE & CAMERA ---
function onResults(results) {
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#007acc', lineWidth: 3});
            drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});
            detectGestures(landmarks);
        }
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onResults);

const videoElement = document.getElementsByClassName('input_video')[0];
const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
camera.start();