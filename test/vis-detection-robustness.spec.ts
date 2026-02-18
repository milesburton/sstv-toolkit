import { createCanvas } from 'canvas';
import { beforeAll, describe, expect, it } from 'vitest';

const SAMPLE_RATE = 48000;

function addTone(
  samples: number[],
  frequency: number,
  duration: number,
  phase: { value: number } = { value: 0 }
) {
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const phaseInc = (2 * Math.PI * frequency) / SAMPLE_RATE;
  for (let i = 0; i < numSamples; i++) {
    samples.push(Math.sin(phase.value));
    phase.value += phaseInc;
  }
  phase.value %= 2 * Math.PI;
}

function samplesToWavBlob(samples: number[]): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x52);
  view.setUint8(1, 0x49);
  view.setUint8(2, 0x46);
  view.setUint8(3, 0x46);
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint8(8, 0x57);
  view.setUint8(9, 0x41);
  view.setUint8(10, 0x56);
  view.setUint8(11, 0x45);
  view.setUint8(12, 0x66);
  view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74);
  view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint8(36, 0x64);
  view.setUint8(37, 0x61);
  view.setUint8(38, 0x74);
  view.setUint8(39, 0x61);
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const s of samples) {
    view.setInt16(offset, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

interface BuildOpts {
  freqOffset?: number;
  leaderDuration?: number;
  falseGlitch?: boolean;
  breakDuration?: number;
  omitStartBit?: boolean;
}

function buildRobot36Signal(imageData: ImageData, opts: BuildOpts = {}): number[] {
  const {
    freqOffset = 0,
    leaderDuration = 0.3,
    falseGlitch = false,
    breakDuration = 0.01,
    omitStartBit = false,
  } = opts;

  const o = freqOffset;
  const phase = { value: 0 };
  const samples: number[] = [];

  if (falseGlitch) {
    addTone(samples, 1900 + o, leaderDuration / 2, phase);
    addTone(samples, 1200 + o, 0.008, phase);
    addTone(samples, 1900 + o, leaderDuration / 2, phase);
  } else {
    addTone(samples, 1900 + o, leaderDuration, phase);
  }

  addTone(samples, 1200 + o, breakDuration, phase);

  if (!omitStartBit) {
    addTone(samples, 1900 + o, 0.03, phase);
  }

  const visCode = 0x08;
  let parity = 0;
  for (let i = 0; i < 7; i++) {
    const bit = (visCode >> i) & 1;
    parity ^= bit;
    addTone(samples, (bit ? 1100 : 1300) + o, 0.03, phase);
  }
  addTone(samples, (parity ? 1100 : 1300) + o, 0.03, phase);
  addTone(samples, 1200 + o, 0.03, phase);

  const { data, width, height } = imageData;
  const yScanSamples = Math.floor(0.088 * SAMPLE_RATE);
  const chromaScanSamples = Math.floor(0.044 * SAMPLE_RATE);

  for (let y = 0; y < height; y++) {
    addTone(samples, 1200 + o, 0.009, phase);
    addTone(samples, 1500 + o, 0.003, phase);

    for (let x = 0; x < width; x++) {
      const startSample = Math.floor((x / width) * yScanSamples);
      const endSample = Math.floor(((x + 1) / width) * yScanSamples);
      const idx = (y * width + x) * 4;
      const Y = 0.299 * (data[idx] ?? 0) + 0.587 * (data[idx + 1] ?? 0) + 0.114 * (data[idx + 2] ?? 0);
      const freq = 1500 + (Math.max(0, Math.min(255, Math.round(Y))) / 255) * 800 + o;
      addTone(samples, freq, (endSample - startSample) / SAMPLE_RATE, phase);
    }

    const isEvenLine = y % 2 === 0;
    addTone(samples, (isEvenLine ? 1500 : 2300) + o, 0.0045, phase);
    addTone(samples, 1500 + o, 0.0015, phase);

    const halfWidth = Math.floor(width / 2);
    for (let x = 0; x < halfWidth; x++) {
      const startSample = Math.floor((x / halfWidth) * chromaScanSamples);
      const endSample = Math.floor(((x + 1) / halfWidth) * chromaScanSamples);
      const i0 = (y * width + x * 2) * 4;
      const r = data[i0] ?? 0;
      const g = data[i0 + 1] ?? 0;
      const b = data[i0 + 2] ?? 0;
      const Yv = 0.299 * r + 0.587 * g + 0.114 * b;
      const chromaVal = isEvenLine ? 128 + 0.701 * (r - Yv) : 128 + 0.886 * (b - Yv);
      const freq = 1500 + (Math.max(0, Math.min(255, Math.round(chromaVal))) / 255) * 800 + o;
      addTone(samples, freq, (endSample - startSample) / SAMPLE_RATE, phase);
    }
  }

  return samples;
}

function wrapWithSilence(signalSamples: number[], prefixSeconds: number): Blob {
  const silenceSamples = new Array<number>(Math.floor(prefixSeconds * SAMPLE_RATE)).fill(0);
  return samplesToWavBlob([...silenceSamples, ...signalSamples]);
}

let SSTVDecoder: typeof import('../src/utils/SSTVDecoder.js').SSTVDecoder;

beforeAll(async () => {
  (global as unknown as Record<string, unknown>).window = {
    AudioContext: class {
      sampleRate = SAMPLE_RATE;
      decodeAudioData(arrayBuffer: ArrayBuffer) {
        const view = new DataView(arrayBuffer);
        const numSamples = (arrayBuffer.byteLength - 44) / 2;
        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          samples[i] = view.getInt16(44 + i * 2, true) / 32768.0;
        }
        return Promise.resolve({
          sampleRate: SAMPLE_RATE,
          getChannelData: () => samples,
        });
      }
      close() {
        return Promise.resolve();
      }
    },
  };

  (global as unknown as Record<string, unknown>).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createCanvas(320, 240);
      return {};
    },
  };

  const mod = await import('../src/utils/SSTVDecoder.js');
  SSTVDecoder = mod.SSTVDecoder;
});

