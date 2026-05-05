import * as FileSystem from 'expo-file-system';

const BASE_DIR    = FileSystem.documentDirectory + 'faceapi/';
const MODELS_DIR  = BASE_DIR + 'models/';
const HTML_PATH   = BASE_DIR + 'index.html';
const SCRIPT_PATH = BASE_DIR + 'face-api.min.js';

// All files face-api.js needs for our detection pipeline
const MODEL_FILES = [
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_recognition_model-weights_manifest.json',
];

// HTML that loads everything from local relative paths — no network needed
const LOCAL_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script src="./face-api.min.js"></script>
<script>
let ready = false;

function postToRN(data) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
}

async function init() {
  if (typeof faceapi === 'undefined') {
    postToRN({ type: 'error', message: 'face-api.js script not found in local cache' });
    return;
  }
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('./models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    ]);
    ready = true;
    postToRN({ type: 'ready' });
  } catch(e) {
    postToRN({ type: 'error', message: 'Local model load failed: ' + e.message });
  }
}

async function processImage(base64) {
  if (!ready) { postToRN({ type: 'error', message: 'Not ready' }); return; }
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Image load failed'));
      img.src = 'data:image/jpeg;base64,' + base64;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    const det = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (det) {
      postToRN({ type: 'descriptor', descriptor: Array.from(det.descriptor), score: det.detection.score });
    } else {
      postToRN({ type: 'no_face' });
    }
  } catch(e) {
    postToRN({ type: 'error', message: e.message });
  }
}

function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    if (data.action === 'processImage') processImage(data.base64);
  } catch(e) {}
}

document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);
init();
</script>
</body>
</html>`;

export async function isCacheReady(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(HTML_PATH);
  return info.exists;
}

export function getCachedHtmlUri(): string {
  return HTML_PATH; // FileSystem.documentDirectory already contains file://
}

/**
 * Downloads face-api.js and all model files to local storage.
 * After this runs once, the app can do face recognition with no internet.
 * onProgress: 0.0 → 1.0
 */
export async function downloadModels(
  faceApiUrl: string,
  modelsUrl: string,
  onProgress?: (p: number) => void,
): Promise<void> {
  await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });

  const total = MODEL_FILES.length + 1; // +1 for face-api.js
  let done = 0;

  const tick = () => {
    done++;
    onProgress?.(done / total);
  };

  // face-api.js library
  await FileSystem.downloadAsync(faceApiUrl, SCRIPT_PATH);
  tick();

  // Model weight files
  for (const file of MODEL_FILES) {
    await FileSystem.downloadAsync(`${modelsUrl}/${file}`, MODELS_DIR + file);
    tick();
  }

  // Write local HTML entry point
  await FileSystem.writeAsStringAsync(HTML_PATH, LOCAL_HTML, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function clearCache(): Promise<void> {
  await FileSystem.deleteAsync(BASE_DIR, { idempotent: true });
}
