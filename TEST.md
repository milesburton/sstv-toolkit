# SSTV Toolkit Test Results

## Test Summary

### Automated Tests
- **Unit Tests (Vitest)**: 24 tests ✅ All passing
- **E2E Tests (Playwright)**: 5 tests ✅ All passing
- **Total Coverage**: 29 automated tests

### Test Architecture

This project uses a **dual testing strategy**:

1. **Unit Tests (Vitest + happy-dom)** - Fast, isolated component testing
2. **E2E Tests (Playwright)** - Real browser integration testing

#### ✅ Unit Tests (24 tests via `npm run spec:run`)

**SSTVDecoder Tests** (11 tests):
- VIS code detection and parsing
- Frequency detection (Goertzel algorithm)
- Sync pulse detection
- Mode auto-detection

**SSTVEncoder Tests** (8 tests):
- Mode initialization (Robot 36, Martin M1, Scottie S1)
- WAV header generation
- Tone generation (sync pulses, data tones)
- VIS code encoding
- Frequency mapping (black→1500Hz, white→2300Hz)

**Integration Tests** (5 tests):
- Frequency accuracy validation
- Mode compatibility checks
- Sync pulse generation

#### ✅ E2E Tests (5 tests via `npm run test:e2e`)

**Full Workflow Tests** (using Playwright with real Chromium browser):
1. **Complete encode→decode round trip** - Verifies image→audio→image workflow
2. **Robot 36 mode** - Tests encoding with default mode
3. **Martin M1 mode** - Tests encoding with Martin mode
4. **Scottie S1 mode** - Tests encoding with Scottie mode
5. **Drag and drop upload** - Tests file upload UI interaction

**Why Playwright?**
- Tests run in real browser with actual Canvas, Image, Blob, and File APIs
- More accurate representation of user experience
- Can verify visual output and UI interactions
- Industry standard for web application E2E testing

## Running Tests

### Run All Tests
```bash
npm run test:all        # Runs both unit and E2E tests
```

### Run Unit Tests Only
```bash
npm run spec:run        # Fast unit tests (~2s)
npm run spec            # Watch mode for development
```

### Run E2E Tests Only
```bash
npm run test:e2e        # Real browser tests (~20s)
npm run test:e2e:ui     # Interactive UI mode
```

## Manual Testing

### How to Test in Browser

1. **Development Server**:
   ```bash
   npm run dev
   ```
   Then visit http://localhost:5173/sstv-toolkit/

2. **Test the Full Workflow**:
   - **Encode**: Upload an image (JPG, PNG, etc.)
   - Select SSTV mode (Robot 36, Martin M1, or Scottie S1)
   - Download the generated WAV file
   - **Decode**: Upload the WAV file
   - Verify the decoded image matches the original

### Expected Results

✅ **Encoder**:
- Accepts image files
- Generates valid SSTV audio (WAV format)
- Audio playback shows characteristic SSTV tones
- File size ~50-200 KB depending on mode

✅ **Decoder**:
- Accepts SSTV audio files (WAV, MP3, OGG)
- Automatically detects SSTV mode via VIS code
- Produces visible decoded image (NOT black/transparent)
- Alpha channel properly initialized to 255

### Recent Fixes

1. **Alpha Channel Bug** (Fixed ✅):
   - **Problem**: Decoded images appeared completely black
   - **Cause**: Pixels not decoded remained at alpha=0 (transparent)
   - **Solution**: Initialize all pixels to alpha=255 before decoding
   - **Location**: `src/utils/SSTVDecoder.js` lines 88-95

2. **Side-by-Side UI** (Implemented ✅):
   - Both encoder and decoder visible simultaneously
   - No tab switching required
   - Responsive design (desktop: side-by-side, mobile: stacked)

## Test Verification Checklist

Use this checklist to verify the encode→decode workflow:

- [ ] Encode a simple test image (solid colors or patterns work best)
- [ ] Audio file is generated and can be played
- [ ] Audio contains SSTV tones (not silence)
- [ ] Decode the generated audio file
- [ ] Decoded image is visible (not black/blank)
- [ ] Decoded image resembles the original (accounting for SSTV quality loss)
- [ ] Test with all 3 modes: Robot 36, Martin M1, Scottie S1
- [ ] Test with different image sizes and types (JPG, PNG, etc.)

## Known Limitations

1. **Image Quality**: SSTV is a low-resolution format
   - Robot 36: 320×240 pixels
   - Martin M1 / Scottie S1: 320×256 pixels
   - Some quality loss is expected and normal

2. **Encoding Time**:
   - Robot 36: ~36 seconds of audio
   - Martin M1: ~114 seconds
   - Scottie S1: ~110 seconds

3. **Browser Compatibility**:
   - Requires modern browser with Web Audio API support
   - Canvas API required for image processing
   - Works best in Chrome, Firefox, Edge, Safari

## Success Criteria

The SSTV Toolkit is working correctly if:

1. ✅ All 24 unit tests pass (Vitest)
2. ✅ All 5 E2E tests pass (Playwright)
3. ✅ Can encode image → SSTV audio
4. ✅ Can decode SSTV audio → image
5. ✅ Decoded images are visible (not black)
6. ✅ Round-trip works: encode→decode→recognizable image
7. ✅ All 3 SSTV modes function correctly (Robot36, Martin1, Scottie1)
8. ✅ UI is responsive and user-friendly

---

**Last Updated**: February 13, 2026
**Test Frameworks**:
- Vitest 4.0.18 (unit tests)
- Playwright 1.58.2 (E2E tests)
**Build Status**: ✅ All 29 tests passing
**Deployment**: https://milesburton.github.io/sstv-toolkit/
