// PD120 Decoder Methods - to be integrated into SSTVDecoder.js

/**
 * Decode a PD120 line pair: Y0, R-Y, B-Y, Y1
 * @param {Float32Array} samples - Audio samples
 * @param {number} startPos - Starting position in samples
 * @param {ImageData} imageData - Image data to write to
 * @param {Array} chromaU - B-Y chroma storage
 * @param {Array} chromaV - R-Y chroma storage
 * @param {number} y - Line number (even line of the pair)
 * @returns {number} - New position in samples
 */
function decodeScanLinePD(samples, startPos, imageData, chromaU, chromaV, y) {
  const COMPONENT_TIME = 0.1216; // 121.6ms per component
  const FREQ_BLACK = 1500;
  const FREQ_WHITE = 2300;
  const width = 640; // PD120 width
  const lines = 496; // PD120 lines
  const sampleRate = 48000;

  let position = startPos;
  const y1 = Math.min(y + 1, lines - 1);

  // Helper to detect frequency at current position
  const detectFreq = (pos, duration) => {
    return this.detectFrequencyRange(samples, pos, duration);
  };

  // Helper to advance position
  const advancePixel = () => {
    position += Math.floor((COMPONENT_TIME / width) * sampleRate);
  };

  // 1. Decode Y0 (first line luminance) - 640 pixels
  for (let x = 0; x < width; x++) {
    const freq = detectFreq(position, COMPONENT_TIME / width);
    const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
    let value = normalized * 255;
    value = Math.max(0, Math.min(255, Math.round(value)));

    const pixelIdx = (y * width + x) * 4;
    imageData.data[pixelIdx] = value;
    imageData.data[pixelIdx + 1] = value;
    imageData.data[pixelIdx + 2] = value;
    imageData.data[pixelIdx + 3] = 255;

    advancePixel();
  }

  // 2. Decode R-Y - 640 pixels
  for (let x = 0; x < width; x++) {
    const freq = detectFreq(position, COMPONENT_TIME / width);
    const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
    let value = normalized * 255;
    value = Math.max(0, Math.min(255, Math.round(value)));

    // Store R-Y for both lines in the pair
    chromaV[y * width + x] = value;
    chromaV[y1 * width + x] = value;

    advancePixel();
  }

  // 3. Decode B-Y - 640 pixels
  for (let x = 0; x < width; x++) {
    const freq = detectFreq(position, COMPONENT_TIME / width);
    const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
    let value = normalized * 255;
    value = Math.max(0, Math.min(255, Math.round(value)));

    // Store B-Y for both lines in the pair
    chromaU[y * width + x] = value;
    chromaU[y1 * width + x] = value;

    advancePixel();
  }

  // 4. Decode Y1 (second line luminance) - 640 pixels
  for (let x = 0; x < width; x++) {
    const freq = detectFreq(position, COMPONENT_TIME / width);
    const normalized = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
    let value = normalized * 255;
    value = Math.max(0, Math.min(255, Math.round(value)));

    const pixelIdx = (y1 * width + x) * 4;
    imageData.data[pixelIdx] = value;
    imageData.data[pixelIdx + 1] = value;
    imageData.data[pixelIdx + 2] = value;
    imageData.data[pixelIdx + 3] = 255;

    advancePixel();
  }

  return position;
}

/**
 * Convert PD format (Y, R-Y, B-Y) to RGB
 * @param {ImageData} imageData - Image data to update
 * @param {Array} chromaU - B-Y values
 * @param {Array} chromaV - R-Y values
 */
function convertPDtoRGB(imageData, chromaU, chromaV) {
  const width = 640;
  const lines = 496;

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

export { decodeScanLinePD, convertPDtoRGB };
