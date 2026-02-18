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
      if (tag === 'canvas') return createCanvas(320, 240);
      return {};
    },
  };

  const module = await import('../src/utils/SSTVDecoder.js');
  SSTVDecoder = module.SSTVDecoder;
});

describe('ISS SSTV Decode Test', () => {
  it('should decode ISS SSTV transmission without excessive green tint', async () => {
    const wavBuffer = readFileSync('test/fixtures/pd120_iss_2020.wav');
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
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    let avgR = 0, avgG = 0, avgB = 0;
    let greenDominant = 0;
    let magentaDominant = 0;
    let normalPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;

      avgR += r;
      avgG += g;
      avgB += b;

      if (g > r + 40 && g > b + 40) greenDominant++;
      if (r > 150 && b > 150 && g < 100) magentaDominant++;

      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      if (maxDiff < 80) normalPixels++;
    }

    const totalPixels = pixels.length / 4;
    avgR /= totalPixels;
    avgG /= totalPixels;
    avgB /= totalPixels;

    const greenPercent = (greenDominant / totalPixels) * 100;
    const magentaPercent = (magentaDominant / totalPixels) * 100;
    const normalPercent = (normalPixels / totalPixels) * 100;

    console.log('\n📊 ISS Image Analysis:');
    console.log(`   Average RGB: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);
    console.log(`   Green-dominant: ${greenPercent.toFixed(1)}%`);
    console.log(`   Magenta-dominant: ${magentaPercent.toFixed(1)}%`);
    console.log(`   Normal-colored: ${normalPercent.toFixed(1)}%`);

    const fs = await import('node:fs');
    fs.mkdirSync('test/output', { recursive: true });
    fs.writeFileSync('test/output/iss-decode.png', imgBuffer);
    console.log(`   Saved to: test/output/iss-decode.png\n`);

    expect(greenPercent).toBeLessThan(55);
    expect(magentaPercent).toBeLessThan(40);

    const colorImbalance = Math.abs(avgG - avgR) + Math.abs(avgG - avgB);
    expect(colorImbalance).toBeLessThan(100);

    expect(normalPercent).toBeGreaterThan(15);
  }, 120000);
});
