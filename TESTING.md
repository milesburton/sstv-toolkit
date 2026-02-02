# SSTV Webapp Testing

This project includes comprehensive unit and integration tests to prevent regressions in the SSTV encoder and decoder.

## Test Coverage

### Unit Tests

**SSTVEncoder Tests** (`src/utils/SSTVEncoder.test.js`)
- Initialization and mode selection
- WAV audio generation
- Tone generation (sine waves at specific frequencies)
- VIS code generation
- Image encoding
- Frequency mapping (pixel values → Hz)

**SSTVDecoder Tests** (`src/utils/SSTVDecoder.test.js`)
- Goertzel algorithm for frequency detection
- Pure tone detection at 1200 Hz, 1500 Hz, 2300 Hz
- Frequency rejection (filtering out incorrect frequencies)
- Intermediate frequency detection
- VIS code detection
- Frequency to pixel mapping

### Integration Tests

**Round-trip Tests** (`src/utils/SSTVIntegration.test.js`)
- Encode → Decode full cycle
- High contrast pattern preservation
- Sync pulse accuracy (1200 Hz)
- Data tone range validation (1500-2300 Hz)
- Mode compatibility (Robot 36, Martin M1, Scottie S1)

## Running Tests

### Prerequisites

**Note:** Tests require Node.js 20+ due to Vitest and testing library requirements.
Current system has Node.js 18.18.2, so tests will need to be run in CI/CD or on a machine with Node 20+.

### Commands

```bash
# Run tests once
npm run test:run

# Run tests in watch mode (interactive)
npm test

# Run tests with UI
npm run test:ui
```

## Test Structure

Tests validate:
1. **Frequency Accuracy** - Encoder generates correct frequencies for each pixel value
2. **Goertzel Algorithm** - Decoder accurately detects frequencies using DFT
3. **Round-trip Fidelity** - Encoded images can be successfully decoded
4. **Sync Detection** - Proper timing and synchronization
5. **Mode Support** - All SSTV modes work correctly

## Why Tests Matter

The encoder and decoder must work in perfect harmony. Tests prevent:
- ❌ Frequency mapping regressions (black output bug)
- ❌ Sync pulse detection failures
- ❌ Mode incompatibilities
- ❌ Goertzel algorithm accuracy issues

## Continuous Integration

Tests should be run before each deployment to ensure encoder/decoder compatibility.

## Known Limitations

- Tests require Node 20+ (Vitest requirement)
- Integration tests may take longer due to audio processing
- Happy-dom used instead of JSDOM for lighter weight
