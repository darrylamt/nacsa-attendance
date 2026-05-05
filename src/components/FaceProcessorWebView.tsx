import React, { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface FaceProcessorRef {
  processImage: (base64: string) => void;
}

interface Props {
  /** Local file:// URI if cache is ready, otherwise null → uses remote HTML */
  localCacheUri: string | null;
  modelsUrl: string;
  faceApiUrl: string;
  onReady: () => void;
  onDescriptor: (descriptor: number[], score: number) => void;
  onNoFace: () => void;
  onError: (message: string) => void;
}

const buildRemoteHtml = (faceApiUrl: string, modelsUrl: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script src="${faceApiUrl}"></script>
<script>
let ready = false;

function postToRN(data) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
}

async function init() {
  if (typeof faceapi === 'undefined') {
    postToRN({ type: 'error', message: 'face-api.js failed to load. Check FACE_API_URL in config.ts.' });
    return;
  }
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('${modelsUrl}'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('${modelsUrl}'),
      faceapi.nets.faceRecognitionNet.loadFromUri('${modelsUrl}'),
    ]);
    ready = true;
    postToRN({ type: 'ready' });
  } catch(e) {
    postToRN({ type: 'error', message: 'Model load failed: ' + e.message + ' — check MODELS_URL in config.ts.' });
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
    canvas.width  = img.naturalWidth;
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
</html>
`;

export const FaceProcessorWebView = forwardRef<FaceProcessorRef, Props>(
  ({ localCacheUri, modelsUrl, faceApiUrl, onReady, onDescriptor, onNoFace, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);

    // Local cache → load from file system (works offline)
    // No cache → load remote HTML (requires internet)
    const source = useMemo(
      () => localCacheUri
        ? { uri: localCacheUri }
        : { html: buildRemoteHtml(faceApiUrl, modelsUrl) },
      [localCacheUri, faceApiUrl, modelsUrl],
    );

    useImperativeHandle(ref, () => ({
      processImage: (base64: string) => {
        webViewRef.current?.injectJavaScript(`
          (function(){
            handleMessage({ data: JSON.stringify({ action: 'processImage', base64: ${JSON.stringify(base64)} }) });
          })();
        `);
      },
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready')      onReady();
        if (data.type === 'descriptor') onDescriptor(data.descriptor, data.score);
        if (data.type === 'no_face')    onNoFace();
        if (data.type === 'error')      onError(data.message);
      } catch { /* ignore */ }
    };

    return (
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.offscreen}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={['*', 'file://']}
        // Required for local file:// access on Android
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
      />
    );
  },
);

const styles = StyleSheet.create({
  offscreen: { width: 100, height: 100, position: 'absolute', left: -200, top: -200 },
});
