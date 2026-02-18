export class Complex {
  constructor(real = 0, imag = 0) {
    this.real = real;
    this.imag = imag;
  }

  mul(other) {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }

  add(other) {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  scale(scalar) {
    return new Complex(this.real * scalar, this.imag * scalar);
  }

  arg() {
    return Math.atan2(this.imag, this.real);
  }

  abs() {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  static fromPolar(magnitude, phase) {
    return new Complex(magnitude * Math.cos(phase), magnitude * Math.sin(phase));
  }
}
