import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodeState } from '../types.js';
import { SSTVDecoder } from '../utils/SSTVDecoder.js';
import { DropZone } from './DropZone.js';

interface Props {
  triggerUrl?: string | null;
  onTriggerConsumed?: () => void;
  onResult: (result: DecodeState) => void;
  onError: (msg: string) => void;
  onReset: () => void;
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

export function DecoderPanel({ triggerUrl, onTriggerConsumed, onResult, onError, onReset }: Props) {
  const [processing, setProcessing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const runDecode = useCallback(
    async (file: File) => {
      setProcessing(true);
      onReset();
      try {
        const decoder = new SSTVDecoder();
        const decoded = await decoder.decodeAudio(file);
        onResult({
          url: decoded.imageUrl,
          filename: `sstv_decoded_${Date.now()}.png`,
          diagnostics: decoded.diagnostics,
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Decoding failed');
      } finally {
        setProcessing(false);
      }
    },
    [onResult, onError, onReset]
  );

  const decodeUrl = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], url.split('/').pop() ?? 'audio', { type: blob.type });
        await runDecode(file);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Decoding failed');
        setProcessing(false);
      } finally {
        onTriggerConsumed?.();
      }
    },
    [runDecode, onError, onTriggerConsumed]
  );

  useEffect(() => {
    if (!triggerUrl) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    decodeUrl(triggerUrl);
  }, [triggerUrl, decodeUrl]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('audio/')) {
      onError('Please select an audio file (WAV, MP3, etc.)');
      return;
    }
    runDecode(file);
  };

  return (
    <div ref={panelRef} className="bg-transparent">
      <div className="text-center mb-6 pb-5 border-b border-white/10">
        <h2 className="text-white text-xl font-semibold mb-1 tracking-wide">Decoder</h2>
        <p className="text-white/40 text-xs uppercase tracking-widest">SSTV Audio → Image</p>
      </div>

      <div className="mb-5 h-9 flex items-center justify-center gap-3 text-sm">
        <p className="text-white/50 text-xs uppercase tracking-wider font-medium">
          Automatic mode detection via VIS code
        </p>
      </div>

      <DropZone
        accept="audio/*"
        onFile={handleFile}
        processing={processing}
        icon={<AudioIcon />}
        hint=""
        inputId="decode-input"
      />
    </div>
  );
}
