import { readFileSync } from 'node:fs';
import { createCanvas, Image } from 'canvas';
import { beforeAll, describe, expect, it } from 'vitest';

function findWavDataOffset(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') return offset + 8;
    offset += 8 + size;
  }
  return 44;
}

class MockAudioContext {
  sampleRate = 48000;

  decodeAudioData(arrayBuffer: ArrayBuffer) {
    const dataOffset = findWavDataOffset(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const numSamples = (arrayBuffer.byteLength - dataOffset) / 2;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768.0;
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

let SSTVDecoder: typeof import('../src/utils/SSTVDecoder.js').SSTVDecoder;

beforeAll(async () => {
  (global as unknown as Record<string, unknown>).window = { AudioContext: MockAudioContext };
  (global as unknown as Record<string, unknown>).document = {
    createElement: (tag: string) => {
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
    const decoded = await decoder.decodeAudio(blob as Blob);
    const result = typeof decoded === 'string' ? decoded : decoded.imageUrl;

    expect(result).toBeDefined();
    expect(result).toMatch(/^data:image\/png;base64,/);

    console.log(`   Mode detected: ${decoder.mode?.name}`);

    const base64Data = result.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imgBuffer as unknown as string;
    });

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as unknown as CanvasImageSource, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, img.width, img.height);

    let avgR = 0,
      avgG = 0,
      avgB = 0;
    const totalPixels = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      avgR += pixels[i] ?? 0;
      avgG += pixels[i + 1] ?? 0;
      avgB += pixels[i + 2] ?? 0;
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