function makeTestImage(): ImageData {
  const canvas = createCanvas(320, 240);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(255, 0, 0)';
  ctx.fillRect(0, 0, 160, 120);
  ctx.fillStyle = 'rgb(0,   0, 255)';
  ctx.fillRect(160, 0, 160, 120);
  ctx.fillStyle = 'rgb(0, 255,   0)';
  ctx.fillRect(0, 120, 160, 120);
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(160, 120, 160, 120);
  return ctx.getImageData(0, 0, 320, 240) as unknown as ImageData;
}

interface PixelSample { r: number; g: number; b: number }
interface DecodeResult {
  diagnostics: { mode: string; freqOffset: number } | null;
  topLeft: PixelSample;
  topRight: PixelSample;
  bottomLeft: PixelSample;
  bottomRight: PixelSample;
}

async function decodeBlob(blob: Blob): Promise<DecodeResult> {
  const decoder = new SSTVDecoder(SAMPLE_RATE);
  const result = await decoder.decodeAudio(blob);
  const imageUrl = typeof result === 'string' ? result : result.imageUrl;
  const diagnostics = typeof result === 'object' ? result.diagnostics : null;

  const { createCanvas: cc, Image } = await import('canvas');
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = Buffer.from(imageUrl.replace(/^data:image\/png;base64,/, ''), 'base64') as unknown as string;
  });
  const c = cc(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0);
  const px = ctx.getImageData(0, 0, img.width, img.height).data;

  const sample = (x: number, y: number): PixelSample => {
    const i = (y * img.width + x) * 4;
    return { r: px[i] ?? 0, g: px[i + 1] ?? 0, b: px[i + 2] ?? 0 };
  };

  return {
    diagnostics,
    topLeft: sample(80, 60),
    topRight: sample(240, 60),
    bottomLeft: sample(80, 180),
    bottomRight: sample(240, 180),
  };
}

describe('VIS Detection Robustness', () => {
  describe('Scenario 1: VIS header starts late in the recording', () => {
    it('should detect VIS and decode correctly when preceded by 10s of silence', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData);
      const blob = wrapWithSilence(signal, 10);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
      expect(topRight.g).toBeLessThan(60);
    }, 60000);

    it('should detect VIS and decode correctly when preceded by 30s of silence', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData);
      const blob = wrapWithSilence(signal, 30);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 90000);
  });

  describe('Scenario 2: False 1200Hz glitch inside the leader', () => {
    it('should ignore 8ms 1200Hz glitch mid-leader and still find the real VIS break', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { falseGlitch: true, leaderDuration: 0.6 });
      const blob = samplesToWavBlob(signal);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 60000);

    it('should handle extended 27ms VIS break (ISS non-standard duration)', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { breakDuration: 0.027 });
      const blob = samplesToWavBlob(signal);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 60000);

    it('should handle transmission without start bit (data bits follow break directly)', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { omitStartBit: true });
      const blob = samplesToWavBlob(signal);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 60000);
  });

  describe('Scenario 3: Frequency offset (real transmitter tuning error)', () => {
    it('should auto-calibrate and decode correctly with +100Hz offset', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { freqOffset: 100 });
      const blob = samplesToWavBlob(signal);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(diagnostics?.freqOffset).not.toBe(0);
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 60000);

    it('should auto-calibrate and decode correctly with -129Hz offset (ISS typical)', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { freqOffset: -129 });
      const blob = samplesToWavBlob(signal);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(diagnostics?.freqOffset).not.toBe(0);
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 60000);

    it('should combine late VIS + frequency offset correctly', async () => {
      const imageData = makeTestImage();
      const signal = buildRobot36Signal(imageData, { freqOffset: -129 });
      const blob = wrapWithSilence(signal, 15);

      const { diagnostics, topLeft, topRight } = await decodeBlob(blob);

      expect(diagnostics?.mode).toBe('Robot 36');
      expect(topLeft.r).toBeGreaterThan(200);
      expect(topLeft.g).toBeLessThan(60);
      expect(topLeft.b).toBeLessThan(60);
      expect(topRight.b).toBeGreaterThan(200);
      expect(topRight.r).toBeLessThan(60);
    }, 90000);
  });
});
