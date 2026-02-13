// Example files for testing SSTV encoding/decoding

export const examples = {
  images: [
    {
      name: 'SSTV Test Pattern',
      description: 'Classic SMPTE color bars test pattern',
      path: '/examples/test-pattern.png',
      preview: '/examples/test-pattern.png',
    },
    {
      name: 'Sample Photo',
      description: 'Low-res landscape for quick testing',
      path: '/examples/sample-photo.png',
      preview: '/examples/sample-photo.png',
    },
  ],
  audio: [
    // Audio examples will be generated from the image examples above
    // Users can encode the test patterns and use those for testing decoding
  ],
};

// Helper to load example file
export async function loadExample(path) {
  const response = await fetch(path);
  const blob = await response.blob();

  // Create a File object from the blob
  const filename = path.split('/').pop();
  return new File([blob], filename, { type: blob.type });
}
