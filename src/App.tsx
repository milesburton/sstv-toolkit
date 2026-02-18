import { useEffect, useState } from 'react';
import { DecoderPanel } from './components/DecoderPanel.js';
import { EncoderPanel } from './components/EncoderPanel.js';
import { GalleryPanel } from './components/GalleryPanel.js';

function useStarfield() {
  useEffect(() => {
    const canvas = document.getElementById('stars-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    type Star = { x: number; y: number; r: number; depth: number; opacity: number };
    let stars: Star[] = [];
    let animId: number;
    let scrollY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 220 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        depth: Math.random() * 0.8 + 0.2,
        opacity: Math.random() * 0.6 + 0.2,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const parallax = scrollY * s.depth * 0.08;
        const y = (((s.y - parallax) % canvas.height) + canvas.height) % canvas.height;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 215, 255, ${s.opacity})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    const onScroll = () => {
      scrollY = window.scrollY;
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
}

export default function App() {
  const [decodeUrl, setDecodeUrl] = useState<string | null>(null);
  useStarfield();

  return (
    <>
      <canvas id="stars-canvas" />
      <div className="w-full max-w-6xl mx-auto px-6 py-10">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 tracking-tight text-white drop-shadow-lg">
            SSTV Toolkit
          </h1>
          <p className="text-sm text-white/50 tracking-widest uppercase font-medium">
            Slow-Scan Television &mdash; Encode &amp; Decode in your browser
          </p>
        </header>

        <main className="glass rounded-2xl p-8 mb-6 grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="pr-0 lg:pr-8 lg:border-r border-white/10">
            <EncoderPanel />
          </div>
          <div className="pl-0 lg:pl-8 pt-8 lg:pt-0">
            <DecoderPanel triggerUrl={decodeUrl} onTriggerConsumed={() => setDecodeUrl(null)} />
          </div>
        </main>

        <GalleryPanel onTryDecode={setDecodeUrl} />

        <footer className="text-center text-white/40 py-6 text-sm">
          <a
            href="https://github.com/milesburton/sstv-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors font-medium"
          >
            View on GitHub
          </a>
          {' · '}
          <span>v{__APP_VERSION__}</span>
          {' · '}
          <span>Build {__BUILD_DATE__}</span>
        </footer>
      </div>
    </>
  );
}
