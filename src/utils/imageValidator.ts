/**
 * Client-side image validation for SSTV enhancement
 * Prevents upload of oversized or invalid images
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates image dimensions and aspect ratio for SSTV enhancement
 * @param imageUrl - Data URL or blob URL of the image
 * @returns Promise resolving to validation result
 */
export async function validateImage(imageUrl: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const width = img.width;
      const height = img.height;

      // Validate dimensions - max 1000px to match typical SSTV formats
      if (width > 1000 || height > 1000) {
        resolve({
          valid: false,
          error: `Image too large (${width}×${height}). Maximum dimension is 1000px.`,
        });
        return;
      }

      // Validate aspect ratio (0.5 to 2.5 range for typical SSTV modes)
      const aspectRatio = width / height;
      if (aspectRatio < 0.5 || aspectRatio > 2.5) {
        resolve({
          valid: false,
          error: `Invalid aspect ratio (${aspectRatio.toFixed(2)}). Must be between 0.5 and 2.5.`,
        });
        return;
      }

      resolve({ valid: true });
    };

    img.onerror = () => {
      resolve({
        valid: false,
        error: 'Failed to load image for validation.',
      });
    };

    img.src = imageUrl;
  });
}
