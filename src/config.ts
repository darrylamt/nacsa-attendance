// Must match $api_key in mobile-api.php
export const API_BASE = 'https://clockin.nacsagh.com/mobile-api.php';
export const API_KEY  = 'ae4357c4-1c3c-4c0e-ab08-2b92fd167308';

// face-api.js model weights.
// Using jsDelivr CDN — has CORS headers required for XHR model loading.
// To switch to your own server, add CORS headers to the models folder
// via .htaccess (see SETUP.md) then change this URL back to:
// https://clockin.nacsagh.com/models/face-api.js-master/weights
export const MODELS_URL   = 'https://clockin.nacsagh.com/models/face-api.js-master/weights';

// face-api.js library — use the local copy (script loading doesn't need CORS).
export const FACE_API_URL = 'https://clockin.nacsagh.com/models/face-api.js-master/dist/face-api.min.js';
