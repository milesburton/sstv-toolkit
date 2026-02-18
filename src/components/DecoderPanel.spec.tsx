import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerOutboundMessage } from '../types.js';

const GOOD_PIXELS = new Uint8ClampedArray(320 * 240 * 4).fill(128);

const GOOD_RESULT: WorkerOutboundMessage = {
  type: 'result',
  pixels: GOOD_PIXELS,
  width: 320,
  height: 240,
  diagnostics: {
    mode: 'Robot 36',
    visCode: 0x08,
    sampleRate: 48000,
    fileDuration: '2.50s',
    freqOffset: 0,
    autoCalibrate: true,
    visEndPos: 29280,
    decodeTimeMs: 850,
    quality: {
      rAvg: 128,
      gAvg: 128,
      bAvg: 128,
      brightness: 128,
      verdict: 'good' as const,
      warnings: [],
    },
  },
};

const { workerState } = vi.hoisted(() => {
  const workerState = {
    nextResult: null as WorkerOutboundMessage | null,
    messageHandler: null as ((event: MessageEvent<WorkerOutboundMessage>) => void) | null,
  };
  return { workerState };
});

vi.mock('../workers/decoderWorker.ts?worker', () => ({
  default: class MockWorker {
    set onmessage(handler: (event: MessageEvent<WorkerOutboundMessage>) => void) {
      workerState.messageHandler = handler;
    }
    set onerror(_handler: (event: ErrorEvent) => void) {
      /* intentional no-op */
    }
    postMessage(_data: unknown, _transfer?: Transferable[]) {
      const result = workerState.nextResult;
      Promise.resolve().then(() => {
        workerState.messageHandler?.({ data: result } as MessageEvent<WorkerOutboundMessage>);
      });
    }
    terminate() {
      /* intentional no-op */
    }
  },
}));

import { DecoderPanel } from './DecoderPanel.js';

const noop = vi.fn();

describe('DecoderPanel', () => {
  beforeEach(() => {
    workerState.nextResult = GOOD_RESULT;
    workerState.messageHandler = null;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/wav' })),
      })
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the drop zone by default', () => {
    render(<DecoderPanel onResult={noop} onError={noop} onReset={noop} />);
    expect(screen.getByText(/Decoder/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('calls onTriggerConsumed after triggerUrl decode completes', async () => {
    const onTriggerConsumed = vi.fn();
    render(
      <DecoderPanel
        triggerUrl="examples/iss-test.wav"
        onTriggerConsumed={onTriggerConsumed}
        onResult={noop}
        onError={noop}
        onReset={noop}
      />
    );

    await waitFor(() => {
      expect(onTriggerConsumed).toHaveBeenCalled();
    });
  });

  it('calls onResult with a PNG data URL after triggerUrl resolves', async () => {
    const onResult = vi.fn();
    render(
      <DecoderPanel
        triggerUrl="examples/iss-test.wav"
        onResult={onResult}
        onError={noop}
        onReset={noop}
      />
    );

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringMatching(/^data:image\/png;base64,/) })
      );
    });
  });

  it('scrolls into view when triggerUrl is set', async () => {
    render(
      <DecoderPanel
        triggerUrl="examples/iss-test.wav"
        onResult={noop}
        onError={noop}
        onReset={noop}
      />
    );

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  it('calls onError when fetch fails for triggerUrl', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const onError = vi.fn();
    render(
      <DecoderPanel
        triggerUrl="examples/bad.wav"
        onResult={noop}
        onError={onError}
        onReset={noop}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network error');
    });
  });

  it('calls onError when worker returns an error message', async () => {
    workerState.nextResult = { type: 'error', message: 'Worker decode error' };
    const onError = vi.fn();
    render(
      <DecoderPanel
        triggerUrl="examples/iss-test.wav"
        onResult={noop}
        onError={onError}
        onReset={noop}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Worker decode error');
    });
  });

  it('does not auto-decode when triggerUrl is null', () => {
    render(<DecoderPanel triggerUrl={null} onResult={noop} onError={noop} onReset={noop} />);
    expect(fetch).not.toHaveBeenCalled();
  });
});
