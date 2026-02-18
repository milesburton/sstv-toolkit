import { useState } from 'react';
import { SSTV_MODES, SSTVEncoder } from '../utils/SSTVEncoder.js';
import { DropZone } from './DropZone.js';

interface EncodeResult {
  url: string;
  filename: string;
  mode: string;
  width: number;
  lines: number;
  colorFormat: string;
  expectedDuration: string;
  fileSize: string;
}

const ImageIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
  >
    <title>Image file</title>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export function EncoderPanel() {
  const [selectedMode, setSelectedMode] = useState('ROBOT36');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<EncodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    setProcessing(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const encoder = new SSTVEncoder(selectedMode);
      const blob = await encoder.encodeImage(file);
      const mode = SSTV_MODES[selectedMode];
      if (!mode) throw new Error(`Unknown mode: ${selectedMode}`);
      setResult({
        url: URL.createObjectURL(blob),
        filename: `sstv_${selectedMode.toLowerCase()}_${Date.now()}.wav`,
        mode: mode.name,
        width: mode.width,
        lines: mode.lines,
        colorFormat: mode.colorFormat,
        expectedDuration: `${(mode.lines * (mode.syncPulse + mode.syncPorch + (mode.scanTime || 0))).toFixed(1)}s`,
        fileSize: `${(blob.size / 1024).toFixed(0)} KB`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encoding failed');
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    a.click();
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setPreview(null);
  };

  return (
    <div className="bg-transparent">
      <div className="text-center mb-6 pb-5 border-b border-white/10">
        <h2 className="text-white text-xl font-semibold mb-1 tracking-wide">Encoder</h2>
        <p className="text-white/40 text-xs uppercase tracking-widest">Image → SSTV Audio</p>
      </div>

      <div className="mb-5 flex items-center justify-center gap-3 text-sm">
        <label
          className="text-white/50 text-xs uppercase tracking-wider font-medium"
          htmlFor="mode-select"
        >
          SSTV Mode
        </label>
        <select
          id="mode-select"
          value={selectedMode}
          onChange={(e) => setSelectedMode(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white/[0.06] border border-white/15 text-white/80 rounded-lg cursor-pointer focus:outline-none focus:border-primary transition-colors"
        >
          {Object.entries(SSTV_MODES).map(([key, mode]) => (
            <option key={key} value={key}>
              {mode.name} ({mode.width}×{mode.lines})
            </option>
          ))}
        </select>
      </div>

      <DropZone
        accept="image/*"
        onFile={handleFile}
        processing={processing}
        icon={<ImageIcon />}
        hint="JPG, PNG, GIF, WebP"
        inputId="encode-input"
      />

      {preview && !result && (
        <div className="my-4 text-center">
          <img src={preview} alt="Preview" className="max-w-full max-h-48 rounded-lg opacity-90" />
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3 my-4 text-red-400 text-center text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 mt-4">
          <h3 className="text-emerald-400 mb-4 text-sm font-semibold text-center uppercase tracking-wider">
            Encoded successfully
          </h3>
          <audio controls src={result.url} className="w-full mb-4 opacity-80" />
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={download}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 hover:-translate-y-0.5 transition-all"
            >
              Download WAV
            </button>
            <button
              onClick={reset}
              className="px-5 py-2 text-sm font-semibold bg-white/10 text-white/70 rounded-lg hover:bg-white/15 transition-all"
            >
              Encode Another
            </button>
          </div>
          <div className="mt-4 border border-white/10 rounded-lg overflow-hidden text-xs">
            <div className="px-3 py-2 bg-white/[0.04] text-white/40 text-xs font-semibold uppercase tracking-wider">
              Encode Info
            </div>
            <div className="p-3 diag-grid text-xs">
              <span className="text-white/35">Mode</span>
              <span className="font-mono text-white/70">{result.mode}</span>
              <span className="text-white/35">Resolution</span>
              <span className="font-mono text-white/70">
                {result.width}×{result.lines}
              </span>
              <span className="text-white/35">Color</span>
              <span className="font-mono text-white/70">{result.colorFormat}</span>
              <span className="text-white/35">Duration</span>
              <span className="font-mono text-white/70">{result.expectedDuration}</span>
              <span className="text-white/35">File size</span>
              <span className="font-mono text-white/70">{result.fileSize}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
