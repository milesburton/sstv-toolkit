import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCloudinaryConfig, getEnhancedUrl, getOriginalUrl, getReportUrl } from './cloudinary.js';

describe('cloudinary', () => {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'test-cloud');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'test-preset');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getCloudinaryConfig', () => {
    it('should return config from environment variables', () => {
      const config = getCloudinaryConfig();
      expect(config.cloudName).toBe('test-cloud');
      expect(config.uploadPreset).toBe('test-preset');
    });

    it('should throw error if cloud name is missing', () => {
      vi.unstubAllEnvs();
      vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', '');
      vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'test-preset');

      expect(() => getCloudinaryConfig()).toThrow('Cloudinary configuration missing');
    });

    it('should throw error if upload preset is missing', () => {
      vi.unstubAllEnvs();
      vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'test-cloud');
      vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', '');

      expect(() => getCloudinaryConfig()).toThrow('Cloudinary configuration missing');
    });
  });

  describe('getEnhancedUrl', () => {
    const config = { cloudName: 'test-cloud', uploadPreset: 'test-preset' };

    it('should generate correct transformation URL with default options', () => {
      const url = getEnhancedUrl('sample/test-image', config);

      expect(url).toContain('https://res.cloudinary.com/test-cloud/image/upload/');
      expect(url).toContain('e_improve:outdoor:50');
      expect(url).toContain('e_noise_reduce:65');
      expect(url).toContain('e_contrast:25');
      expect(url).toContain('e_sharpen:85');
      expect(url).toContain('e_auto_color');
      expect(url).toContain('w_800,c_scale');
      expect(url).toContain('q_auto:best');
      expect(url).toContain('f_auto');
      expect(url).toContain('l_text:Arial_16:SSTV%20Toolkit%20Demo');
      expect(url).toContain('sample/test-image');
    });

    it('should use indoor mode when specified', () => {
      const url = getEnhancedUrl('sample/test-image', config, { mode: 'indoor' });
      expect(url).toContain('e_improve:indoor:50');
    });

    it('should use custom noise reduction value', () => {
      const url = getEnhancedUrl('sample/test-image', config, { noiseReduction: 80 });
      expect(url).toContain('e_noise_reduce:80');
    });

    it('should use custom sharpen value', () => {
      const url = getEnhancedUrl('sample/test-image', config, { sharpen: 100 });
      expect(url).toContain('e_sharpen:100');
    });

    it('should omit upscaling when disabled', () => {
      const url = getEnhancedUrl('sample/test-image', config, { upscale: false });
      expect(url).not.toContain('w_800,c_scale');
    });

    it('should handle public_id with folders', () => {
      const url = getEnhancedUrl('sstv-decoded/img123', config);
      expect(url).toContain('sstv-decoded/img123');
    });

    it('should generate watermark with correct positioning', () => {
      const url = getEnhancedUrl('sample/test-image', config);
      expect(url).toContain('l_text:Arial_16:SSTV%20Toolkit%20Demo');
      expect(url).toContain('co_rgb:ffffff80'); // Semi-transparent white
      expect(url).toContain('g_south_east'); // Bottom-right
      expect(url).toContain('x_10,y_10'); // 10px offset
    });
  });

  describe('getOriginalUrl', () => {
    const config = { cloudName: 'test-cloud', uploadPreset: 'test-preset' };

    it('should generate correct original URL', () => {
      const url = getOriginalUrl('sample/test-image', config);
      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/sample/test-image');
    });

    it('should handle public_id with folders', () => {
      const url = getOriginalUrl('sstv-decoded/img123', config);
      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/sstv-decoded/img123');
    });
  });

  describe('getReportUrl', () => {
    it('should generate GitHub issue URL with pre-filled template', () => {
      const url = getReportUrl('sstv-decoded/test-image-123');

      expect(url).toContain('https://github.com/milesburton/sstv-toolkit/issues/new');
      expect(url).toContain('title=Report%20inappropriate%20image');
      expect(url).toContain('sstv-decoded%2Ftest-image-123');
      expect(url).toContain('body=');
    });

    it('should include timestamp in report body', () => {
      const url = getReportUrl('sstv-decoded/test-image-123');
      expect(url).toContain('Timestamp');
    });

    it('should include public_id in report body', () => {
      const url = getReportUrl('sstv-decoded/test-image-123');
      expect(url).toContain('sstv-decoded');
    });
  });
});
