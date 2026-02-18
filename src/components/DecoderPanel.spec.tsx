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
    render(<DecoderPanel />);
    expect(screen.getByText(/SSTV Audio → Image/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('calls onTriggerConsumed after triggerUrl decode completes', async () => {
    const onTriggerConsumed = vi.fn();
    render(
      <DecoderPanel triggerUrl="examples/iss-test.wav" onTriggerConsumed={onTriggerConsumed} />
    );

    await waitFor(() => {
      expect(onTriggerConsumed).toHaveBeenCalled();
    });
  });

  it('shows decoded image after triggerUrl resolves', async () => {
    render(<DecoderPanel triggerUrl="examples/iss-test.wav" />);

    await waitFor(() => {
      expect(screen.getByAltText('Decoded SSTV')).toBeInTheDocument();
    });
  });

  it('shows success message after successful decode via triggerUrl', async () => {
    render(<DecoderPanel triggerUrl="examples/iss-test.wav" />);

    await waitFor(() => {
      expect(screen.getByText(/Decoded Successfully/i)).toBeInTheDocument();
    });
  });

  it('scrolls into view when triggerUrl is set', async () => {
    render(<DecoderPanel triggerUrl="examples/iss-test.wav" />);

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  it('shows error message when fetch fails for triggerUrl', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<DecoderPanel triggerUrl="examples/bad.wav" />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('does not auto-decode when triggerUrl is null', () => {
    render(<DecoderPanel triggerUrl={null} />);
    expect(mockDecodeAudio).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
