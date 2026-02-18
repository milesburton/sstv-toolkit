import type { WorkerDecodeRequest, WorkerOutboundMessage } from '../types.js';
import { SSTVDecoder } from '../utils/SSTVDecoder.js';

self.onmessage = async (event: MessageEvent<WorkerDecodeRequest>) => {
  const { buffer } = event.data;

  try {
    const result = await new SSTVDecoder().decodeAudioBuffer(buffer);

    const msg: WorkerOutboundMessage = {
      type: 'result',
      pixels: result.pixels,
      width: result.width,
      height: result.height,
      diagnostics: result.diagnostics,
    };

    self.postMessage(msg, [result.pixels.buffer]);
  } catch (err) {
    const msg: WorkerOutboundMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Decoding failed',
    };
    self.postMessage(msg);
  }
};
