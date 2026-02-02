// Script to generate example images for SSTV testing
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const outputDir = './public/examples';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate SMPTE color bars test pattern
function generateTestPattern() {
  const canvas = createCanvas(320, 240);
  const ctx = canvas.getContext('2d');

  // SMPTE color bars
  const colors = [
    '#C0C0C0', // White
    '#C0C000', // Yellow
    '#00C0C0', // Cyan
    '#00C000', // Green
    '#C000C0', // Magenta
    '#C00000', // Red
    '#0000C0'  // Blue
  ];

  const barWidth = 320 / colors.length;

  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, 0, barWidth, 180);
  });

  // Lower section - black, white, black bars
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 180, 320, 60);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(80, 180, 160, 60);

  // Add text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SSTV TEST', 160, 210);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'test-pattern.png'), buffer);
  console.log('✓ Generated test-pattern.png');
}

// Generate a simple gradient sample
function generateSamplePhoto() {
  const canvas = createCanvas(320, 240);
  const ctx = canvas.getContext('2d');

  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 320, 240);
  gradient.addColorStop(0, '#1e3a8a');
  gradient.addColorStop(0.5, '#7c3aed');
  gradient.addColorStop(1, '#ec4899');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 320, 240);

  // Add some shapes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(160, 120, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SSTV', 160, 130);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'sample-photo.png'), buffer);
  console.log('✓ Generated sample-photo.png');
}

// Generate examples
try {
  generateTestPattern();
  generateSamplePhoto();
  console.log('\n✅ All examples generated successfully!');
} catch (error) {
  console.error('Error generating examples:', error);
  process.exit(1);
}
