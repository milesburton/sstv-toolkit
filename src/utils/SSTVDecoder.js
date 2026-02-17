// SSTV Decoder - Converts SSTV audio signals to images

import { FMDemodulator } from './FMDemodulator.js';
import { SSTV_MODES } from './SSTVEncoder.js';

const FREQ_SYNC = 1200;
const FREQ_BLACK = 1500;
const FREQ_WHITE = 2300;
const FREQ_CENTER = 1900; // Center frequency for FM demodulation
const FREQ_BANDWIDTH = 800; // Bandwidth: 2300 - 1500 = 800 Hz

export class SSTVDecoder {
  constructor(sampleRate = 48000, options = {}) {
    this.sampleRate = sampleRate;
    this.mode = null;
    // Frequency offset for calibration (ISS signals are often -150Hz)
    this.freqOffset = options.freqOffset || 0;
    this.autoCalibrate = options.autoCalibrate !== false; // Default true
    // Use FM demodulation for better ISS signal handling
    // TEMPORARILY DISABLED - investigating issues
    this.useFMDemod = options.useFMDemod === true; // Default false for now
  }

  async decodeAudio(audioFile) {
    // CRITICAL: Force AudioContext to use 48kHz to match encoder
    // Browser default is often 44.1kHz which causes timing mismatch
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio samples
    const samples = audioBuffer.getChannelData(0);
    this.sampleRate = audioBuffer.sampleRate;
    // audioContext can be closed after decoding
    audioContext.close();

    // Detect VIS code to determine mode
    this.mode = this.detectMode(samples);

    if (!this.mode) {
      throw new Error('Could not detect SSTV mode. Try manually selecting a mode.');
    }

    if (typeof window !== 'undefined') {
      console.log('📡 SSTV Mode detected:', this.mode.name);
    }

    // Decode image using FM demodulation or Goertzel fallback
    if (this.useFMDemod) {
      return this.decodeImageWithFM(samples);
    }
    return this.decodeImage(samples, {
      sampleRate: this.sampleRate,
      fileDuration: samples.length / this.sampleRate,
    });
  }

  /**
   * Decode image using FM demodulation (better for real-world signals)
   */
  decodeImageWithFM(samples) {
    // Create FM demodulator
    const fmDemod = new FMDemodulator(FREQ_CENTER, FREQ_BANDWIDTH, this.sampleRate);

    // Demodulate entire signal
    const demodulated = fmDemod.demodulateAll(samples);

    // Now decode using the frequency stream and original samples (for sync detection)
    return this.decodeImageFromFrequencyStream(demodulated, samples);
  }

  /**
   * Decode image from FM demodulated frequency stream
   * @param {Float32Array} freqStream - Demodulated frequency values
   * @param {Float32Array} samples - Original audio samples (for sync detection)
   */
  decodeImageFromFrequencyStream(freqStream, samples) {
    const canvas = document.createElement('canvas');
    canvas.width = this.mode.width;
    canvas.height = this.mode.lines;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(canvas.width, canvas.height);

    // Initialize all pixels to black with full opacity
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 0;
      imageData.data[i + 1] = 0;
      imageData.data[i + 2] = 0;
      imageData.data[i + 3] = 255;
    }

    // For YUV modes, initialize chroma storage
    let chromaU = null;
    let chromaV = null;
    if (this.mode.colorFormat === 'YUV') {
      chromaU = new Array(this.mode.width * this.mode.lines).fill(128);
      chromaV = new Array(this.mode.width * this.mode.lines).fill(128);
    }

    // Find first sync pulse using original samples (sync at 1200 Hz is outside FM demod bandwidth)
    const visEnd = this.visEndPos || Math.floor(0.61 * this.sampleRate);
    let position = this.findSyncPulse(samples, visEnd);

    if (position === -1) {
      throw new Error('Could not find sync pulse. Make sure this is a valid SSTV transmission.');
    }

    // Decode each line
    for (let y = 0; y < this.mode.lines && position < freqStream.length; y++) {
      // Skip sync pulse and porch
      position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);

