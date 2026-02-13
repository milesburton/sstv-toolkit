import { describe, expect, it } from 'vitest';
import { SSTVEncoder } from './SSTVEncoder';

/**
 * Unit tests for SSTV integration logic
 * Note: Full encode→decode integration tests are in e2e/sstv-integration.spec.js (Playwright)
 */
describe('SSTV Integration Tests', () => {
  describe('Frequency Accuracy', () => {
    it('should generate accurate sync pulses at 1200 Hz', () => {
      const encoder = new SSTVEncoder('ROBOT36');
      const samples = [];

      encoder.addTone(samples, 1200, 0.01);

      expect(samples.length).toBeGreaterThan(0);

      // Basic sanity check - samples should oscillate
      let zeroCrossings = 0;
      let lastSign = samples[0] >= 0;

      for (let i = 1; i < samples.length; i++) {
        const sign = samples[i] >= 0;
        if (sign !== lastSign) {
          zeroCrossings++;
          lastSign = sign;
        }
      }

      // 1200 Hz for 10ms should give us about 12 cycles = 24 zero crossings
      expect(zeroCrossings).toBeGreaterThan(20);
      expect(zeroCrossings).toBeLessThan(28);
    });

    it('should generate data tones in correct range', () => {
      const encoder = new SSTVEncoder('ROBOT36');

      // Test various gray levels
      const testValues = [0, 64, 128, 192, 255];

      testValues.forEach((value) => {
        const freq = 1500 + (value / 255) * (2300 - 1500);

        expect(freq).toBeGreaterThanOrEqual(1500);
        expect(freq).toBeLessThanOrEqual(2300);

        const samples = [];
        encoder.addTone(samples, freq, 0.005);

        expect(samples.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Mode Compatibility', () => {
    it('should work with ROBOT36 mode', () => {
      const encoder = new SSTVEncoder('ROBOT36');
      expect(encoder.mode.name).toBe('Robot 36');
      expect(encoder.mode.width).toBe(320);
      expect(encoder.mode.lines).toBe(240);
    });

    it('should work with MARTIN1 mode', () => {
      const encoder = new SSTVEncoder('MARTIN1');
      expect(encoder.mode.name).toBe('Martin M1');
      expect(encoder.mode.width).toBe(320);
      expect(encoder.mode.lines).toBe(256);
    });

    it('should work with SCOTTIE1 mode', () => {
      const encoder = new SSTVEncoder('SCOTTIE1');
      expect(encoder.mode.name).toBe('Scottie S1');
      expect(encoder.mode.width).toBe(320);
      expect(encoder.mode.lines).toBe(256);
    });
  });
});
