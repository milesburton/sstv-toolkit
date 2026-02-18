/**
 * Cloudinary integration for AI-powered image enhancement
 * Uses unsigned uploads (no backend required)
 */

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export interface EnhancementOptions {
  mode?: 'outdoor' | 'indoor';
  noiseReduction?: number;
  sharpen?: number;
  upscale?: boolean;
}

export interface UploadResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  url: string;
  secure_url: string;
}

/**
 * Gets Cloudinary configuration from environment variables
 * @returns Cloudinary configuration object
 * @throws Error if required environment variables are missing
 */
export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET environment variables.'
    );
  }

  return { cloudName, uploadPreset };
}

/**
 * Uploads an image to Cloudinary using unsigned upload
 * @param imageUrl - Data URL or blob URL of the image
 * @param config - Cloudinary configuration
 * @returns Promise resolving to upload response
 */
export async function uploadToCloudinary(
  imageUrl: string,
  config: CloudinaryConfig
): Promise<UploadResponse> {
  // Convert data URL to blob if needed
  const blob = await (async () => {
    if (imageUrl.startsWith('data:')) {
      const response = await fetch(imageUrl);
      return response.blob();
    }
    const response = await fetch(imageUrl);
    return response.blob();
  })();

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', config.uploadPreset);
  formData.append('folder', 'sstv-decoded');
  formData.append('tags', 'sstv,temporary');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Generates an enhanced image URL with AI transformations
 * @param publicId - Cloudinary public ID from upload
 * @param config - Cloudinary configuration
 * @param options - Enhancement options
 * @returns Enhanced image URL
 */
export function getEnhancedUrl(
  publicId: string,
  config: CloudinaryConfig,
  options: EnhancementOptions = {}
): string {
  const { mode = 'outdoor', noiseReduction = 65, sharpen = 85, upscale = true } = options;

  // Build transformation string
  const transformations = [
    `e_improve:${mode}:50`, // AI improvement
    `e_noise_reduce:${noiseReduction}`, // Noise reduction
    'e_contrast:25', // Contrast enhancement
    `e_sharpen:${sharpen}`, // Sharpening
    'e_auto_color', // Auto color correction
  ];

  if (upscale) {
    transformations.push('w_800,c_scale'); // 2x upscaling
  }

  transformations.push(
    'q_auto:best', // Quality optimization
    'f_auto', // Auto format (WebP for modern browsers)
    'l_text:Arial_16:SSTV%20Toolkit%20Demo,co_rgb:ffffff80,g_south_east,x_10,y_10' // Watermark
  );

  const transformationString = transformations.join('/');

  return `https://res.cloudinary.com/${config.cloudName}/image/upload/${transformationString}/${publicId}`;
}

/**
 * Gets the original image URL from Cloudinary
 * @param publicId - Cloudinary public ID from upload
 * @param config - Cloudinary configuration
 * @returns Original image URL
 */
export function getOriginalUrl(publicId: string, config: CloudinaryConfig): string {
  return `https://res.cloudinary.com/${config.cloudName}/image/upload/${publicId}`;
}

/**
 * Generates a GitHub issue URL for reporting inappropriate images
 * @param publicId - Cloudinary public ID of the reported image
 * @returns GitHub issue creation URL with pre-filled template
 */
export function getReportUrl(publicId: string): string {
  const title = encodeURIComponent('Report inappropriate image');
  const body = encodeURIComponent(
    `## Report Details

**Cloudinary Public ID:** ${publicId}
**Timestamp:** ${new Date().toISOString()}

## Reason for Report

Please describe why you are reporting this image:

[Your description here]

---
*This report was generated automatically by SSTV Toolkit*`
  );

  return `https://github.com/milesburton/sstv-toolkit/issues/new?title=${title}&body=${body}`;
}
