import { type DragEvent, type ReactNode, useRef, useState } from 'react';

interface Props {
  accept: string;
  onFile: (file: File) => void;
  processing: boolean;
  icon: string;
  hint: string;
  inputId: string;
  children?: ReactNode;
}

export function DropZone({ accept, onFile, processing, icon, hint, inputId, children }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <section
      className={`border-3 border-dashed rounded-xl p-8 transition-all bg-gray-50 mb-4 ${dragActive ? 'border-primary bg-primary-bg scale-102' : 'border-gray-300'} ${processing ? 'opacity-60 pointer-events-none' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        id={inputId}
        accept={accept}
        onChange={handleSelect}
        disabled={processing}
        className="hidden"
      />
      <label htmlFor={inputId} className="cursor-pointer block text-center">
        {processing ? (
          <>
            <div className="spinner" />
            <p className="text-gray-500 text-sm">Processing...</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">{icon}</div>
            <p className="text-gray-500 text-sm mb-2">Drag & drop or</p>
            <button
              type="button"
              className="px-6 py-3 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-dark hover:-translate-y-0.5 transition-all my-3"
              onClick={(e) => {
                e.preventDefault();
                inputRef.current?.click();
              }}
            >
              Choose File
            </button>
            <p className="text-gray-400 text-xs">{hint}</p>
            {children}
          </>
        )}
      </label>
    </section>
  );
}
