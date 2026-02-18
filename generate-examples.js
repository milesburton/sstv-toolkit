import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from 'canvas';

const outputDir = './public/examples';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function generateTestPattern() {
  const canvas = createCanvas(320, 240);
  const ctx = canvas.getContext('2d');

  const colors = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'];

  const barWidth = 320 / colors.length;
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, 0, barWidth, 180);
  });

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 180, 320, 60);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(80, 180, 160, 60);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SSTV TEST', 160, 210);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'test-pattern.png'), buffer);
  console.log('✓ Generated test-pattern.png');
}

function generateSamplePhoto() {
  const canvas = createCanvas(320, 240);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 320, 240);
  gradient.addColorStop(0, '#1e3a8a');
  gradient.addColorStop(0.5, '#7c3aed');
  gradient.addColorStop(1, '#ec4899');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 320, 240);

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

try {
  generateTestPattern();
  generateSamplePhoto();
  console.log('\n✅ All examples generated successfully!');
} catch (error) {
  console.error('Error generating examples:', error);
  process.exit(1);
}
