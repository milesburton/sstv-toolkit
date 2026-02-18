import { useState } from 'react';
import type { DecodeDiagnostics } from '../types.js';
import { QualityBadge } from './QualityBadge.js';

interface Props {
  diagnostics: DecodeDiagnostics;
}

export function DiagnosticsPanel({ diagnostics }: Props) {
  const [open, setOpen] = useState(true);
  const {
    mode,
    visCode,
    sampleRate,
    fileDuration,
    freqOffset,
    autoCalibrate,
    visEndPos,
    decodeTimeMs,
    quality,
  } = diagnostics;

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden text-xs bg-gray-50">
      <button
        className="w-full bg-gray-100 hover:bg-gray-200 border-none px-3 py-2 text-left text-xs font-semibold text-gray-600 flex justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        🔬 Diagnostics {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="p-3">
          <div className="diag-grid">
            <span className="text-gray-400 font-medium">Mode</span>
            <span className="font-mono text-gray-800 break-all">{mode ?? '—'}</span>

            <span className="text-gray-400 font-medium">VIS code</span>
            <span className="font-mono text-gray-800">
              {visCode != null
                ? `0x${visCode.toString(16).toUpperCase().padStart(2, '0')} (${visCode})`
                : '—'}
            </span>

            <span className="text-gray-400 font-medium">Sample rate</span>
            <span className="font-mono text-gray-800">{sampleRate ? `${sampleRate} Hz` : '—'}</span>

            <span className="text-gray-400 font-medium">File duration</span>
            <span className="font-mono text-gray-800">{fileDuration ?? '—'}</span>

            <span className="text-gray-400 font-medium">Freq offset</span>
            <span
              className={`font-mono ${Math.abs(freqOffset) > 50 ? 'text-orange-600 font-semibold' : 'text-gray-800'}`}
            >
              {freqOffset != null ? `${freqOffset > 0 ? '+' : ''}${freqOffset} Hz` : '—'}
            </span>

            <span className="text-gray-400 font-medium">Auto-calibrate</span>
            <span className="font-mono text-gray-800">{autoCalibrate ? 'on' : 'off'}</span>

            <span className="text-gray-400 font-medium">VIS end pos</span>
            <span className="font-mono text-gray-800">
              {visEndPos != null ? `${visEndPos} samples` : '—'}
            </span>

            <span className="text-gray-400 font-medium">Decode time</span>
            <span className="font-mono text-gray-800">
              {decodeTimeMs != null ? `${decodeTimeMs} ms` : '—'}
            </span>
          </div>

          {quality && (
            <>
              <div className="font-semibold text-gray-600 mt-2 mb-1 text-xs uppercase tracking-wide">
                Image Quality
              </div>
              <div className="diag-grid">
                <span className="text-gray-400 font-medium">Avg R/G/B</span>
                <span className="font-mono flex gap-2 items-center">
                  <span style={{ color: '#ff6b6b' }}>R:{quality.rAvg}</span>
                  <span style={{ color: '#51cf66' }}>G:{quality.gAvg}</span>
                  <span style={{ color: '#74c0fc' }}>B:{quality.bAvg}</span>
                </span>
                <span className="text-gray-400 font-medium">Brightness</span>
                <span className="font-mono text-gray-800">{quality.brightness}</span>
                <span className="text-gray-400 font-medium">Verdict</span>
                <span className="font-mono">
                  <QualityBadge verdict={quality.verdict} />
                </span>
              </div>
              {quality.warnings.length > 0 && (
                <ul className="mt-2 p-2 bg-yellow-50 rounded list-none">
                  {quality.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-yellow-800 leading-relaxed">
                      ⚠️ {w}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
