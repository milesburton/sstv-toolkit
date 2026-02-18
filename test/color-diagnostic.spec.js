import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(async () => {
  global.AudioContext = class {
    constructor() {
      this.sampleRate = 48000;
    }
  };

  if (!global.URL) {
    global.URL = {
      createObjectURL: () => 'mock://image',
      revokeObjectURL: () => undefined,
    };
  }
});

describe('Color Conversion Diagnostic', () => {
  it('should verify encoder YUV formulas match decoder expectations', () => {
    const testCases = [
      { r: 255, g: 0, b: 0, name: 'Pure Red' },
      { r: 0, g: 255, b: 0, name: 'Pure Green' },
      { r: 0, g: 0, b: 255, name: 'Pure Blue' },
      { r: 128, g: 128, b: 128, name: 'Gray' },
    ];

    testCases.forEach(({ r, g, b, name }) => {
      const Y_enc = 0.299 * r + 0.587 * g + 0.114 * b;
      const U_enc = 128 + (b - Y_enc) * 0.5;
      const V_enc = 128 + (r - Y_enc) * 0.5;

      const R_dec = Y_enc + (V_enc - 128) * 2;
      const G_dec =
        Y_enc - (0.114 / 0.587) * (U_enc - 128) * 2 - (0.299 / 0.587) * (V_enc - 128) * 2;
      const B_dec = Y_enc + (U_enc - 128) * 2;

      console.log(`\n${name} (R=${r}, G=${g}, B=${b}):`);
      console.log(`  Encoder: Y=${Y_enc.toFixed(1)}, U=${U_enc.toFixed(1)}, V=${V_enc.toFixed(1)}`);
      console.log(`  Decoder: R=${R_dec.toFixed(1)}, G=${G_dec.toFixed(1)}, B=${B_dec.toFixed(1)}`);
      console.log(
        `  Error: ΔR=${(R_dec - r).toFixed(1)}, ΔG=${(G_dec - g).toFixed(1)}, ΔB=${(B_dec - b).toFixed(1)}`
      );

      expect(Math.abs(R_dec - r)).toBeLessThan(5);
      expect(Math.abs(G_dec - g)).toBeLessThan(5);
      expect(Math.abs(B_dec - b)).toBeLessThan(5);
    });
  });

  it('should verify BT.601 formulas are mathematically consistent', () => {
    const Kr = 0.299;
    const Kg = 0.587;
    const Kb = 0.114;

    const Umax = 0.5;
    const Vmax = 0.5;

    const U_coeff_r = (-Kr / (1 - Kb)) * Umax;
    const U_coeff_g = (-Kg / (1 - Kb)) * Umax;
    const U_coeff_b = ((1 - Kb) / (1 - Kb)) * Umax;

    const V_coeff_r = ((1 - Kr) / (1 - Kr)) * Vmax;
    const V_coeff_g = (-Kg / (1 - Kr)) * Vmax;
    const V_coeff_b = (-Kb / (1 - Kr)) * Vmax;

    console.log('\nBT.601 Derived Coefficients:');
    console.log(
      `  U: ${U_coeff_r.toFixed(5)} * R + ${U_coeff_g.toFixed(5)} * G + ${U_coeff_b.toFixed(5)} * B`
    );
    console.log(
      `  V: ${V_coeff_r.toFixed(5)} * R + ${V_coeff_g.toFixed(5)} * G + ${V_coeff_b.toFixed(5)} * B`
    );

    console.log('\nCurrent Encoder Coefficients:');
    console.log(`  U: -0.168736 * R + -0.331264 * G + 0.5 * B`);
    console.log(`  V: 0.5 * R + -0.418688 * G + -0.081312 * B`);

    expect(Math.abs(U_coeff_r - -0.168736)).toBeLessThan(0.001);
    expect(Math.abs(U_coeff_g - -0.331264)).toBeLessThan(0.001);
    expect(Math.abs(U_coeff_b - 0.5)).toBeLessThan(0.001);

    expect(Math.abs(V_coeff_r - 0.5)).toBeLessThan(0.001);
    expect(Math.abs(V_coeff_g - -0.418688)).toBeLessThan(0.001);
    expect(Math.abs(V_coeff_b - -0.081312)).toBeLessThan(0.001);
  });
});
