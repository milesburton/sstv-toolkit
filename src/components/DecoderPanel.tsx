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
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
        <h2 className="text-primary text-2xl font-semibold mb-2">📻 Decoder</h2>
        <p className="text-gray-500 text-sm">SSTV Audio → Image</p>
      </div>

      <div className="mb-6 text-center">
        <p className="text-primary font-medium text-sm">🔍 Automatic mode detection via VIS code</p>
      </div>

      <DropZone
        accept="audio/*"
        onFile={handleFile}
        processing={processing}
        icon="🎵"
        hint="WAV, MP3, OGG"
        inputId="decode-input"
      >
        <div className="mt-3 flex flex-col items-center gap-1">
          <p className="text-xs text-gray-400">Try an example:</p>
          <a href="examples/iss-test.wav" download className="text-xs text-primary hover:underline">
            ISS Robot 36 (.wav)
          </a>
          <a
            href="examples/Space_Comms_PD120_SSTV_Test_Recording.mp3"
            download
            className="text-xs text-primary hover:underline"
          >
            ISS PD120 (.mp3)
          </a>
          <a
            href="examples/test-colorbars.wav"
            download
            className="text-xs text-primary hover:underline"
          >
            Colour bars (.wav)
          </a>
        </div>
      </DropZone>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 my-4 text-red-600 text-center text-sm">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-50 rounded-lg p-6 mt-4">
          <h3 className="mb-4 text-lg font-semibold text-center">
            {verdict === 'bad'
              ? '⚠️ Decoded (quality issues)'
              : verdict === 'warn'
                ? '⚠️ Decoded Successfully'
                : '✅ Decoded Successfully'}
            <QualityBadge verdict={verdict} />
          </h3>
          <img
            src={result.url}
            alt="Decoded SSTV"
            className="max-w-full h-auto rounded-lg shadow-sm block mx-auto mb-4"
          />
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={download}
              className="px-5 py-2 text-sm font-semibold bg-green-500 text-white rounded-md hover:bg-green-600 hover:-translate-y-0.5 transition-all"
            >
              💾 Download PNG
            </button>
            <button
              onClick={reset}
              className="px-5 py-2 text-sm font-semibold bg-gray-500 text-white rounded-md hover:bg-gray-600 hover:-translate-y-0.5 transition-all"
            >
              🔄 Decode Another
            </button>
          </div>
          {result.diagnostics && <DiagnosticsPanel diagnostics={result.diagnostics} />}
        </div>
      )}
    </div>
  );
}
