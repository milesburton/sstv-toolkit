# SSTV Decoding Diagnostic Guide

## Current Status
✅ **Fix deployed**: Video range chrominance mapping (commit 1de2149)
✅ **Tests passing**: All 30 unit tests pass
✅ **GitHub Pages**: Deployment successful (05a6c5b)

## If you're still seeing a green image:

### 1. Clear Browser Cache
The old JavaScript may be cached. Try:
- **Hard Refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- **Clear Cache**: Browser Settings → Clear Browsing Data → Cached Images and Files
- **Incognito Mode**: Open https://milesburton.github.io/sstv-toolkit/ in incognito/private window

### 2. Verify Deployment
Check the deployed version:
- Open browser DevTools (F12)
- Go to Network tab
- Reload the page
- Find `index-*.js` file
- Check the Date/Time it was loaded

Expected latest: `index-Dp7T3uhm.js` from Feb 13, 2026 20:28 UTC

### 3. Test with Known Good Image
Use the test pattern I created:
1. Open `test-pattern.png` (red/green/blue sections)
2. Encode it via the web UI
3. Download the WAV
4. Decode the WAV
5. **Expected**: Should show red, green, blue sections
6. **If broken**: Will show mostly green or wrong colors

### 4. Check Browser Console
Open DevTools Console and look for:
- JavaScript errors (red text)
- Warning messages (yellow text)
- SSTV decoder logs (should show VIS code detection)

### 5. Verify Audio File
The issue might be with the audio file itself:
- Make sure it's a valid SSTV transmission
- Check it has a VIS code (Robot36 = 8)
- Try encoding a simple test image first

## Understanding the Green Issue

**Why green?** When chrominance values are misread:
- Cb (blue-yellow) and Cr (red-cyan) get wrong values
- RGB conversion formula becomes unbalanced
- Green channel dominates, causing green tint

**The fix ensures**:
- Encoder sends: 16-240 range → frequency
- Decoder reads: frequency → 16-240 range (matching!)
- Neutral gray (RGB 128,128,128) → Cb=128, Cr=128 (no color shift)

## Still Having Issues?

If the problem persists after clearing cache:

1. **Check what you're decoding**: Is it an audio file you encoded yourself, or from another source?
2. **Verify encode works**: Can you successfully encode a simple image?
3. **Browser version**: What browser and version are you using?
4. **Share details**:
   - Screenshot of browser console
   - What file are you trying to decode?
   - What do you see in the output?

## Quick Test Commands

```bash
# Rebuild locally to test
npm run build
npm run preview

# Run tests to verify fix
npm test

# Create test pattern
node test-roundtrip.js
```

## Expected Behavior (After Fix)

✅ Encode RGB test pattern → Decode → See RGB colors (not green)
✅ Encode white image → Decode → See white/light gray (not green)
✅ Encode colored image → Decode → See similar colors (not all green)
