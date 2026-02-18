import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDecodeAudio = vi.fn();

vi.mock('../utils/SSTVDecoder.js', () => ({
  SSTVDecoder: class {
    decodeAudio = mockDecodeAudio;
  },
}));

import { DecoderPanel } from './DecoderPanel.js';

const GOOD_RESULT = {
  imageUrl: 'data:image/png;base64,abc123',
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

const noop = vi.fn();

describe('DecoderPanel', () => {
  beforeEach(() => {
    mockDecodeAudio.mockResolvedValue(GOOD_RESULT);
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

  it('calls onResult with decoded data after triggerUrl resolves', async () => {
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
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ url: GOOD_RESULT.imageUrl }));
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

  it('does not auto-decode when triggerUrl is null', () => {
    render(<DecoderPanel triggerUrl={null} onResult={noop} onError={noop} onReset={noop} />);
    expect(mockDecodeAudio).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
