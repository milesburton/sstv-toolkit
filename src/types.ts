export interface SSTVMode {
  name: string;
  visCode: number;
  scanTime: number;
  lines: number;
  width: number;
  colorScan: boolean;
  syncPulse: number;
  syncPorch: number;
  separatorPulse?: number;
  componentTime?: number;
  colorFormat: 'YUV' | 'RGB' | 'PD';
}

export interface ImageQuality {
  rAvg: number;
  gAvg: number;
  bAvg: number;
  brightness: number;
  verdict: 'good' | 'warn' | 'bad';
  warnings: string[];
}

export interface DecodeDiagnostics {
  mode: string;
  visCode: number | null;
  sampleRate: number;
  fileDuration: string | null;
  freqOffset: number;
  autoCalibrate: boolean;
  visEndPos: number | null;
  decodeTimeMs: number;
  quality: ImageQuality;
}

export interface DecodeResult {
  imageUrl: string;
  diagnostics: DecodeDiagnostics;
}

export interface EncodeResult {
  url: string;
  filename: string;
  mode: string;
  width: number;
  lines: number;
  colorFormat: string;
  expectedDuration: string;
  fileSize: string;
}

export interface DecodeState {
  url: string;
  filename: string;
  diagnostics: DecodeDiagnostics;
  enhancedUrl?: string;
  cloudinaryPublicId?: string;
}

export interface GalleryEntry {
  name: string;
  audioFile: string;
  imageFile: string;
  mode: string;
  quality: 'good' | 'warn' | 'bad';
}
