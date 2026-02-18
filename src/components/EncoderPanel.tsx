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
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
        <h2 className="text-primary text-2xl font-semibold mb-2">🖼️ Encoder</h2>
        <p className="text-gray-500 text-sm">Image → SSTV Audio</p>
      </div>

      <div className="mb-6 text-center">
        <label className="flex items-center justify-center gap-3 text-sm text-gray-700 font-semibold">
          SSTV Mode:
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className="px-4 py-2 text-sm border-2 border-gray-200 bg-white text-gray-700 rounded-md cursor-pointer focus:outline-none focus:border-primary"
          >
            {Object.entries(SSTV_MODES).map(([key, mode]) => (
              <option key={key} value={key}>
                {mode.name} ({mode.width}×{mode.lines})
              </option>
            ))}
          </select>
        </label>
      </div>

      <DropZone
        accept="image/*"
        onFile={handleFile}
        processing={processing}
        icon="🖼️"
        hint="JPG, PNG, GIF, WebP"
        inputId="encode-input"
      />

      {preview && !result && (
        <div className="my-4 text-center">
          <img src={preview} alt="Preview" className="max-w-full max-h-48 rounded-lg shadow-sm" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 my-4 text-red-600 text-center text-sm">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-50 rounded-lg p-6 mt-4">
          <h3 className="text-green-700 mb-4 text-lg font-semibold text-center">
            ✅ Encoded Successfully
          </h3>
          <audio controls src={result.url} className="w-full mb-4" />
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={download}
              className="px-5 py-2 text-sm font-semibold bg-green-500 text-white rounded-md hover:bg-green-600 hover:-translate-y-0.5 transition-all"
            >
              💾 Download WAV
            </button>
            <button
              onClick={reset}
              className="px-5 py-2 text-sm font-semibold bg-gray-500 text-white rounded-md hover:bg-gray-600 hover:-translate-y-0.5 transition-all"
            >
              🔄 Encode Another
            </button>
          </div>
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden text-xs bg-gray-50">
            <div className="w-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
              🔬 Encode Info
            </div>
            <div className="p-3 diag-grid">
              <span className="text-gray-400">Mode</span>
              <span className="font-mono text-gray-800">{result.mode}</span>
              <span className="text-gray-400">Resolution</span>
              <span className="font-mono text-gray-800">
                {result.width}×{result.lines}
              </span>
              <span className="text-gray-400">Color</span>
              <span className="font-mono text-gray-800">{result.colorFormat}</span>
              <span className="text-gray-400">Duration</span>
              <span className="font-mono text-gray-800">{result.expectedDuration}</span>
              <span className="text-gray-400">File size</span>
              <span className="font-mono text-gray-800">{result.fileSize}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
