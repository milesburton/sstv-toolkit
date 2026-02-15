/**
 * Complex number class for signal processing
 * Based on smolgroot/sstv-decoder implementation
 */
export class Complex {
  constructor(real = 0, imag = 0) {
    this.real = real;
    this.imag = imag;
  }

  /**
   * Complex multiplication: (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
   */
  mul(other) {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }

  /**
   * Complex addition
   */
  add(other) {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  /**
   * Scalar multiplication
   */
  scale(scalar) {
    return new Complex(this.real * scalar, this.imag * scalar);
  }

  /**
   * Get phase angle (argument) in radians [-π, π]
   */
  arg() {
    return Math.atan2(this.imag, this.real);
  }

  /**
   * Get magnitude (absolute value)
   */
  abs() {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  /**
   * Create complex number from polar coordinates
   */
  static fromPolar(magnitude, phase) {
    return new Complex(magnitude * Math.cos(phase), magnitude * Math.sin(phase));
  }
}
