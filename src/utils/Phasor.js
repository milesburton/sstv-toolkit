import { Complex } from './Complex.js';

export class Phasor {
  constructor(frequency, sampleRate) {
    this.phase = 0;
    this.angularFreq = (2 * Math.PI * frequency) / sampleRate;
  }

  rotate() {
    const value = new Complex(Math.cos(this.phase), -Math.sin(this.phase));
    this.phase += this.angularFreq;
    if (this.phase > Math.PI) {
      this.phase -= 2 * Math.PI;
    } else if (this.phase < -Math.PI) {
      this.phase += 2 * Math.PI;
    }
    return value;
  }

  reset() {
    this.phase = 0;
  }
}
