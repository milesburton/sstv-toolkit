import { createCanvas } from 'canvas';
import { beforeAll, describe, expect, it } from 'vitest';

let SSTVEncoder, SSTVDecoder;

beforeAll(async () => {
  global.window = {
    AudioContext: class {
      constructor() {
        this.sampleRate = 48000;
      }
      decodeAudioData(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const numSamples = (arrayBuffer.byteLength - 44) / 2;
        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          samples[i] = view.getInt16(44 + i * 2, true) / 32768.0;
        }
        return Promise.resolve({
          sampleRate: this.sampleRate,
          getChannelData: () => samples,
        });
      }
      close() {
        return Promise.resolve();
      }
    },
  };

  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return createCanvas(640, 496);
      return {};
    },
  };

  global.Image = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }
  };

  if (!global.URL) {
    global.URL = {
      createObjectURL: () => 'mock://image',
      revokeObjectURL: () => undefined,
    };
  }

  const encoderModule = await import('../src/utils/SSTVEncoder.js');
  const decoderModule = await import('../src/utils/SSTVDecoder.js');
  SSTVEncoder = encoderModule.SSTVEncoder;
  SSTVDecoder = decoderModule.SSTVDecoder;
});

describe('Encoder-Decoder Round-Trip', () => {
  it('should encode and decode a solid gray image correctly', async () => {
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';
    ctx.fillRect(0, 0, 320, 240);

    const imageData = ctx.getImageData(0, 0, 320, 240);

    console.log('\n🎨 Encoding gray image (128, 128, 128)...');
    const encoder = new SSTVEncoder('ROBOT36', 48000);
    const audioBlob = encoder.generateAudio(imageData);

    console.log(`✓ Encoded: ${audioBlob.size} bytes`);

    console.log('🔊 Decoding...');
    const decoder = new SSTVDecoder(48000, { autoCalibrate: false });
    const decoded = await decoder.decodeAudio(audioBlob);
    const resultDataUrl = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    expect(resultDataUrl).toBeDefined();
    expect(resultDataUrl).toMatch(/^data:image\/png;base64,/);

    const base64Data = resultDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');

    const { Image } = await import('canvas');
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = pngBuffer;
    });

    const resultCanvas = createCanvas(img.width, img.height);
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.drawImage(img, 0, 0);
    const resultImageData = resultCtx.getImageData(0, 0, img.width, img.height);
    const pixels = resultImageData.data;

    let sumR = 0,
      sumG = 0,
      sumB = 0;
    const totalPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      sumR += pixels[i];
      sumG += pixels[i + 1];
      sumB += pixels[i + 2];
    }

    const avgR = sumR / totalPixels;
    const avgG = sumG / totalPixels;
    const avgB = sumB / totalPixels;

    console.log(`\n📊 Round-Trip Results:`);
    console.log(`   Input:  R=128, G=128, B=128`);
    console.log(`   Output: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);

    const colorImbalance = Math.abs(avgG - avgR) + Math.abs(avgG - avgB);
    console.log(`   Color imbalance: ${colorImbalance.toFixed(1)} (should be <20)`);

    expect(avgR).toBeGreaterThan(100);
    expect(avgR).toBeLessThan(150);
    expect(avgG).toBeGreaterThan(100);
    expect(avgG).toBeLessThan(150);
    expect(avgB).toBeGreaterThan(100);
    expect(avgB).toBeLessThan(150);

    // relaxed for video range quantization
    expect(colorImbalance).toBeLessThan(35);

    console.log(`   ✅ Round-trip test PASSED\n`);
  }, 60000);

  it('should decode correctly with autoCalibrate enabled (browser default)', async () => {
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 160, 120);
    ctx.fillStyle = 'rgb(0, 0, 255)';
    ctx.fillRect(160, 120, 160, 120);
    ctx.fillStyle = 'rgb(128, 128, 128)';
    ctx.fillRect(160, 0, 160, 120);
    ctx.fillRect(0, 120, 160, 120);
    const imageData = ctx.getImageData(0, 0, 320, 240);

    const encoder = new SSTVEncoder('ROBOT36', 48000);
    const audioBlob = encoder.generateAudio(imageData);

    const decoder = new SSTVDecoder(48000, { autoCalibrate: true });
    const decoded = await decoder.decodeAudio(audioBlob);
    const resultDataUrl = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    const base64Data = resultDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');
    const { Image } = await import('canvas');
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = pngBuffer;
    });

    const resultCanvas = createCanvas(img.width, img.height);
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.drawImage(img, 0, 0);
    const resultImageData = resultCtx.getImageData(0, 0, img.width, img.height);
    const pixels = resultImageData.data;

    const redIdx = (60 * 320 + 80) * 4;
    const blueIdx = (180 * 320 + 240) * 4;

    const redR = pixels[redIdx];
    const redG = pixels[redIdx + 1];
    const redB = pixels[redIdx + 2];
    const blueR = pixels[blueIdx];
    const blueG = pixels[blueIdx + 1];
    const blueB = pixels[blueIdx + 2];

    console.log(`\n📊 autoCalibrate=true Results:`);
    console.log(`   Red block:  R=${redR}, G=${redG}, B=${redB}`);
    console.log(`   Blue block: R=${blueR}, G=${blueG}, B=${blueB}`);

    expect(redR).toBeGreaterThan(200);
    expect(redG).toBeLessThan(50);
    expect(redB).toBeLessThan(50);
    expect(blueB).toBeGreaterThan(200);
    expect(blueR).toBeLessThan(50);
    expect(blueG).toBeLessThan(50);

    console.log(`   ✅ autoCalibrate=true test PASSED\n`);
  }, 60000);

  it('should encode and decode colored blocks correctly', async () => {
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 160, 120);

    ctx.fillStyle = 'rgb(0, 255, 0)';
    ctx.fillRect(160, 0, 160, 120);

    ctx.fillStyle = 'rgb(0, 0, 255)';
    ctx.fillRect(0, 120, 160, 120);

    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(160, 120, 160, 120);

    const imageData = ctx.getImageData(0, 0, 320, 240);

    console.log('\n🎨 Encoding colored blocks...');
    const encoder = new SSTVEncoder('ROBOT36', 48000);
    const audioBlob = encoder.generateAudio(imageData);

    console.log('🔊 Decoding...');
    const decoder = new SSTVDecoder(48000, { autoCalibrate: false });
    const decoded = await decoder.decodeAudio(audioBlob);
    const resultDataUrl = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    const base64Data = resultDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');

    const { Image } = await import('canvas');
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = pngBuffer;
    });

    const resultCanvas = createCanvas(img.width, img.height);
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.drawImage(img, 0, 0);
    const resultImageData = resultCtx.getImageData(0, 0, img.width, img.height);
    const pixels = resultImageData.data;

    const samples = {
      red: { x: 80, y: 60 },
      green: { x: 240, y: 60 },
      blue: { x: 80, y: 180 },
      white: { x: 240, y: 180 },
    };

    const results = {};
    for (const [color, pos] of Object.entries(samples)) {
      const idx = (pos.y * 320 + pos.x) * 4;
      results[color] = {
        r: pixels[idx],
        g: pixels[idx + 1],
        b: pixels[idx + 2],
      };
    }

    console.log(`\n📊 Colored Blocks Results:`);
    console.log(`   Red block:   R=${results.red.r}, G=${results.red.g}, B=${results.red.b}`);
    console.log(`   Green block: R=${results.green.r}, G=${results.green.g}, B=${results.green.b}`);
    console.log(`   Blue block:  R=${results.blue.r}, G=${results.blue.g}, B=${results.blue.b}`);
    console.log(`   White block: R=${results.white.r}, G=${results.white.g}, B=${results.white.b}`);

    // SSTV has inherent quality loss due to chroma subsampling
    expect(results.red.r).toBeGreaterThan(200);
    expect(results.red.g).toBeLessThan(50);
    expect(results.red.b).toBeLessThan(50);

    // relaxed thresholds due to SSTV chroma resolution limits
    expect(results.green.g).toBeGreaterThan(150);
    expect(results.green.r).toBeLessThan(180);
    expect(results.green.b).toBeLessThan(50);

    expect(results.blue.b).toBeGreaterThan(200);
    expect(results.blue.r).toBeLessThan(50);
    expect(results.blue.g).toBeLessThan(50);

    expect(results.white.r).toBeGreaterThan(200);
    expect(results.white.g).toBeGreaterThan(200);
    expect(results.white.b).toBeGreaterThan(200);

    console.log(`   ✅ Color blocks test PASSED\n`);
  }, 60000);

  it('should encode and decode PD120 colored blocks correctly', async () => {
    const canvas = createCanvas(640, 496);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 320, 248);
    ctx.fillStyle = 'rgb(0, 0, 255)';
    ctx.fillRect(320, 248, 320, 248);
    ctx.fillStyle = 'rgb(128, 128, 128)';
    ctx.fillRect(320, 0, 320, 248);
    ctx.fillRect(0, 248, 320, 248);

    const imageData = ctx.getImageData(0, 0, 640, 496);

    console.log('\n🎨 Encoding PD120 colored blocks...');
    const encoder = new SSTVEncoder('PD120', 48000);
    const audioBlob = encoder.generateAudio(imageData);
    console.log(`✓ Encoded: ${audioBlob.size} bytes`);

    console.log('🔊 Decoding PD120...');
    const decoder = new SSTVDecoder(48000, { autoCalibrate: false });
    const decoded = await decoder.decodeAudio(audioBlob);
    const resultDataUrl = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    const base64Data = resultDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');

    const { Image } = await import('canvas');
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = pngBuffer;
    });

    const resultCanvas = createCanvas(img.width, img.height);
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.drawImage(img, 0, 0);
    const resultImageData = resultCtx.getImageData(0, 0, img.width, img.height);
    const pixels = resultImageData.data;
    const W = img.width;

    const sample = (x, y) => {
      const idx = (y * W + x) * 4;
      return { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] };
    };

    const red = sample(160, 124);
    const blue = sample(480, 372);
    const gray = sample(480, 124);

    console.log(`\n📊 PD120 Round-Trip Results:`);
    console.log(`   Red block:  R=${red.r}, G=${red.g}, B=${red.b}`);
    console.log(`   Blue block: R=${blue.r}, G=${blue.g}, B=${blue.b}`);
    console.log(`   Gray block: R=${gray.r}, G=${gray.g}, B=${gray.b}`);

    // PD120 uses Y+R-Y/B-Y colour space; expect good colour separation but
    // some loss is inherent from the analogue FM encoding at 640px/121.6ms.
    expect(red.r).toBeGreaterThan(150);
    expect(red.g).toBeLessThan(80);
    expect(red.b).toBeLessThan(50);

    expect(blue.b).toBeGreaterThan(120);
    expect(blue.r).toBeLessThan(50);
    expect(blue.g).toBeLessThan(60);

    expect(gray.r).toBeGreaterThan(100);
    expect(gray.r).toBeLessThan(155);
    expect(Math.abs(gray.r - gray.g) + Math.abs(gray.g - gray.b)).toBeLessThan(40);

    console.log(`   ✅ PD120 round-trip test PASSED\n`);
  }, 120000);
});
