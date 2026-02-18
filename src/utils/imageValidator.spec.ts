import { describe, expect, it } from 'vitest';
import { validateImage } from './imageValidator.js';

describe('imageValidator', () => {
  it('should accept valid SSTV-sized image (320x240)', async () => {
    // Create a small test image
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 320, 240);
    }
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid SSTV-sized image (640x496)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 496;
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject oversized image (width > 1000px)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 500;
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
    expect(result.error).toContain('1200×500');
  });

  it('should reject oversized image (height > 1000px)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 1200;
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
    expect(result.error).toContain('500×1200');
  });

  it('should reject image with aspect ratio too narrow (< 0.5)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 300; // Aspect ratio = 0.33
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('aspect ratio');
  });

  it('should reject image with aspect ratio too wide (> 2.5)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100; // Aspect ratio = 3.0
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('aspect ratio');
  });

  it('should accept image with aspect ratio exactly 0.5', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200; // Aspect ratio = 0.5
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(true);
  });

  it('should accept image with aspect ratio exactly 2.5', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 100; // Aspect ratio = 2.5
    const imageUrl = canvas.toDataURL();

    const result = await validateImage(imageUrl);
    expect(result.valid).toBe(true);
  });

  it('should handle invalid image URL gracefully', async () => {
    const result = await validateImage('invalid://url');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Failed to load');
  });
});
