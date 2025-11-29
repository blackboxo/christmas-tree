import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'models');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'hand_landmarker.task');

// Create directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Check if file already exists
if (fs.existsSync(OUTPUT_FILE)) {
  console.log('✓ Model file already exists at public/models/hand_landmarker.task');
  process.exit(0);
}

console.log('Downloading hand landmarker model...');
console.log('From:', MODEL_URL);
console.log('To:', OUTPUT_FILE);

const file = fs.createWriteStream(OUTPUT_FILE);

https.get(MODEL_URL, (response) => {
  if (response.statusCode === 200) {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('✓ Model downloaded successfully!');
      console.log('✓ File size:', fs.statSync(OUTPUT_FILE).size, 'bytes');
    });
  } else {
    fs.unlink(OUTPUT_FILE, () => {});
    console.error('✗ Failed to download model. Status code:', response.statusCode);
    console.warn('⚠ Gesture control may not work without the model file.');
    console.warn('⚠ You can manually download it from:');
    console.warn('  ', MODEL_URL);
    console.warn('  and place it at: public/models/hand_landmarker.task');
  }
}).on('error', (err) => {
  fs.unlink(OUTPUT_FILE, () => {});
  console.error('✗ Error downloading model:', err.message);
  console.warn('⚠ Gesture control may not work without the model file.');
  console.warn('⚠ You can manually download it from:');
  console.warn('  ', MODEL_URL);
  console.warn('  and place it at: public/models/hand_landmarker.task');
});

