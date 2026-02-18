import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodeResult } from '../types.js';
import { SSTVDecoder } from '../utils/SSTVDecoder.js';
import { DiagnosticsPanel } from './DiagnosticsPanel.js';
import { DropZone } from './DropZone.js';
import { QualityBadge } from './QualityBadge.js';

interface DecodeState {
  url: string;
  filename: string;
  diagnostics: DecodeResult['diagnostics'];
}

interface Props {
  triggerUrl?: string | null;
  onTriggerConsumed?: () => void;
}

const AudioIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
  >
    <title>Audio file</title>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export function DecoderPanel({ triggerUrl, onTriggerConsumed }: Props) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DecodeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const decodeUrl = useCallback(
    async (url: string) => {
      setProcessing(true);
      setError(null);
      setResult(null);
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], url.split('/').pop() ?? 'audio', { type: blob.type });
        const decoder = new SSTVDecoder();
        const decoded = await decoder.decodeAudio(file);
        setResult({
          url: decoded.imageUrl,
          filename: `sstv_decoded_${Date.now()}.png`,
          diagnostics: decoded.diagnostics,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Decoding failed');
      } finally {
        setProcessing(false);
        onTriggerConsumed?.();
      }
    },
    [onTriggerConsumed]
  );

  useEffect(() => {
    if (!triggerUrl) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    decodeUrl(triggerUrl);
  }, [triggerUrl, decodeUrl]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (WAV, MP3, etc.)');
      return;
    }
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const decoder = new SSTVDecoder();
      const decoded = await decoder.decodeAudio(file);
      setResult({
        url: decoded.imageUrl,
        filename: `sstv_decoded_${Date.now()}.png`,
        diagnostics: decoded.diagnostics,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decoding failed');
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
  };

  const verdict = result?.diagnostics?.quality?.verdict;

  return (
    <div ref={panelRef} className="bg-transparent">
      <div className="text-center mb-6 pb-5 border-b border-white/10">
        <h2 className="text-white text-xl font-semibold mb-1 tracking-wide">Decoder</h2>
        <p className="text-white/40 text-xs uppercase tracking-widest">SSTV Audio → Image</p>
      </div>

      <div className="mb-5 text-center">
        <p className="text-white/40 text-xs uppercase tracking-wider font-medium">
          Automatic mode detection via VIS code
        </p>
      </div>

      <DropZone
        accept="audio/*"
        onFile={handleFile}
        processing={processing}
        icon={<AudioIcon />}
        hint="WAV, MP3, OGG"
        inputId="decode-input"
      >
        <div className="mt-3 flex flex-col items-center gap-1">
          <p className="text-xs text-white/30">Try an example:</p>
          <a
            href="examples/iss-test.wav"
            download
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            ISS Robot 36 (.wav)
          </a>
          <a
            href="examples/Space_Comms_PD120_SSTV_Test_Recording.mp3"
            download
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            ISS PD120 (.mp3)
          </a>
          <a
            href="examples/test-colorbars.wav"
            download
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            Colour bars (.wav)
          </a>
        </div>
      </DropZone>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3 my-4 text-red-400 text-center text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 mt-4">
          <h3 className="mb-4 text-sm font-semibold text-center uppercase tracking-wider">
            <span className={verdict === 'bad' ? 'text-red-400' : 'text-emerald-400'}>
              {verdict === 'bad' ? 'Decoded (quality issues)' : 'Decoded successfully'}
            </span>
            <QualityBadge verdict={verdict} />
          </h3>
          <img
            src={result.url}
            alt="Decoded SSTV"
            className="max-w-full h-auto rounded-lg block mx-auto mb-4 opacity-95"
          />
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={download}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 hover:-translate-y-0.5 transition-all"
            >
              Download PNG
            </button>
            <button
              onClick={reset}
              className="px-5 py-2 text-sm font-semibold bg-white/10 text-white/70 rounded-lg hover:bg-white/15 transition-all"
            >
              Decode Another
            </button>
          </div>
          {result.diagnostics && <DiagnosticsPanel diagnostics={result.diagnostics} />}
        </div>
      )}
    </div>
  );
}
