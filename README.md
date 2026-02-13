# SSTV Toolkit

A web-based SSTV (Slow Scan Television) encoder and decoder. Convert images to SSTV audio signals and decode SSTV transmissions directly in your browser - no installation required!

## 🌐 Use the Web App

**Try it now:** [https://milesburton.github.io/sstv-toolkit/](https://milesburton.github.io/sstv-toolkit/)

### Features
- ✅ Encode images into SSTV audio (WAV format)
- ✅ Decode SSTV audio back into images
- ✅ Support for Robot 36, Martin M1, and Scottie S1 modes
- ✅ Automatic mode detection via VIS code
- ✅ Drag & drop interface
- ✅ Built-in example images for testing
- ✅ Works entirely in your browser - no backend required
- ✅ Complete privacy - no data sent to servers

## 🎯 Quick Start

### Encoding (Image → Audio)
1. Visit [https://milesburton.github.io/sstv-toolkit/](https://milesburton.github.io/sstv-toolkit/)
2. Select your SSTV mode (Robot 36, Martin M1, or Scottie S1)
3. Drag & drop an image or click to select
4. Download the generated WAV audio file
5. Transmit via radio or save for later!

### Decoding (Audio → Image)
1. Upload your SSTV audio file (WAV, MP3, or OGG)
2. Mode is automatically detected from the VIS code
3. View and download the decoded image as PNG

## 📡 What is SSTV?

**Slow Scan Television (SSTV)** is a picture transmission method used mainly by amateur radio operators to transmit and receive static pictures via radio.

### How It Works
Each pixel is encoded as an audio frequency:
- **1200 Hz** = Sync pulse
- **1500 Hz** = Black level  
- **2300 Hz** = White level

Images are transmitted line-by-line as analog audio signals, which can be received and decoded back into pictures.

## 🎨 SSTV Modes

| Mode | Resolution | Scan Time | Color |
|------|-----------|-----------|-------|
| Robot 36 | 320x240 | ~36s | YUV |
| Martin M1 | 320x256 | ~114s | RGB |
| Scottie S1 | 320x256 | ~110s | RGB |

## 🛠️ Technology

- **React** - UI framework
- **Vite** - Build tool
- **Web Audio API** - Audio generation and processing
- **Canvas API** - Image manipulation
- **Pure Frontend** - No backend required, runs entirely in browser

## 💻 Development

```bash
# Clone the repository
git clone https://github.com/milesburton/sstv-toolkit.git
cd sstv-toolkit

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests (requires Node 20+)
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🧪 Testing

Comprehensive test suite with unit and integration tests for encoder/decoder validation.
See [TESTING.md](TESTING.md) for details.

**Note:** Tests require Node.js 20+ (Vitest requirement).

## 🚀 Deployment

This app is deployed to GitHub Pages using GitHub Actions. Every push to master automatically builds and deploys the latest version.

## 🌐 Browser Compatibility

Requires a modern browser with support for:
- Web Audio API
- Canvas API
- ES6+ JavaScript
- File API

Tested on: Chrome, Firefox, Safari, Edge

## 📝 Use Cases

- **Amateur Radio**: Transmit pictures over HF/VHF radio
- **Emergency Communications**: Send images when internet is unavailable
- **Education**: Learn about signal processing and radio transmission
- **Hobby**: Experiment with analog image transmission
- **ISS Contact**: Decode SSTV images from the International Space Station

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues and pull requests.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built with React and deployed on GitHub Pages.
