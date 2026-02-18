import { DecoderPanel } from './components/DecoderPanel.js';
import { EncoderPanel } from './components/EncoderPanel.js';
import { GalleryPanel } from './components/GalleryPanel.js';

export default function App() {
  return (
    <div className="w-full max-w-6xl mx-auto px-8 py-8">
      <header className="text-center text-white mb-8">
        <h1 className="text-5xl mb-2 drop-shadow">📡 SSTV Toolkit</h1>
        <p className="text-lg opacity-95">
          Encode images to SSTV audio and decode SSTV transmissions
        </p>
      </header>

      <main className="bg-white rounded-xl shadow-card p-8 mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <EncoderPanel />
        <DecoderPanel />
      </main>

      <GalleryPanel />

      <footer className="text-center text-white opacity-90 py-4">
        <p>
          <a
            href="https://github.com/milesburton/sstv-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white no-underline font-semibold hover:underline"
          >
            View on GitHub
          </a>
          {' • '}
          <span className="opacity-80 text-sm">v{__APP_VERSION__}</span>
          {' • '}
          <span className="opacity-80 text-sm">Build {__BUILD_DATE__}</span>
        </p>
      </footer>
    </div>
  );
}
