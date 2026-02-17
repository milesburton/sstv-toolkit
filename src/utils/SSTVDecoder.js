import { FMDemodulator } from './FMDemodulator.js';
import { SSTV_MODES } from './SSTVEncoder.js';

const FREQ_SYNC = 1200;
const FREQ_BLACK = 1500;
const FREQ_WHITE = 2300;
const FREQ_CENTER = 1900;
const FREQ_BANDWIDTH = 800;

export class SSTVDecoder {
  constructor(sampleRate = 48000, options = {}) {
    this.sampleRate = sampleRate;
    this.mode = null;
    this.freqOffset = options.freqOffset || 0;
    this.autoCalibrate = options.autoCalibrate !== false;
    this.useFMDemod = options.useFMDemod === true;
  }

  async decodeAudio(audioFile) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const samples = audioBuffer.getChannelData(0);
    this.sampleRate = audioBuffer.sampleRate;
    audioContext.close();

    this.mode = this.detectMode(samples);

    if (!this.mode) {
      throw new Error('Could not detect SSTV mode. Try manually selecting a mode.');
    }

    if (typeof window !== 'undefined') {
      console.log('📡 SSTV Mode detected:', this.mode.name);
    }

    if (this.useFMDemod) {
      return this.decodeImageWithFM(samples);
    }
    return this.decodeImage(samples, {
      sampleRate: this.sampleRate,
      fileDuration: samples.length / this.sampleRate,
    });
  }

  decodeImageWithFM(samples) {
    const fmDemod = new FMDemodulator(FREQ_CENTER, FREQ_BANDWIDTH, this.sampleRate);
    const demodulated = fmDemod.demodulateAll(samples);
    return this.decodeImageFromFrequencyStream(demodulated, samples);
  }

  decodeImageFromFrequencyStream(freqStream, samples) {
    const canvas = document.createElement('canvas');
    canvas.width = this.mode.width;
    canvas.height = this.mode.lines;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 0;
      imageData.data[i + 1] = 0;
      imageData.data[i + 2] = 0;
      imageData.data[i + 3] = 255;
    }

    let chromaU = null;
    let chromaV = null;
    if (this.mode.colorFormat === 'YUV') {
      chromaU = new Array(this.mode.width * this.mode.lines).fill(128);
      chromaV = new Array(this.mode.width * this.mode.lines).fill(128);
    }

    const visEnd = this.visEndPos || Math.floor(0.61 * this.sampleRate);
    let position = this.findSyncPulse(samples, visEnd);

    if (position === -1) {
      throw new Error('Could not find sync pulse. Make sure this is a valid SSTV transmission.');
    }

    for (let y = 0; y < this.mode.lines && position < freqStream.length; y++) {
      position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);

      if (this.mode.colorFormat === 'RGB') {
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 1);
        if (this.mode.separatorPulse)
          position += Math.floor(this.mode.separatorPulse * this.sampleRate);
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 2);
        if (this.mode.separatorPulse)
          position += Math.floor(this.mode.separatorPulse * this.sampleRate);
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 0);
      } else {
        position = this.decodeYFromFreqStream(freqStream, position, imageData, y);

        if (position < freqStream.length) {
          const isEvenLine = y % 2 === 0;
          position += Math.floor(0.0045 * this.sampleRate);
          position += Math.floor(0.0015 * this.sampleRate);

          if (position < freqStream.length) {
            position = this.decodeChromaFromFreqStream(
              freqStream,
              position,
              chromaU,
              chromaV,
              y,
              isEvenLine ? 'V' : 'U'
            );
          }
        }
      }

      if (this.autoCalibrate) {
        const lineSamples = Math.floor(this.mode.scanTime * this.sampleRate);
        const tolerance = Math.floor(lineSamples * 0.1);
        const nextSync = this.findSyncPulse(samples, position - tolerance, position + tolerance);
        if (nextSync !== -1) position = nextSync;
      }
    }

    if (this.mode.colorFormat === 'YUV') {
      this.convertYUVtoRGB(imageData, chromaU, chromaV);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  detectMode(samples) {
    const searchSamples = Math.min(samples.length, this.sampleRate * 2);
    const step = Math.floor(this.sampleRate * 0.0005);

    for (let i = 0; i < searchSamples - 1000; i += step) {
      const freq = this.detectFrequency(samples, i, 0.01);

      if (Math.abs(freq - 1200) < 100) {
        const startBitPos = i + Math.floor(0.01 * this.sampleRate);
        if (startBitPos + Math.floor(0.03 * this.sampleRate) >= samples.length) continue;

        const startBitFreq = this.detectFrequency(samples, startBitPos, 0.03);
        if (Math.abs(startBitFreq - 1900) < 100) {
          const visCode = this.decodeVIS(samples, startBitPos);
          this.lastVisCode = visCode;

          const visEndPos = startBitPos + Math.floor(0.3 * this.sampleRate);

          for (const [_key, mode] of Object.entries(SSTV_MODES)) {
            if (mode.visCode === visCode) {
              this.visEndPos = visEndPos;
              return mode;
            }
          }

          this.visEndPos = visEndPos;
        }
      }
    }

    return SSTV_MODES.ROBOT36;
  }

  decodeVIS(samples, startIdx) {
    let idx = startIdx + Math.floor(0.03 * this.sampleRate);
    let visCode = 0;
    const frequenciesDetected = [];

    for (let bit = 0; bit < 7; bit++) {
      const freq = this.detectFrequency(samples, idx, 0.03);
      frequenciesDetected.push(freq);
      if (freq < 1200) visCode |= 1 << bit;
      idx += Math.floor(0.03 * this.sampleRate);
    }

    if (typeof window !== 'undefined') {
      console.log('📡 VIS Frequencies detected:', frequenciesDetected);
      console.log(
        '📡 VIS Code decoded:',
        visCode,
        '(binary:',
        visCode.toString(2).padStart(7, '0'),
        ')'
      );
    }

    return visCode;
  }

  decodeImage(samples, audioMeta = {}) {
    const decodeStart = Date.now();
    const canvas = document.createElement('canvas');
    canvas.width = this.mode.width;
    canvas.height = this.mode.lines;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 0;
      imageData.data[i + 1] = 0;
      imageData.data[i + 2] = 0;
      imageData.data[i + 3] = 255;
    }

    let chromaU = null;
    let chromaV = null;
    if (this.mode.colorFormat === 'YUV' || this.mode.colorFormat === 'PD') {
      chromaU = new Array(this.mode.width * this.mode.lines).fill(128);
      chromaV = new Array(this.mode.width * this.mode.lines).fill(128);
    }

    const visEnd = this.visEndPos || Math.floor(0.61 * this.sampleRate);
    const searchPositions = [
      visEnd,
      visEnd - Math.floor(0.05 * this.sampleRate),
      visEnd + Math.floor(0.05 * this.sampleRate),
      Math.floor(0.5 * this.sampleRate),
      0,
    ];

    let position = -1;
    for (const startPos of searchPositions) {
      if (startPos < 0) continue;
      position = this.findSyncPulse(samples, startPos);
      if (position !== -1) break;
    }

    if (position === -1) {
      throw new Error('Could not find sync pulse. Make sure this is a valid SSTV transmission.');
    }

    if (this.mode.colorFormat === 'PD') {
      for (let y = 0; y < this.mode.lines; y += 2) {
        position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);
        position = this.decodeScanLinePD(samples, position, imageData, chromaU, chromaV, y);

        if (this.autoCalibrate && y + 2 < this.mode.lines) {
          const lineSamples = Math.floor(this.mode.componentTime * 4 * this.sampleRate);
          const tolerance = Math.floor(lineSamples * 0.1);
          const nextSync = this.findSyncPulse(samples, position - tolerance, position + tolerance);
          if (nextSync !== -1) position = nextSync;
        }
      }
    } else {
      for (let y = 0; y < this.mode.lines && position < samples.length; y++) {
        position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);

        if (this.mode.colorFormat === 'RGB') {
          position = this.decodeScanLine(samples, position, imageData, y, 1);
          if (this.mode.separatorPulse)
            position += Math.floor(this.mode.separatorPulse * this.sampleRate);
          position = this.decodeScanLine(samples, position, imageData, y, 2);
          if (this.mode.separatorPulse)
            position += Math.floor(this.mode.separatorPulse * this.sampleRate);
          position = this.decodeScanLine(samples, position, imageData, y, 0);
        } else {
          position = this.decodeScanLineYUV(samples, position, imageData, y);

          if (position < samples.length) {
            const isEvenLine = y % 2 === 0;
            this.currentChromaType = isEvenLine ? 'V' : 'U';
            position += Math.floor(0.0045 * this.sampleRate);
            position += Math.floor(0.0015 * this.sampleRate);

            if (position < samples.length) {
              position = this.decodeScanLineChroma(
                samples,
                position,
                chromaU,
                chromaV,
                y,
                this.currentChromaType
              );
            }
          }
        }

        if (this.autoCalibrate) {
          const lineSamples = Math.floor(this.mode.scanTime * this.sampleRate);
          const tolerance = Math.floor(lineSamples * 0.1);
          const nextSync = this.findSyncPulse(samples, position - tolerance, position + tolerance);
          if (nextSync !== -1) {
            position = nextSync;
          }
        }
      }
    }

    if (this.mode.colorFormat === 'YUV') {
      this.convertYUVtoRGB(imageData, chromaU, chromaV);
    } else if (this.mode.colorFormat === 'PD') {
      this.convertPDtoRGB(imageData, chromaU, chromaV);
    }

    ctx.putImageData(imageData, 0, 0);

    const imageUrl = canvas.toDataURL('image/png');
    const quality = this.analyzeImageQuality(ctx, canvas.width, canvas.height);

    return {
      imageUrl,
      diagnostics: {
        mode: this.mode.name,
        visCode: this.lastVisCode,
        sampleRate: audioMeta.sampleRate || this.sampleRate,
        fileDuration: audioMeta.fileDuration ? `${audioMeta.fileDuration.toFixed(2)}s` : null,
        freqOffset: this.freqOffset,
        autoCalibrate: this.autoCalibrate,
        visEndPos: this.visEndPos,
        decodeTimeMs: Date.now() - decodeStart,
        quality,
      },
    };
  }

  analyzeImageQuality(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let rSum = 0,
      gSum = 0,
      bSum = 0;
    const pixels = width * height;

    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }

    const rAvg = rSum / pixels;
    const gAvg = gSum / pixels;
    const bAvg = bSum / pixels;
    const brightness = (rAvg + gAvg + bAvg) / 3;
    const greenDominance = gAvg - (rAvg + bAvg) / 2;
    const colorImbalance = Math.max(rAvg, gAvg, bAvg) - Math.min(rAvg, gAvg, bAvg);

    let verdict = 'good';
    const warnings = [];

    if (brightness < 10) {
      verdict = 'bad';
      warnings.push('Image is almost entirely black — sync or timing issue');
    } else if (greenDominance > 40) {
      verdict = 'bad';
      warnings.push(
        `Heavy green tint (G dominates by ${greenDominance.toFixed(0)}) — chroma decode error`
      );
    } else if (colorImbalance > 80 && brightness < 40) {
      verdict = 'warn';
      warnings.push('Unusual color balance — possible frequency offset');
    } else if (colorImbalance > 120) {
      verdict = 'warn';
      warnings.push('High color imbalance — possible chroma misalignment');
    }

    return {
      rAvg: Math.round(rAvg),
      gAvg: Math.round(gAvg),
      bAvg: Math.round(bAvg),
      brightness: Math.round(brightness),
      verdict,
      warnings,
    };
  }

  decodeScanLine(samples, startPos, imageData, y, channel) {
    const totalSamples = Math.floor(this.mode.scanTime * this.sampleRate);

    for (let x = 0; x < this.mode.width; x++) {
      const startSample = Math.floor((x / this.mode.width) * totalSamples);
      const endSample = Math.floor(((x + 1) / this.mode.width) * totalSamples);
      const pos = startPos + startSample;
      const duration = (endSample - startSample) / this.sampleRate;

      if (pos >= samples.length) break;

      const freq = this.detectFrequencyRange(samples, pos, duration);
      let value = ((freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const idx = (y * this.mode.width + x) * 4;
      imageData.data[idx + channel] = value;
      imageData.data[idx + 3] = 255;
    }

    return startPos + totalSamples;
  }

  detectFrequencyRange(samples, startIdx, duration) {
    const numSamples = Math.floor(duration * this.sampleRate);
    const endIdx = Math.min(startIdx + numSamples, samples.length);

    if (endIdx - startIdx < 10) return FREQ_BLACK;

    let maxMag = 0;
    let detectedFreq = FREQ_BLACK;

    for (let freq = FREQ_SYNC - 100; freq <= FREQ_WHITE + 200; freq += 25) {
      const magnitude = this.goertzel(samples, startIdx, endIdx, freq);
      if (magnitude > maxMag) {
        maxMag = magnitude;
        detectedFreq = freq;
      }
    }

    const fineStart = Math.max(FREQ_SYNC - 100, detectedFreq - 30);
    const fineEnd = Math.min(FREQ_WHITE + 200, detectedFreq + 30);

    for (let freq = fineStart; freq <= fineEnd; freq += 1) {
      const magnitude = this.goertzel(samples, startIdx, endIdx, freq);
      if (magnitude > maxMag) {
        maxMag = magnitude;
        detectedFreq = freq;
      }
    }

    return detectedFreq;
  }

  decodeScanLineYUV(samples, startPos, imageData, y) {
    const Y_SCAN_TIME = 0.088;
    const totalSamples = Math.floor(Y_SCAN_TIME * this.sampleRate);
    const minWindowSamples = Math.max(96, Math.floor(totalSamples / this.mode.width) * 4);

    for (let x = 0; x < this.mode.width; x++) {
      const startSample = Math.floor((x / this.mode.width) * totalSamples);
      const endSample = Math.floor(((x + 1) / this.mode.width) * totalSamples);
      const pos = startPos + startSample;
      const windowEnd = Math.min(
        startPos + totalSamples,
        pos + Math.max(endSample - startSample, minWindowSamples)
      );
      const duration = (windowEnd - pos) / this.sampleRate;

      if (pos >= samples.length) break;

      const freq = this.detectFrequencyRange(samples, pos, duration);
      const freqBlack = FREQ_BLACK + this.freqOffset;
      const freqWhite = FREQ_WHITE + this.freqOffset;
      const value = Math.max(
        0,
        Math.min(255, Math.round(((freq - freqBlack) / (freqWhite - freqBlack)) * 255))
      );

      const pixelIdx = (y * this.mode.width + x) * 4;
      imageData.data[pixelIdx] = value;
      imageData.data[pixelIdx + 1] = value;
      imageData.data[pixelIdx + 2] = value;
      imageData.data[pixelIdx + 3] = 255;
    }

    return startPos + totalSamples;
  }

  decodeScanLineChroma(samples, startPos, chromaU, chromaV, y, componentType) {
    const CHROMA_SCAN_TIME = 0.044;
    const halfWidth = Math.floor(this.mode.width / 2);
    const totalSamples = Math.floor(CHROMA_SCAN_TIME * this.sampleRate);
    const minWindowSamples = Math.max(96, Math.floor(totalSamples / halfWidth) * 4);

    const frequencies = [];
    for (let x = 0; x < halfWidth; x++) {
      const startSample = Math.floor((x / halfWidth) * totalSamples);
      const endSample = Math.floor(((x + 1) / halfWidth) * totalSamples);
      const pixelPos = startPos + startSample;
      const windowEnd = Math.min(
        startPos + totalSamples,
        pixelPos + Math.max(endSample - startSample, minWindowSamples)
      );
      const duration = (windowEnd - pixelPos) / this.sampleRate;

      if (pixelPos + (endSample - startSample) >= samples.length) {
        frequencies.push(frequencies[frequencies.length - 1] || 1900);
        continue;
      }

      frequencies.push(this.detectFrequencyRange(samples, pixelPos, duration));
    }

    for (let x = 0; x < halfWidth; x++) {
      let freq = frequencies[x];

      if (x >= 2 && x < halfWidth - 2) {
        freq = [
          frequencies[x - 2],
          frequencies[x - 1],
          frequencies[x],
          frequencies[x + 1],
          frequencies[x + 2],
        ].sort((a, b) => a - b)[2];
      }

      const freqBlack = this.freqOffset ? FREQ_BLACK + this.freqOffset : FREQ_BLACK;
      const freqWhite = this.freqOffset ? FREQ_WHITE + this.freqOffset : FREQ_WHITE;
      const value = Math.max(
        0,
        Math.min(255, Math.round(((freq - freqBlack) / (freqWhite - freqBlack)) * 255))
      );

      const idx1 = y * this.mode.width + x * 2;
      const idx2 = y * this.mode.width + x * 2 + 1;

      if (componentType === 'U') {
        chromaU[idx1] = value;
        if (idx2 < this.mode.width * this.mode.lines) chromaU[idx2] = value;
      } else if (componentType === 'V') {
        chromaV[idx1] = value;
        if (idx2 < this.mode.width * this.mode.lines) chromaV[idx2] = value;
      }
    }

    return startPos + totalSamples;
  }

  decodeScanLinePD(samples, startPos, imageData, chromaU, chromaV, y) {
    const COMPONENT_TIME = this.mode.componentTime;
    const width = this.mode.width;
    const lines = this.mode.lines;
    const y1 = Math.min(y + 1, lines - 1);
    const totalSamples = Math.floor(COMPONENT_TIME * this.sampleRate);

    const decodeComponent = (baseOffset) => {
      const result = [];
      let position = startPos + baseOffset;
      for (let x = 0; x < width; x++) {
        const startSample = Math.floor((x / width) * totalSamples);
        const endSample = Math.floor(((x + 1) / width) * totalSamples);
        const duration = (endSample - startSample) / this.sampleRate;
        const freq = this.detectFrequencyRange(samples, position, duration);
        const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
        result.push(Math.max(0, Math.min(255, Math.round(normalized * 255))));
        position += endSample - startSample;
      }
      return result;
    };

    const y0values = decodeComponent(0);
    const ryValues = decodeComponent(totalSamples);
    const byValues = decodeComponent(totalSamples * 2);
    const y1values = decodeComponent(totalSamples * 3);

    for (let x = 0; x < width; x++) {
      const idx0 = (y * width + x) * 4;
      imageData.data[idx0] = y0values[x];
      imageData.data[idx0 + 1] = y0values[x];
      imageData.data[idx0 + 2] = y0values[x];
      imageData.data[idx0 + 3] = 255;

      const idx1 = (y1 * width + x) * 4;
      imageData.data[idx1] = y1values[x];
      imageData.data[idx1 + 1] = y1values[x];
      imageData.data[idx1 + 2] = y1values[x];
      imageData.data[idx1 + 3] = 255;

      chromaV[y * width + x] = ryValues[x];
      chromaV[y1 * width + x] = ryValues[x];
      chromaU[y * width + x] = byValues[x];
      chromaU[y1 * width + x] = byValues[x];
    }

    return startPos + totalSamples * 4;
  }

  convertYUVtoRGB(imageData, chromaU, chromaV) {
    for (let y = 0; y < this.mode.lines; y += 2) {
      const evenLine = y;
      const oddLine = Math.min(y + 1, this.mode.lines - 1);

      for (let x = 0; x < this.mode.width; x++) {
        const V = chromaV[evenLine * this.mode.width + x] || 128;
        const U = chromaU[oddLine * this.mode.width + x] || 128;

        if (y === 0 && x < 320) {
          if (!this.debugUVStats) this.debugUVStats = { uSum: 0, vSum: 0, count: 0 };
          this.debugUVStats.uSum += U;
          this.debugUVStats.vSum += V;
          this.debugUVStats.count++;
          if (x === 319) {
            console.log(
              `\nFirst line pair avg: U=${(this.debugUVStats.uSum / this.debugUVStats.count).toFixed(1)}, V=${(this.debugUVStats.vSum / this.debugUVStats.count).toFixed(1)}`
            );
          }
        }

        for (let ly = evenLine; ly <= oddLine && ly < this.mode.lines; ly++) {
          const idx = (ly * this.mode.width + x) * 4;
          const Y = imageData.data[idx];

          imageData.data[idx] = Math.max(0, Math.min(255, Math.round(Y + 1.402 * (V - 128))));
          imageData.data[idx + 1] = Math.max(
            0,
            Math.min(255, Math.round(Y - 0.344136 * (U - 128) - 0.714136 * (V - 128)))
          );
          imageData.data[idx + 2] = Math.max(0, Math.min(255, Math.round(Y + 1.772 * (U - 128))));
        }
      }
    }
  }

  convertPDtoRGB(imageData, chromaU, chromaV) {
    const width = this.mode.width;
    const lines = this.mode.lines;

    for (let y = 0; y < lines; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const Y = imageData.data[idx];
        const RYadj = (chromaV[y * width + x] || 128) - 128;
        const BYadj = (chromaU[y * width + x] || 128) - 128;

        imageData.data[idx] = Math.max(0, Math.min(255, Math.round(Y + RYadj)));
        imageData.data[idx + 1] = Math.max(
          0,
          Math.min(255, Math.round(Y - 0.194 * BYadj - 0.509 * RYadj))
        );
        imageData.data[idx + 2] = Math.max(0, Math.min(255, Math.round(Y + BYadj)));
      }
    }
  }

  estimateFreqOffset(samples, firstSyncPos) {
    const lineTime = this.mode.syncPulse + this.mode.syncPorch + 0.088 + 0.0045 + 0.0015 + 0.044;
    const lineSamples = Math.floor(lineTime * this.sampleRate);

    const measuredPorchFreqs = [];
    let pos = firstSyncPos;

    for (let line = 0; line < 20; line++) {
      const porchStart = pos + Math.floor(this.mode.syncPulse * this.sampleRate);
      const porchEnd = porchStart + Math.floor(this.mode.syncPorch * this.sampleRate);

      if (porchEnd >= samples.length) break;

      let maxMag = 0;
      let bestFreq = 1500;
      for (let f = 1200; f <= 1800; f += 5) {
        const mag = this.goertzel(samples, porchStart, porchEnd, f);
        if (mag > maxMag) {
          maxMag = mag;
          bestFreq = f;
        }
      }

      if (maxMag > 0.01) measuredPorchFreqs.push(bestFreq - FREQ_BLACK);
      pos += lineSamples;
    }

    if (measuredPorchFreqs.length < 5) return 0;

    measuredPorchFreqs.sort((a, b) => a - b);
    const medianOffset = measuredPorchFreqs[Math.floor(measuredPorchFreqs.length / 2)];
    console.log(
      `📡 Porch measurements: ${measuredPorchFreqs.length} samples, median offset: ${medianOffset}Hz`
    );

    return Math.abs(medianOffset) > 50 ? Math.round(medianOffset) : 0;
  }

  findSyncPulse(samples, startPos, endPos = samples.length) {
    const syncDuration = Math.max(0.004, this.mode?.syncPulse || 0.005);
    const samplesPerCheck = Math.floor(this.sampleRate * 0.0002);
    const searchEnd = Math.min(endPos, samples.length - Math.floor(syncDuration * this.sampleRate));

    for (let i = startPos; i < searchEnd; i += samplesPerCheck) {
      const freq = this.detectFrequency(samples, i, syncDuration);

      if (Math.abs(freq - FREQ_SYNC) < 200) {
        let syncValid = true;
        for (let j = 0; j < 3; j++) {
          const checkPos = i + Math.floor((syncDuration * this.sampleRate * j) / 3);
          if (
            Math.abs(this.detectFrequency(samples, checkPos, syncDuration / 3) - FREQ_SYNC) > 200
          ) {
            syncValid = false;
            break;
          }
        }
        if (syncValid) return i;
      }
    }

    return -1;
  }

  detectFrequency(samples, startIdx, duration) {
    const numSamples = Math.floor(duration * this.sampleRate);
    const endIdx = Math.min(startIdx + numSamples, samples.length);

    if (endIdx - startIdx < 10) return 0;

    const testFreqs = [
      1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300,
    ];
    let maxMag = 0;
    let detectedFreq = 1500;

    for (const freq of testFreqs) {
      const magnitude = this.goertzel(samples, startIdx, endIdx, freq);
      if (magnitude > maxMag) {
        maxMag = magnitude;
        detectedFreq = freq;
      }
    }

    if (maxMag > 0.05) {
      for (let f = detectedFreq - 100; f <= detectedFreq + 100; f += 10) {
        const magnitude = this.goertzel(samples, startIdx, endIdx, f);
        if (magnitude > maxMag) {
          maxMag = magnitude;
          detectedFreq = f;
        }
      }
    }

    return detectedFreq;
  }

  goertzel(samples, startIdx, endIdx, targetFreq) {
    const N = endIdx - startIdx;
    const k = (N * targetFreq) / this.sampleRate;
    const omega = (2 * Math.PI * k) / N;
    const coeff = 2 * Math.cos(omega);

    let s1 = 0;
    let s2 = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const s0 = samples[i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    const realPart = s1 - s2 * Math.cos(omega);
    const imagPart = s2 * Math.sin(omega);

    return Math.sqrt(realPart * realPart + imagPart * imagPart) / N;
  }

  findSyncPulseInFreqStream(freqStream, startPos, endPos = freqStream.length) {
    const syncDuration = Math.max(0.004, this.mode?.syncPulse || 0.005);
    const samplesPerCheck = Math.floor(this.sampleRate * 0.0002);
    const searchEnd = Math.min(
      endPos,
      freqStream.length - Math.floor(syncDuration * this.sampleRate)
    );
    const syncFreqNorm = (FREQ_SYNC - FREQ_CENTER) / (FREQ_BANDWIDTH / 2);

    let inSync = false;
    let syncStart = -1;

    for (let i = startPos; i < searchEnd; i += samplesPerCheck) {
      let avgFreq = 0;
      const numSamples = Math.floor(syncDuration * this.sampleRate);
      for (let j = 0; j < numSamples && i + j < freqStream.length; j++) {
        avgFreq += freqStream[i + j];
      }
      avgFreq /= numSamples;

      const deviation = Math.abs(avgFreq - syncFreqNorm);

      if (!inSync && deviation < 0.5) {
        inSync = true;
        syncStart = i;
      } else if (inSync && deviation > 0.7) {
        if ((i - syncStart) / this.sampleRate >= syncDuration * 0.7) return syncStart;
        inSync = false;
        syncStart = -1;
      } else if (inSync && (i - syncStart) / this.sampleRate >= syncDuration) {
        return syncStart;
      }
    }

    if (
      inSync &&
      syncStart !== -1 &&
      (searchEnd - syncStart) / this.sampleRate >= syncDuration * 0.7
    ) {
      return syncStart;
    }

    return -1;
  }

  decodeYFromFreqStream(freqStream, startPos, imageData, y) {
    const Y_SCAN_TIME = 0.088;
    const samplesPerPixel = Math.floor((Y_SCAN_TIME * this.sampleRate) / this.mode.width);

    for (let x = 0; x < this.mode.width; x++) {
      const pos = startPos + x * samplesPerPixel;
      if (pos >= freqStream.length) break;

      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) avgFreq += freqStream[pos + i];
      avgFreq /= sampleCount;

      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);
      let value = ((freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const pixelIdx = (y * this.mode.width + x) * 4;
      imageData.data[pixelIdx] = value;
      imageData.data[pixelIdx + 1] = value;
      imageData.data[pixelIdx + 2] = value;
      imageData.data[pixelIdx + 3] = 255;
    }

    return startPos + Math.floor(Y_SCAN_TIME * this.sampleRate);
  }

  decodeChromaFromFreqStream(freqStream, startPos, chromaU, chromaV, y, componentType) {
    const CHROMA_SCAN_TIME = 0.044;
    const halfWidth = Math.floor(this.mode.width / 2);
    const samplesPerPixel = Math.floor((CHROMA_SCAN_TIME * this.sampleRate) / halfWidth);

    const rawChroma = [];
    for (let x = 0; x < halfWidth; x++) {
      const pos = startPos + x * samplesPerPixel;
      if (pos >= freqStream.length) {
        rawChroma.push(rawChroma[rawChroma.length - 1] || 128);
        continue;
      }

      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) avgFreq += freqStream[pos + i];
      avgFreq /= sampleCount;

      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);
      const freqBlack = this.freqOffset ? FREQ_BLACK + this.freqOffset : FREQ_BLACK;
      const freqWhite = this.freqOffset ? FREQ_WHITE + this.freqOffset : FREQ_WHITE;
      const value = ((freq - freqBlack) / (freqWhite - freqBlack)) * 255;
      rawChroma.push(Math.max(0, Math.min(255, Math.round(value))));
    }

    const filteredChroma = rawChroma.map((v, x) => {
      if (x >= 2 && x < halfWidth - 2) {
        return [rawChroma[x - 2], rawChroma[x - 1], v, rawChroma[x + 1], rawChroma[x + 2]].sort(
          (a, b) => a - b
        )[2];
      }
      return v;
    });

    for (let x = 0; x < halfWidth; x++) {
      const chromaValue = filteredChroma[x];
      const idx1 = y * this.mode.width + x * 2;
      const idx2 = y * this.mode.width + x * 2 + 1;

      if (componentType === 'U') {
        chromaU[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) chromaU[idx2] = chromaValue;
      } else if (componentType === 'V') {
        chromaV[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) chromaV[idx2] = chromaValue;
      }
    }

    return startPos + Math.floor(CHROMA_SCAN_TIME * this.sampleRate);
  }

  decodeScanLineFromFreqStream(freqStream, startPos, imageData, y, channel) {
    const samplesPerPixel = Math.floor((this.mode.scanTime * this.sampleRate) / this.mode.width);

    for (let x = 0; x < this.mode.width; x++) {
      const pos = startPos + x * samplesPerPixel;
      if (pos >= freqStream.length) break;

      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) avgFreq += freqStream[pos + i];
      avgFreq /= sampleCount;

      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);
      let value = ((freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const idx = (y * this.mode.width + x) * 4;
      imageData.data[idx + channel] = value;
      imageData.data[idx + 3] = 255;
    }

    return startPos + Math.floor(this.mode.scanTime * this.sampleRate);
  }

  async decodeWithMode(audioFile, modeName) {
    this.mode = SSTV_MODES[modeName];

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const samples = audioBuffer.getChannelData(0);
    this.sampleRate = audioBuffer.sampleRate;

    if (this.useFMDemod) return this.decodeImageWithFM(samples);
    return this.decodeImage(samples);
  }
}
