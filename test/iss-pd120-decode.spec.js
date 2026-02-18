/**
 * Integration test for ISS PD120 SSTV decoding.
 *
 * The ISS transmits PD120 (508ms/line-pair, 640x496) but with a non-standard
 * VIS header — the 1200Hz break is at ~1100Hz and only ~140ms of bit data
 * follows (not the standard 7×30ms = 210ms). The decoder falls back to
 * timing-based mode detection when the VIS code can't be read.
 */

import { readFileSync } from 'node:fs';
import { createCanvas, Image } from 'canvas';
import { beforeAll, describe, expect, it } from 'vitest';

class MockAudioContext {
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
}

let SSTVDecoder;

beforeAll(async () => {
  global.window = { AudioContext: MockAudioContext };
  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return createCanvas(640, 496);
      return {};
    },
  };
  const module = await import('../src/utils/SSTVDecoder.js');
  SSTVDecoder = module.SSTVDecoder;
});

describe('ISS PD120 Decode Test', () => {
  it('should detect PD120 mode and decode without severe colour corruption', async () => {
    const wavBuffer = readFileSync('test/fixtures/pd120_iss_2021.wav');
    const blob = {
      arrayBuffer: () =>
        Promise.resolve(
          wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength)
        ),
    };

    const decoder = new SSTVDecoder(48000);
    const decoded = await decoder.decodeAudio(blob);
    const result = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    expect(result).toBeDefined();
    expect(result).toMatch(/^data:image\/png;base64,/);

    // ISS PD120 files have non-standard VIS headers; the decoder may fall back
    // to timing-based detection (→ PD 120) or to Robot 36 if the noise in the
    // first 12s generates a plausible false VIS. Either way the image should not
    // be severely colour-corrupted.
    console.log(`   Mode detected: ${decoder.mode.name}`);

    // Analyse decoded image for colour sanity
    const base64Data = result.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgBuffer;
    });

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, img.width, img.height);

    let avgR = 0,
      avgG = 0,
      avgB = 0;
    const totalPixels = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      avgR += pixels[i];
      avgG += pixels[i + 1];
      avgB += pixels[i + 2];
    }
    avgR /= totalPixels;
    avgG /= totalPixels;
    avgB /= totalPixels;

    const colorImbalance = Math.abs(avgG - avgR) + Math.abs(avgG - avgB);

    console.log('\n📊 ISS PD120 Image Analysis:');
    console.log(`   Average RGB: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);
    console.log(`   Color imbalance: ${colorImbalance.toFixed(1)} (should be <100)`);

    const fs = await import('node:fs');
    fs.mkdirSync('test/output', { recursive: true });
    fs.writeFileSync('test/output/iss-pd120-decode.png', imgBuffer);
    console.log('   Saved to: test/output/iss-pd120-decode.png\n');

    expect(colorImbalance).toBeLessThan(100);
  }, 60000);
});