      if (this.mode.colorFormat === 'RGB') {
        // Decode RGB channels (not commonly used for Robot36)
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 1);
        if (this.mode.separatorPulse) {
          position += Math.floor(this.mode.separatorPulse * this.sampleRate);
        }
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 2);
        if (this.mode.separatorPulse) {
          position += Math.floor(this.mode.separatorPulse * this.sampleRate);
        }
        position = this.decodeScanLineFromFreqStream(freqStream, position, imageData, y, 0);
      } else {
        // YUV mode (Robot36)
        // Decode Y (luminance)
        position = this.decodeYFromFreqStream(freqStream, position, imageData, y);

        // Skip separator and porch
        if (position < freqStream.length) {
          const sepDuration = 0.0045;
          const isEvenLine = y % 2 === 0;
          const currentChromaType = isEvenLine ? 'V' : 'U';

          position += Math.floor(sepDuration * this.sampleRate);
          position += Math.floor(0.0015 * this.sampleRate); // porch

          // Decode chrominance
          if (position < freqStream.length) {
            position = this.decodeChromaFromFreqStream(
              freqStream,
              position,
              chromaU,
              chromaV,
              y,
              currentChromaType
            );
          }
        }
      }

      // Find next sync pulse using original samples
      if (this.autoCalibrate) {
        const maxLineDuration =
          (this.mode.syncPulse + this.mode.syncPorch + this.mode.scanTime * 3) * 2;
        const searchLimit = position + Math.floor(maxLineDuration * this.sampleRate);
        const nextSync = this.findSyncPulse(samples, position, searchLimit);
        if (nextSync !== -1) {
          position = nextSync;
        } else {
          const expectedLinePosition =
            position + Math.floor(this.mode.scanTime * this.sampleRate * 0.5);
          if (expectedLinePosition < samples.length) {
            const expandedSync = this.findSyncPulse(
              samples,
              expectedLinePosition,
              expectedLinePosition + Math.floor(maxLineDuration * this.sampleRate)
            );
            position = expandedSync !== -1 ? expandedSync : expectedLinePosition;
          }
        }
      }
    }

    // Convert YUV to RGB if needed
    if (this.mode.colorFormat === 'YUV') {
      this.convertYUVtoRGB(imageData, chromaU, chromaV);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  detectMode(samples) {
    // Look for VIS code in first 2 seconds
    const searchSamples = Math.min(samples.length, this.sampleRate * 2);

    // VIS structure: 300ms leader@1900Hz → 10ms break@1200Hz → 30ms start@1900Hz → data bits
    // We need to find the 1900Hz START BIT that comes AFTER the 1200Hz break
    // Strategy: look for 1200Hz (break), then check if 1900Hz follows immediately
    const step = Math.floor(this.sampleRate * 0.0005); // 0.5ms steps
    for (let i = 0; i < searchSamples - 1000; i += step) {
      const freq = this.detectFrequency(samples, i, 0.01);

      // Look for the 1200Hz break (10ms)
      if (Math.abs(freq - 1200) < 100) {
        // Check if 1900Hz start bit follows within ~15ms
        const startBitPos = i + Math.floor(0.01 * this.sampleRate);
        if (startBitPos + Math.floor(0.03 * this.sampleRate) >= samples.length) continue;

        const startBitFreq = this.detectFrequency(samples, startBitPos, 0.03);
        if (Math.abs(startBitFreq - 1900) < 100) {
          // Found start bit! Decode VIS data bits starting after the start bit
          const visCode = this.decodeVIS(samples, startBitPos);
          this.lastVisCode = visCode;

          // VIS ends after: start bit (30ms) + 7 data bits (210ms) + parity (30ms) + stop (30ms) = 300ms
          const visEndPos = startBitPos + Math.floor(0.3 * this.sampleRate);

          // Find matching mode
          for (const [_key, mode] of Object.entries(SSTV_MODES)) {
            if (mode.visCode === visCode) {
              this.visEndPos = visEndPos;
              return mode;
            }
          }

          // Unknown VIS code but we found a valid VIS sequence - store position and default
          this.visEndPos = visEndPos;
        }
      }
    }

    return SSTV_MODES.ROBOT36;
  }

  decodeVIS(samples, startIdx) {
    let idx = startIdx + Math.floor(0.03 * this.sampleRate); // Skip start bit
    let visCode = 0;
    const frequenciesDetected = [];

    for (let bit = 0; bit < 7; bit++) {
      const freq = this.detectFrequency(samples, idx, 0.03);
      frequenciesDetected.push(freq);
      const bitValue = freq < 1200 ? 1 : 0; // 1100 Hz = 1, 1300 Hz = 0

      if (bitValue) {
        visCode |= 1 << bit;
      }

      idx += Math.floor(0.03 * this.sampleRate);
    }

    // Log VIS frequencies for debugging (only in development)
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

    // Initialize all pixels to black with full opacity
    // This ensures pixels that don't get decoded are opaque rather than transparent
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 0; // R
      imageData.data[i + 1] = 0; // G
      imageData.data[i + 2] = 0; // B
      imageData.data[i + 3] = 255; // A - critical for visibility
    }

    // For YUV and PD modes, we need temporary storage for chrominance
    // Initialize to 128 (neutral gray) instead of 0 to prevent green tint if decoding fails
    let chromaU = null;
    let chromaV = null;
    if (this.mode.colorFormat === 'YUV' || this.mode.colorFormat === 'PD') {
      chromaU = new Array(this.mode.width * this.mode.lines).fill(128);
      chromaV = new Array(this.mode.width * this.mode.lines).fill(128);
    }

    // Find first sync pulse starting from where VIS ended
    // this.visEndPos is set by detectMode() to the exact position after VIS stop bit
    // Fall back to searching from near start if VIS position unknown
    const visEnd = this.visEndPos || Math.floor(0.61 * this.sampleRate);
    const searchPositions = [
      visEnd, // Right after VIS - most accurate
      visEnd - Math.floor(0.05 * this.sampleRate), // Slightly before (timing variance)
      visEnd + Math.floor(0.05 * this.sampleRate), // Slightly after
      Math.floor(0.5 * this.sampleRate), // Fallback
      0, // Last resort
    ];

    let position = -1;
    for (const startPos of searchPositions) {
      if (startPos < 0) continue;
      position = this.findSyncPulse(samples, startPos);
      if (position !== -1) {
        break;
      }
    }

    if (position === -1) {
      throw new Error('Could not find sync pulse. Make sure this is a valid SSTV transmission.');
    }

    // Decode each line (or line pair for PD modes)
    if (this.mode.colorFormat === 'PD') {
      // PD modes: Process line pairs (Y0, R-Y, B-Y, Y1)
      for (let y = 0; y < this.mode.lines; y += 2) {
        // Skip sync pulse and porch
        position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);

        // Decode the line pair
        position = this.decodeScanLinePD(samples, position, imageData, chromaU, chromaV, y);

        // Find next sync pulse if auto-calibration enabled
        if (this.autoCalibrate && y + 2 < this.mode.lines) {
          const maxLineDuration =
            (this.mode.syncPulse + this.mode.syncPorch + this.mode.componentTime * 4) * 2;
          const searchLimit = position + Math.floor(maxLineDuration * this.sampleRate);
          const nextSync = this.findSyncPulse(samples, position, searchLimit);
          if (nextSync !== -1) {
            position = nextSync;
          }
        }
      }
    } else {
      // Standard line-by-line decoding for RGB and YUV modes
      for (let y = 0; y < this.mode.lines && position < samples.length; y++) {
        // Skip sync pulse and porch
        position += Math.floor((this.mode.syncPulse + this.mode.syncPorch) * this.sampleRate);

        if (this.mode.colorFormat === 'RGB') {
          // Decode Green
          position = this.decodeScanLine(samples, position, imageData, y, 1);

          // Skip separator
          if (this.mode.separatorPulse) {
            position += Math.floor(this.mode.separatorPulse * this.sampleRate);
          }

          // Decode Blue
          position = this.decodeScanLine(samples, position, imageData, y, 2);

          // Skip separator
          if (this.mode.separatorPulse) {
            position += Math.floor(this.mode.separatorPulse * this.sampleRate);
          }

          // Decode Red
          position = this.decodeScanLine(samples, position, imageData, y, 0);
        } else {
          // YUV mode (Robot): Each line has Y + separator + porch + chrominance
          // Robot36 timing: Y=88ms, separator=4.5ms, porch=1.5ms, chroma=44ms

          // Step 1: Decode Y (luminance) for this line (88ms)
          position = this.decodeScanLineYUV(samples, position, imageData, y);

          // Step 2: Skip separator and determine chroma type (4.5ms)
          if (position < samples.length) {
            const sepDuration = 0.0045;

            // Use line number to determine chroma type
            // Separator: Even lines = 1500Hz (V/R-Y), Odd lines = 2300Hz (U/B-Y)
            // Note: Separator frequency is unreliable in real-world signals
            const isEvenLine = y % 2 === 0;
            this.currentChromaType = isEvenLine ? 'V' : 'U';

            position += Math.floor(sepDuration * this.sampleRate);

            // Step 3: Skip porch (1.5ms)
            position += Math.floor(0.0015 * this.sampleRate);

            // Step 4: Decode chrominance at half resolution (44ms)
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

        // Find next sync pulse only if auto-calibration is enabled (for real-world signals with timing drift)
        // For perfect encoder-generated signals, trust the position tracking
        if (this.autoCalibrate) {
          const maxLineDuration =
            (this.mode.syncPulse + this.mode.syncPorch + this.mode.scanTime * 3) * 2;
          const searchLimit = position + Math.floor(maxLineDuration * this.sampleRate);
          const nextSync = this.findSyncPulse(samples, position, searchLimit);
          if (nextSync !== -1) {
            position = nextSync;
          } else {
            // If sync not found, advance by expected line duration
            // This helps maintain alignment even if sync detection is weak
            const expectedLinePosition =
              position + Math.floor(this.mode.scanTime * this.sampleRate * 0.5);
            if (expectedLinePosition < samples.length) {
              // Try to find sync in an expanded window
              const expandedSync = this.findSyncPulse(
                samples,
                expectedLinePosition,
                expectedLinePosition + Math.floor(maxLineDuration * this.sampleRate)
              );
              position = expandedSync !== -1 ? expandedSync : expectedLinePosition;
            }
          }
        }
      }
    }

    // After decoding all lines, convert to RGB if needed
    if (this.mode.colorFormat === 'YUV') {
      this.convertYUVtoRGB(imageData, chromaU, chromaV);
    } else if (this.mode.colorFormat === 'PD') {
      this.convertPDtoRGB(imageData, chromaU, chromaV);
    }

    ctx.putImageData(imageData, 0, 0);

    const imageUrl = canvas.toDataURL('image/png');
    const quality = this.analyzeImageQuality(ctx, canvas.width, canvas.height);
    const decodeTime = Date.now() - decodeStart;

    return {
      imageUrl,
      diagnostics: {
        mode: this.mode.name,
        visCode: this.lastVisCode,
        sampleRate: audioMeta.sampleRate || this.sampleRate,
        fileDuration: audioMeta.fileDuration
          ? `${audioMeta.fileDuration.toFixed(2)}s`
          : null,
        freqOffset: this.freqOffset,
        autoCalibrate: this.autoCalibrate,
        visEndPos: this.visEndPos,
        decodeTimeMs: decodeTime,
        quality,
      },
    };
  }

  /**
   * Analyse a decoded canvas to compute basic image quality stats.
   * Returns average RGB, color balance score, and a quality verdict.
   */
  analyzeImageQuality(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let rSum = 0, gSum = 0, bSum = 0;
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

    // Detect common failure modes
    const greenDominance = gAvg - (rAvg + bAvg) / 2;
    const colorImbalance = Math.max(rAvg, gAvg, bAvg) - Math.min(rAvg, gAvg, bAvg);

    let verdict = 'good';
    const warnings = [];
    if (brightness < 10) {
      verdict = 'bad';
      warnings.push('Image is almost entirely black — sync or timing issue');
    } else if (greenDominance > 40) {
      verdict = 'bad';
      warnings.push(`Heavy green tint (G dominates by ${greenDominance.toFixed(0)}) — chroma decode error`);
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
    // Use exact sample positions (same technique as encoder) to avoid cumulative rounding errors
    const totalSamples = Math.floor(this.mode.scanTime * this.sampleRate);

    for (let x = 0; x < this.mode.width; x++) {
      const startSample = Math.floor((x / this.mode.width) * totalSamples);
      const endSample = Math.floor(((x + 1) / this.mode.width) * totalSamples);
      const pos = startPos + startSample;
      const duration = (endSample - startSample) / this.sampleRate;

      if (pos >= samples.length) break;

      const freq = this.detectFrequencyRange(samples, pos, duration);

      // Map frequency to pixel value with clamping
      let value = ((freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const idx = (y * this.mode.width + x) * 4;
      imageData.data[idx + channel] = value;
      imageData.data[idx + 3] = 255; // Alpha
    }

    return startPos + totalSamples;
  }

  // Detect frequency across the full SSTV range
  detectFrequencyRange(samples, startIdx, duration) {
    const numSamples = Math.floor(duration * this.sampleRate);
    const endIdx = Math.min(startIdx + numSamples, samples.length);

    if (endIdx - startIdx < 10) return FREQ_BLACK;

    // Sweep through the SSTV frequency range in steps
    let maxMag = 0;
    let detectedFreq = FREQ_BLACK;

    // Coarse sweep (every 25 Hz for better initial detection)
    for (let freq = FREQ_SYNC - 100; freq <= FREQ_WHITE + 200; freq += 25) {
      const magnitude = this.goertzel(samples, startIdx, endIdx, freq);
      if (magnitude > maxMag) {
        maxMag = magnitude;
        detectedFreq = freq;
      }
    }

    // Fine sweep around the detected frequency (every 1 Hz for accuracy)
    // Narrower search range since coarse is more accurate now
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
    // Robot36: Y scan is 88ms for full width
    const Y_SCAN_TIME = 0.088;
    // Use exact sample positions (same technique as encoder) to avoid cumulative rounding errors
    const totalSamples = Math.floor(Y_SCAN_TIME * this.sampleRate);
    // Minimum window needed for accurate Goertzel detection (~5 cycles of 1900Hz at 48kHz = ~127 samples = ~3 pixels)
    const minWindowSamples = Math.max(96, Math.floor(totalSamples / this.mode.width) * 4);

    for (let x = 0; x < this.mode.width; x++) {
      const startSample = Math.floor((x / this.mode.width) * totalSamples);
      const endSample = Math.floor(((x + 1) / this.mode.width) * totalSamples);
      const pos = startPos + startSample;
      // Use wider window for better frequency resolution, but don't exceed scan boundary
      const windowEnd = Math.min(
        startPos + totalSamples,
        pos + Math.max(endSample - startSample, minWindowSamples)
      );
      const duration = (windowEnd - pos) / this.sampleRate;

      if (pos >= samples.length) break;

      const freq = this.detectFrequencyRange(samples, pos, duration);

      // Map frequency to Y value (FULL RANGE 0-255, NOT video range!)
      // Apply frequency offset calibration if set (for ISS signals with frequency shift)
      const freqBlack = FREQ_BLACK + this.freqOffset;
      const freqWhite = FREQ_WHITE + this.freqOffset;
      const normalized = (freq - freqBlack) / (freqWhite - freqBlack);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      // Store Y directly in image data as grayscale (will be corrected later)
      const pixelIdx = (y * this.mode.width + x) * 4;
      imageData.data[pixelIdx] = value; // R
      imageData.data[pixelIdx + 1] = value; // G
      imageData.data[pixelIdx + 2] = value; // B
      imageData.data[pixelIdx + 3] = 255; // Alpha
    }

    return startPos + totalSamples;
  }

  decodeScanLineChroma(samples, startPos, chromaU, chromaV, y, componentType) {
    // Robot36: Chrominance scan is 44ms at half horizontal resolution
    const CHROMA_SCAN_TIME = 0.044;
    const halfWidth = Math.floor(this.mode.width / 2);
    // Use exact sample positions (same technique as encoder) to avoid cumulative rounding errors
    const totalSamples = Math.floor(CHROMA_SCAN_TIME * this.sampleRate);

    // Minimum window needed for accurate Goertzel detection (~5 cycles of 1900Hz at 48kHz = ~127 samples)
    const minWindowSamples = Math.max(96, Math.floor(totalSamples / halfWidth) * 4);

    // Pre-compute all frequencies - using exact sample positions
    const frequencies = [];
    for (let x = 0; x < halfWidth; x++) {
      const startSample = Math.floor((x / halfWidth) * totalSamples);
      const endSample = Math.floor(((x + 1) / halfWidth) * totalSamples);
      const pixelPos = startPos + startSample;
      // Use wider window for better frequency resolution, but don't exceed scan boundary
      const windowEnd = Math.min(
        startPos + totalSamples,
        pixelPos + Math.max(endSample - startSample, minWindowSamples)
      );
      const duration = (windowEnd - pixelPos) / this.sampleRate;

      if (pixelPos + (endSample - startSample) >= samples.length) {
        // Use last valid frequency for remaining pixels
        frequencies.push(frequencies[frequencies.length - 1] || 1900);
        continue;
      }

      const freq = this.detectFrequencyRange(samples, pixelPos, duration);
      frequencies.push(freq);
    }

    // Apply median filter for noise reduction
    for (let x = 0; x < halfWidth; x++) {
      let freq = frequencies[x];

      // Median of 5 neighboring samples
      if (x >= 2 && x < halfWidth - 2) {
        const window = [
          frequencies[x - 2],
          frequencies[x - 1],
          frequencies[x],
          frequencies[x + 1],
          frequencies[x + 2],
        ].sort((a, b) => a - b);
        freq = window[2]; // median of 5
      }

      // Map frequency to component value (FULL RANGE 0-255, NOT video range!)
      // Robot36 uses full range per memory documentation
      // Use calibrated frequencies if offset is set (for ISS signals with frequency shift)
      const freqBlack = this.freqOffset ? FREQ_BLACK + this.freqOffset : FREQ_BLACK;
      const freqWhite = this.freqOffset ? FREQ_WHITE + this.freqOffset : FREQ_WHITE;
      const normalized = (freq - freqBlack) / (freqWhite - freqBlack);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const chromaValue = value;

      // Collect stats for analysis
      if (!this.debugChromaStats) {
        this.debugChromaStats = { uValues: [], vValues: [], uFreqs: [], vFreqs: [] };
      }
      if (componentType === 'U') {
        this.debugChromaStats.uValues.push(chromaValue);
        this.debugChromaStats.uFreqs.push(freq);
      } else if (componentType === 'V') {
        this.debugChromaStats.vValues.push(chromaValue);
        this.debugChromaStats.vFreqs.push(freq);
      }

      // Store chrominance for two pixels (expanding from half resolution)
      const idx1 = y * this.mode.width + x * 2;
      const idx2 = y * this.mode.width + x * 2 + 1;

      if (componentType === 'U') {
        chromaU[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) {
          chromaU[idx2] = chromaValue;
        }
      } else if (componentType === 'V') {
        chromaV[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) {
          chromaV[idx2] = chromaValue;
        }
      }
    }

    return startPos + totalSamples;
  }

  decodeScanLinePD(samples, startPos, imageData, chromaU, chromaV, y) {
    // PD120 format: Decode line pair (Y0, R-Y, B-Y, Y1)
    // Each component is 121.6ms at full width (640 pixels for PD120)
    const COMPONENT_TIME = this.mode.componentTime; // 0.1216s
    const width = this.mode.width;
    const lines = this.mode.lines;
    let position = startPos;

    const y1 = Math.min(y + 1, lines - 1);

    // Helper to detect frequency at current position
    const detectFreq = (pos, duration) => {
      return this.detectFrequencyRange(samples, pos, duration);
    };

    // Calculate exact sample positions to avoid rounding errors
    const totalSamples = Math.floor(COMPONENT_TIME * this.sampleRate);

    // 1. Decode Y0 (first line luminance) - 640 pixels
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor((x / width) * totalSamples);
      const endSample = Math.floor(((x + 1) / width) * totalSamples);
      const duration = (endSample - startSample) / this.sampleRate;

      const freq = detectFreq(position, duration);
      const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const pixelIdx = (y * width + x) * 4;
      imageData.data[pixelIdx] = value;
      imageData.data[pixelIdx + 1] = value;
      imageData.data[pixelIdx + 2] = value;
      imageData.data[pixelIdx + 3] = 255;

      position += endSample - startSample;
    }

    // 2. Decode R-Y - 640 pixels
    position = startPos + totalSamples;
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor((x / width) * totalSamples);
      const endSample = Math.floor(((x + 1) / width) * totalSamples);
      const duration = (endSample - startSample) / this.sampleRate;

      const freq = detectFreq(position, duration);
      const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      // Store R-Y for both lines in the pair
      chromaV[y * width + x] = value;
      chromaV[y1 * width + x] = value;

      position += endSample - startSample;
    }

    // 3. Decode B-Y - 640 pixels
    position = startPos + totalSamples * 2;
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor((x / width) * totalSamples);
      const endSample = Math.floor(((x + 1) / width) * totalSamples);
      const duration = (endSample - startSample) / this.sampleRate;

      const freq = detectFreq(position, duration);
      const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      // Store B-Y for both lines in the pair
      chromaU[y * width + x] = value;
      chromaU[y1 * width + x] = value;

      position += endSample - startSample;
    }

    // 4. Decode Y1 (second line luminance) - 640 pixels
    position = startPos + totalSamples * 3;
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor((x / width) * totalSamples);
      const endSample = Math.floor(((x + 1) / width) * totalSamples);
      const duration = (endSample - startSample) / this.sampleRate;

      const freq = detectFreq(position, duration);
      const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const pixelIdx = (y1 * width + x) * 4;
      imageData.data[pixelIdx] = value;
      imageData.data[pixelIdx + 1] = value;
      imageData.data[pixelIdx + 2] = value;
      imageData.data[pixelIdx + 3] = 255;

      position += endSample - startSample;
    }

    return startPos + totalSamples * 4;
  }

  convertYUVtoRGB(imageData, chromaU, chromaV) {
    // Convert YUV to RGB using FULL RANGE formulas (0-255, NOT video range!)
    // Per memory documentation, Robot36 uses full range YUV
    // Process line pairs: even line has V (R-Y), odd line has U (B-Y)
    // Both lines in a pair use the same chrominance values
    for (let y = 0; y < this.mode.lines; y += 2) {
      // For this line pair, get V from even line and U from odd line
      const evenLine = y;
      const oddLine = Math.min(y + 1, this.mode.lines - 1);

      for (let x = 0; x < this.mode.width; x++) {
        // CRITICAL FIX: Chroma is stored at x*2 indices (half resolution expanded to full)
        // When we stored chroma for pixel x, we put it at indices x*2 and x*2+1
        // So when retrieving for pixel x, we need to read from index x (which maps to x/2 chroma pixel)
        const evenChromaIdx = evenLine * this.mode.width + x;
        const oddChromaIdx = oddLine * this.mode.width + x;

        const V = chromaV[evenChromaIdx] || 128; // V from even line
        const U = chromaU[oddChromaIdx] || 128; // U from odd line

        // Debug: collect U/V statistics for first line pair
        if (y === 0 && x < 320) {
          if (!this.debugUVStats) {
            this.debugUVStats = { uSum: 0, vSum: 0, count: 0 };
          }
          this.debugUVStats.uSum += U;
          this.debugUVStats.vSum += V;
          this.debugUVStats.count++;
          if (x === 319) {
            console.log(
              `\nFirst line pair avg: U=${(this.debugUVStats.uSum / this.debugUVStats.count).toFixed(1)}, V=${(this.debugUVStats.vSum / this.debugUVStats.count).toFixed(1)}`
            );
          }
        }

        // Apply to both lines in the pair
        for (let ly = evenLine; ly <= oddLine && ly < this.mode.lines; ly++) {
          const idx = (ly * this.mode.width + x) * 4;

          // Get Y (already stored in imageData as R component)
          const Y = imageData.data[idx];

          // YUV to RGB conversion (FULL RANGE, NOT video range!)
          // Per memory documentation:
          // R = Y + 1.402*(V - 128)
          // G = Y - 0.344136*(U - 128) - 0.714136*(V - 128)
          // B = Y + 1.772*(U - 128)
          let R = Y + 1.402 * (V - 128);
          let G = Y - 0.344136 * (U - 128) - 0.714136 * (V - 128);
          let B = Y + 1.772 * (U - 128);

          // Clamp to valid range
          R = Math.max(0, Math.min(255, Math.round(R)));
          G = Math.max(0, Math.min(255, Math.round(G)));
          B = Math.max(0, Math.min(255, Math.round(B)));

          // Update pixel
          imageData.data[idx] = R;
          imageData.data[idx + 1] = G;
          imageData.data[idx + 2] = B;
        }
      }
    }
  }

  convertPDtoRGB(imageData, chromaU, chromaV) {
    // Convert PD format (Y, R-Y, B-Y) to RGB using full range
    const width = this.mode.width;
    const lines = this.mode.lines;

    for (let y = 0; y < lines; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Get Y (already stored as grayscale)
        const Y = imageData.data[idx];

        // Get R-Y and B-Y
        const RY = chromaV[y * width + x] || 128;
        const BY = chromaU[y * width + x] || 128;

        // Convert to RGB using PD formulas (full range)
        // R = Y + (R-Y)
        // B = Y + (B-Y)
        // G = Y - 0.194*(B-Y) - 0.509*(R-Y)
        const RYadj = RY - 128;
        const BYadj = BY - 128;

        let R = Y + RYadj;
        let G = Y - 0.194 * BYadj - 0.509 * RYadj;
        let B = Y + BYadj;

        // Clamp to valid range
        R = Math.max(0, Math.min(255, Math.round(R)));
        G = Math.max(0, Math.min(255, Math.round(G)));
        B = Math.max(0, Math.min(255, Math.round(B)));

        // Update pixel
        imageData.data[idx] = R;
        imageData.data[idx + 1] = G;
        imageData.data[idx + 2] = B;
      }
    }
  }

  /**
   * Estimate frequency offset by pre-scanning chroma from first 20 lines.
   * Uses porch tones (always 1500Hz/black level) as reference — they follow each sync pulse.
   * The porch (1.5ms @ 1500Hz) is a reliable reference tone at a known frequency.
   */
  estimateFreqOffset(samples, firstSyncPos) {
    const Y_SCAN_TIME = 0.088;
    const SEPARATOR_TIME = 0.0045;
    const PORCH_TIME = 0.0015;
    const CHROMA_SCAN_TIME = 0.044;
    const lineTime =
      this.mode.syncPulse +
      this.mode.syncPorch +
      Y_SCAN_TIME +
      SEPARATOR_TIME +
      PORCH_TIME +
      CHROMA_SCAN_TIME;
    const lineSamples = Math.floor(lineTime * this.sampleRate);

    const measuredPorchFreqs = [];
    let pos = firstSyncPos;

    for (let line = 0; line < 20; line++) {
      // Porch (1500Hz black level) starts right after sync pulse
      const porchStart = pos + Math.floor(this.mode.syncPulse * this.sampleRate);
      const porchEnd = porchStart + Math.floor(this.mode.syncPorch * this.sampleRate);

      if (porchEnd >= samples.length) break;

      // Fine sweep around 1500Hz (the porch/black level reference)
      let maxMag = 0;
      let bestFreq = 1500;
      for (let f = 1200; f <= 1800; f += 5) {
        const mag = this.goertzel(samples, porchStart, porchEnd, f);
        if (mag > maxMag) {
          maxMag = mag;
          bestFreq = f;
        }
      }

      if (maxMag > 0.01) {
        measuredPorchFreqs.push(bestFreq - FREQ_BLACK); // deviation from expected 1500Hz
      }

      pos += lineSamples;
    }

    if (measuredPorchFreqs.length < 5) return 0;

    // Use median to reject outliers from noisy signal
    measuredPorchFreqs.sort((a, b) => a - b);
    const medianOffset = measuredPorchFreqs[Math.floor(measuredPorchFreqs.length / 2)];

    console.log(
      `📡 Porch measurements: ${measuredPorchFreqs.length} samples, median offset: ${medianOffset}Hz`
    );

    // Only apply if significant (>50Hz)
    return Math.abs(medianOffset) > 50 ? Math.round(medianOffset) : 0;
  }

  findSyncPulse(samples, startPos, endPos = samples.length) {
    const syncDuration = Math.max(0.004, this.mode?.syncPulse || 0.005);
    const samplesPerCheck = Math.floor(this.sampleRate * 0.0002); // Check every 0.2ms for finer resolution
    const searchEnd = Math.min(endPos, samples.length - Math.floor(syncDuration * this.sampleRate));

    for (let i = startPos; i < searchEnd; i += samplesPerCheck) {
      const freq = this.detectFrequency(samples, i, syncDuration);

      // More lenient sync detection - allow 200 Hz tolerance for real-world signals
      if (Math.abs(freq - FREQ_SYNC) < 200) {
        // Verify it's actually a sync by checking duration
        let syncValid = true;

        // Sample a few points through the sync pulse
        for (let j = 0; j < 3; j++) {
          const checkPos = i + Math.floor((syncDuration * this.sampleRate * j) / 3);
          const checkFreq = this.detectFrequency(samples, checkPos, syncDuration / 3);
          if (Math.abs(checkFreq - FREQ_SYNC) > 200) {
            syncValid = false;
            break;
          }
        }

        if (syncValid) {
          return i;
        }
      }
    }

    return -1;
  }

  detectFrequency(samples, startIdx, duration) {
    const numSamples = Math.floor(duration * this.sampleRate);
    const endIdx = Math.min(startIdx + numSamples, samples.length);

    if (endIdx - startIdx < 10) return 0;

    // Use Goertzel algorithm for more accurate frequency detection
    // Test for common SSTV frequencies with extended range
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

    // If we have a strong signal, interpolate for more accuracy
    if (maxMag > 0.05) {
      // Fine-tune around the detected frequency with wider range for noisy signals
      const step = 100;
      for (let f = detectedFreq - step; f <= detectedFreq + step; f += 10) {
        const magnitude = this.goertzel(samples, startIdx, endIdx, f);
        if (magnitude > maxMag) {
          maxMag = magnitude;
          detectedFreq = f;
        }
      }
    }

    return detectedFreq;
  }

  // Goertzel algorithm for single-frequency DFT
  goertzel(samples, startIdx, endIdx, targetFreq) {
    const N = endIdx - startIdx;
    // Use exact frequency, not rounded to nearest bin
    // This allows fractional bins for better accuracy
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

  /**
   * Find sync pulse (1200 Hz) in frequency stream
   */
  findSyncPulseInFreqStream(freqStream, startPos, endPos = freqStream.length) {
    const syncDuration = Math.max(0.004, this.mode?.syncPulse || 0.005);
    const samplesPerCheck = Math.floor(this.sampleRate * 0.0002);
    const searchEnd = Math.min(
      endPos,
      freqStream.length - Math.floor(syncDuration * this.sampleRate)
    );

    // Schmitt trigger for robust sync detection
    const syncEnterThreshold = 0.5; // Normalized frequency threshold
    const syncStayThreshold = 0.7;
    let inSync = false;
    let syncStart = -1;

    // Target normalized frequency for sync (1200 Hz)
    // Normalized: (1200 - 1900) / 400 = -1.75
    const syncFreqNorm = (FREQ_SYNC - FREQ_CENTER) / (FREQ_BANDWIDTH / 2);

    for (let i = startPos; i < searchEnd; i += samplesPerCheck) {
      // Average frequency over sync duration
      let avgFreq = 0;
      const samples = Math.floor(syncDuration * this.sampleRate);
      for (let j = 0; j < samples && i + j < freqStream.length; j++) {
        avgFreq += freqStream[i + j];
      }
      avgFreq /= samples;

      const deviation = Math.abs(avgFreq - syncFreqNorm);

      if (!inSync && deviation < syncEnterThreshold) {
        inSync = true;
        syncStart = i;
      } else if (inSync && deviation > syncStayThreshold) {
        const syncLength = (i - syncStart) / this.sampleRate;
        if (syncLength >= syncDuration * 0.7) {
          return syncStart;
        }
        inSync = false;
        syncStart = -1;
      } else if (inSync) {
        const syncLength = (i - syncStart) / this.sampleRate;
        if (syncLength >= syncDuration) {
          return syncStart;
        }
      }
    }

    if (inSync && syncStart !== -1) {
      const syncLength = (searchEnd - syncStart) / this.sampleRate;
      if (syncLength >= syncDuration * 0.7) {
        return syncStart;
      }
    }

    return -1;
  }

  /**
   * Decode Y (luminance) from frequency stream
   */
  decodeYFromFreqStream(freqStream, startPos, imageData, y) {
    const Y_SCAN_TIME = 0.088;
    const samplesPerPixel = Math.floor((Y_SCAN_TIME * this.sampleRate) / this.mode.width);

    for (let x = 0; x < this.mode.width; x++) {
      const pos = startPos + x * samplesPerPixel;
      if (pos >= freqStream.length) break;

      // Average frequency over pixel duration
      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) {
        avgFreq += freqStream[pos + i];
      }
      avgFreq /= sampleCount;

      // Convert normalized frequency to actual Hz
      // Normalized freq range: -1 to +1 maps to (CENTER - BW/2) to (CENTER + BW/2)
      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);

      // Map frequency to Y value (FULL RANGE 0-255, NOT video range!)
      // Robot36 uses full range per PySSTV: value = ((freq - 1500) / 800) * 255
      const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      const pixelIdx = (y * this.mode.width + x) * 4;
      imageData.data[pixelIdx] = value;
      imageData.data[pixelIdx + 1] = value;
      imageData.data[pixelIdx + 2] = value;
      imageData.data[pixelIdx + 3] = 255;
    }

    return startPos + Math.floor(Y_SCAN_TIME * this.sampleRate);
  }

  /**
   * Decode chrominance from frequency stream
   */
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

      // Average frequency over pixel duration
      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) {
        avgFreq += freqStream[pos + i];
      }
      avgFreq /= sampleCount;

      // Convert normalized frequency to actual Hz
      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);

      // Map frequency to chroma value (FULL RANGE 0-255, NOT video range!)
      // Robot36 uses full range per memory documentation
      const freqBlack = this.freqOffset ? FREQ_BLACK + this.freqOffset : FREQ_BLACK;
      const freqWhite = this.freqOffset ? FREQ_WHITE + this.freqOffset : FREQ_WHITE;
      const normalized = (freq - freqBlack) / (freqWhite - freqBlack);
      let value = normalized * 255;
      value = Math.max(0, Math.min(255, Math.round(value)));

      rawChroma.push(value);
    }

    // Apply simple median filter for noise reduction
    const filteredChroma = [];
    for (let x = 0; x < halfWidth; x++) {
      if (x >= 2 && x < halfWidth - 2) {
        const window = [
          rawChroma[x - 2],
          rawChroma[x - 1],
          rawChroma[x],
          rawChroma[x + 1],
          rawChroma[x + 2],
        ].sort((a, b) => a - b);
        filteredChroma.push(window[2]);
      } else {
        filteredChroma.push(rawChroma[x]);
      }
    }

    // Store chroma values
    for (let x = 0; x < halfWidth; x++) {
      const chromaValue = filteredChroma[x];
      const idx1 = y * this.mode.width + x * 2;
      const idx2 = y * this.mode.width + x * 2 + 1;

      if (componentType === 'U') {
        chromaU[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) {
          chromaU[idx2] = chromaValue;
        }
      } else if (componentType === 'V') {
        chromaV[idx1] = chromaValue;
        if (idx2 < this.mode.width * this.mode.lines) {
          chromaV[idx2] = chromaValue;
        }
      }
    }

    return startPos + Math.floor(CHROMA_SCAN_TIME * this.sampleRate);
  }

  /**
   * Decode scan line from frequency stream (for RGB modes)
   */
  decodeScanLineFromFreqStream(freqStream, startPos, imageData, y, channel) {
    const samplesPerPixel = Math.floor((this.mode.scanTime * this.sampleRate) / this.mode.width);

    for (let x = 0; x < this.mode.width; x++) {
      const pos = startPos + x * samplesPerPixel;
      if (pos >= freqStream.length) break;

      // Average frequency over pixel duration
      let avgFreq = 0;
      const sampleCount = Math.min(samplesPerPixel, freqStream.length - pos);
      for (let i = 0; i < sampleCount; i++) {
        avgFreq += freqStream[pos + i];
      }
      avgFreq /= sampleCount;

      // Convert normalized frequency to actual Hz
      const freq = FREQ_CENTER + avgFreq * (FREQ_BANDWIDTH / 2);

      // Map frequency to pixel value
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

    if (this.useFMDemod) {
      return this.decodeImageWithFM(samples);
    }
    return this.decodeImage(samples);
  }
}
