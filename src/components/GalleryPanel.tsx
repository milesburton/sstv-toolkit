import { useEffect, useState } from 'react';
import type { GalleryEntry } from '../types.js';

interface Props {
  onTryDecode?: (audioUrl: string) => void;
}

export function GalleryPanel({ onTryDecode }: Props) {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);

  useEffect(() => {
    fetch('gallery/manifest.json')
      .then((r) => r.json())
      .then((data: GalleryEntry[]) => setEntries(data))
      .catch(() => setEntries([]));
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="bg-white rounded-xl shadow-card p-8 mb-8">
      <h3 className="text-primary text-xl font-semibold mb-6">📡 Example Transmissions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.map((entry) => (
          <div key={entry.name} className="border border-gray-200 rounded-xl overflow-hidden">
            <img src={entry.imageFile} alt={entry.name} className="w-full h-40 object-cover" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-800">{entry.name}</span>
                <span
                  className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full quality-${entry.quality}`}
                >
                  {entry.mode}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <a
                  href={entry.audioFile}
                  download
                  className="flex-1 text-center px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                >
                  ⬇ Download
                </a>
                {onTryDecode && (
                  <button
                    onClick={() => onTryDecode(entry.audioFile)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold border border-primary text-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                  >
                    Try decoding
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
