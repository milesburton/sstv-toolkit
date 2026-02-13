import '@testing-library/jest-dom';

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
