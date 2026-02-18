import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createCanvas } from 'canvas';

const EXAMPLES = [
  { name: 'ISS Robot 36', file: 'iss-test.wav' },
  { name: 'ISS PD120', file: 'Space_Comms_PD120_SSTV_Test_Recording.mp3' },
  { name: 'Colour bars', file: 'test-colorbars.wav' },
];

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
    return Promise.resolve({ sampleRate: this.sampleRate, getChannelData: () => samples });
  }
  close() {
    return Promise.resolve();
  }
}

global.window = { AudioContext: MockAudioContext };
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(640, 496);
    return {};
  },
};

const { SSTVDecoder } = await import('./src/utils/SSTVDecoder.js');

mkdirSync('./public/gallery', { recursive: true });

const manifest = [];

for (const example of EXAMPLES) {
  const inputPath = `public/examples/${example.file}`;
  console.log(`Decoding ${example.file}...`);

  try {
    const wavBuffer = readFileSync(inputPath);
    const blob = {
      arrayBuffer: () =>
        Promise.resolve(
          wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength)
        ),
    };

    const decoder = new SSTVDecoder(48000);
    const result = await decoder.decodeAudio(blob);

    const slug = example.file
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .replace(/\.(wav|mp3)$/, '');
    const imagePath = `gallery/${slug}.png`;

    const base64 = result.imageUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`public/${imagePath}`, Buffer.from(base64, 'base64'));

    manifest.push({
      name: example.name,
      audioFile: `examples/${example.file}`,
      imageFile: imagePath,
      mode: result.diagnostics.mode,
      quality: result.diagnostics.quality.verdict,
    });

    console.log(
      `  ✓ ${example.name} → ${imagePath} (${result.diagnostics.mode}, ${result.diagnostics.quality.verdict})`
    );
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}

writeFileSync('public/gallery/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nGallery generated: ${manifest.length} entries`);
