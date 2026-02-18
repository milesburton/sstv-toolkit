# SSTV Toolkit

Web-based SSTV encoder/decoder. Converts images to SSTV audio and decodes SSTV transmissions in-browser.

**Live App:** https://milesburton.github.io/sstv-toolkit/

## Features

- Encode images to SSTV audio (WAV)
- Decode SSTV audio to images (PNG)
- **✨ AI-powered image enhancement** for decoded images (noise reduction, sharpening, upscaling)
- Supports Robot 36, Martin M1, Scottie S1, PD120
- Automatic VIS code detection with timing-based fallback for non-standard headers (ISS)
- Frequency offset auto-calibration for Doppler-shifted signals
- Client-side only — no server required

## Usage

### Encode
1. Select SSTV mode
2. Upload image
3. Download WAV file

### Decode
1. Upload SSTV audio (WAV/MP3/OGG)
2. Mode auto-detected from VIS code
3. Download decoded PNG
4. **Optional:** Click "✨ Enhance with AI" to improve image quality

### AI Enhancement
After decoding an SSTV transmission, you can enhance the image quality using Cloudinary's AI transformation APIs:

- **Noise reduction (65%)** - Reduces transmission noise and artifacts
- **Sharpening (85%)** - Improves image clarity
- **Auto contrast & color correction** - Optimizes brightness and colors
- **2x upscaling** - Increases resolution (e.g., 320×240 → 640×480)
- **Auto format optimization** - Serves WebP for modern browsers

Enhanced images include a watermark ("SSTV Toolkit Demo") to prevent misuse and support community moderation via the "Report" button.

## SSTV Modes

| Mode | Resolution | Scan time | Colour |
|------|-----------|-----------|--------|
| Robot 36 | 320×240 | 36s | YUV |
| Martin M1 | 320×256 | 114s | RGB |
| Scottie S1 | 320×256 | 110s | RGB |
| PD120 | 640×496 | 122s | YUV |

## Cloudinary Setup (for AI Enhancement)

To enable AI-powered image enhancement, you need a Cloudinary account (free tier available):

### 1. Create a Cloudinary Account
1. Sign up at https://cloudinary.com
2. Note your **Cloud Name** from the dashboard

### 2. Create an Unsigned Upload Preset
1. Go to Settings → Upload
2. Scroll to "Upload presets"
3. Click "Add upload preset"
4. Set **Signing Mode** to "Unsigned"
5. Set **Folder** to `sstv-decoded`
6. Set **Tags** to `sstv,temporary`
7. Save and note the **preset name**

### 3. Configure Environment Variables
Create a `.env` file in the project root:

```bash
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here
```

See `.env.example` for reference.

### Security Considerations

**Unsigned uploads** are used to avoid exposing API secrets in the frontend. Security measures:

- **Client-side validation** - Rejects images > 1000px or with unusual aspect ratios
- **Watermarking** - All enhanced images include "SSTV Toolkit Demo" watermark
- **Community moderation** - "Report" button creates GitHub issues for inappropriate content
- **Free tier limits** - Cloudinary free tier: 25 GB storage, 25 GB bandwidth/month
- **Folder isolation** - All uploads go to `sstv-decoded` folder with `temporary` tag for easy cleanup

### Cost Estimates

**Cloudinary Free Tier:**
- 25 GB storage
- 25 GB bandwidth/month
- 25k transformations/month

**Typical usage:**
- 1 SSTV image (~50 KB) + enhancement (~100 KB) = 150 KB per use
- Free tier supports ~170 enhanced images per day
- Automatic cleanup recommended via Cloudinary's Upload API or Admin API

## Development

```bash
npm install
npm run dev        # Development server
npm test          # Run unit tests (requires Node 20+)
npm run test:e2e  # Run E2E tests
npm run build     # Production build
```

## Troubleshooting

### Enhancement Feature

**"Cloudinary configuration missing" error:**
- Ensure `.env` file exists with valid credentials
- Restart dev server after creating/modifying `.env`
- Check that environment variables start with `VITE_`

**Enhancement fails with 400 error:**
- Verify upload preset is set to "Unsigned" mode
- Check that preset folder is `sstv-decoded`
- Confirm Cloud Name is correct (case-sensitive)

**"Image too large" validation error:**
- SSTV images are typically 320×240 to 640×496
- Enhancement only supports images ≤ 1000px
- This prevents abuse and ensures free tier limits

**Enhancement seems slow:**
- Initial upload typically takes 1-2 seconds
- Cloudinary transformation happens server-side (instant)
- Enhanced image loads from CDN (fast)

## Requirements

- Modern browser with Web Audio API and Canvas API support
- Node.js 20+ for development/testing
- Cloudinary account (free tier) for AI enhancement feature (optional)

## License

MIT
