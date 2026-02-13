import '@testing-library/jest-dom';
import { Canvas, Image } from 'canvas';

// Polyfill Canvas API for testing
global.HTMLCanvasElement = Canvas;
global.Image = Image;

// Override document.createElement to return node-canvas for canvas elements
const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName, options) {
  if (tagName.toLowerCase() === 'canvas') {
    return new Canvas(300, 150); // Default canvas size
  }
  return originalCreateElement(tagName, options);
};

// Add toBlob method to Canvas prototype (node-canvas doesn't have it)
Canvas.prototype.toBlob = function (callback, type = 'image/png', quality = 0.92) {
  const buffer = this.toBuffer(type.split('/')[1] || 'png');
  const blob = new Blob([buffer], { type });
  callback(blob);
};

// Mock URL.createObjectURL for node-canvas Image loading
const blobRegistry = new WeakMap();
let blobIdCounter = 0;

global.URL.createObjectURL = function (blob) {
  const blobId = `blob:test-${blobIdCounter++}`;
  blobRegistry.set(blob, blobId);
  // Store the blob data so Image can access it
  global.__blobData = global.__blobData || {};
  global.__blobData[blobId] = blob;
  return blobId;
};

global.URL.revokeObjectURL = function () {
  // No-op for tests
};

// Patch Image to handle blob URLs by converting to data URLs
const OriginalImage = Image;
global.Image = class extends OriginalImage {
  set src(value) {
    if (typeof value === 'string' && value.startsWith('blob:')) {
      // Get the blob data and convert to data URL
      const blob = global.__blobData[value];
      if (blob) {
        blob.arrayBuffer().then((buffer) => {
          const base64 = Buffer.from(buffer).toString('base64');
          const dataUrl = `data:${blob.type};base64,${base64}`;
          super.src = dataUrl;
        });
      }
    } else {
      super.src = value;
    }
  }
};

// Mock Web Audio API for testing
global.AudioContext = class {
  constructor() {
    this.sampleRate = 44100;
  }

  decodeAudioData(arrayBuffer) {
    // Create mock audio buffer
    const channels = 1;
    const length = arrayBuffer.byteLength / 2; // 16-bit samples
    const sampleRate = 44100;

    const audioBuffer = {
      length,
      sampleRate,
      numberOfChannels: channels,
      duration: length / sampleRate,
      getChannelData: (_channel) => {
        // Return actual samples from the array buffer
        const samples = new Float32Array(length);
        const view = new DataView(arrayBuffer);

        // Read 16-bit samples and convert to float
        for (let i = 0; i < length; i++) {
          const sample = view.getInt16(i * 2, true);
          samples[i] = sample / 32768.0; // Normalize to [-1, 1]
        }

        return samples;
      },
    };

    return Promise.resolve(audioBuffer);
  }
};

global.webkitAudioContext = global.AudioContext;
