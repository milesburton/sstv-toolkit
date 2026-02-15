import { Complex } from './Complex.js';

/**
 * Phasor - Complex oscillator for baseband conversion
 * Generates complex exponential: e^(i*ω*t) = cos(ω*t) + i*sin(ω*t)
 * Based on smolgroot/sstv-decoder and xdsopl/robot36
 */
export class Phasor {
  constructor(frequency, sampleRate) {
    this.phase = 0;
    // Angular frequency: ω = 2π * f / sampleRate
    this.angularFreq = (2 * Math.PI * frequency) / sampleRate;
  }

  /**
   * Get current phasor value and advance phase
   * Returns: e^(-iωt) = cos(ωt) - i*sin(ωt) for downconversion
   */
  rotate() {
    // For baseband conversion, we want complex conjugate: cos(phase) - i*sin(phase)
    const value = new Complex(Math.cos(this.phase), -Math.sin(this.phase));

    // Advance phase
    this.phase += this.angularFreq;

    // Wrap phase to [-π, π] for numerical stability
    if (this.phase > Math.PI) {
      this.phase -= 2 * Math.PI;
    } else if (this.phase < -Math.PI) {
      this.phase += 2 * Math.PI;
    }

    return value;
  }

  /**
   * Reset phase to zero
   */
  reset() {
    this.phase = 0;
  }
}
