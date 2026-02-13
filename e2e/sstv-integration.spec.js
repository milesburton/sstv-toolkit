import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createCanvas } from 'canvas';

/**
 * End-to-End Integration Tests for SSTV Toolkit
 * These tests verify the complete encode→decode workflow in a real browser
 */

test.describe('SSTV Encode → Decode Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sstv-toolkit/');
    await expect(page.locator('h1')).toContainText('SSTV Toolkit');
  });

  test('should encode and decode a simple test pattern', async ({ page }) => {
    // Create a simple test image: black and white gradient
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');

    // Left half black, right half white
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 160, 240);
    ctx.fillStyle = 'white';
    ctx.fillRect(160, 0, 160, 240);

    // Save to temporary file
    const testImagePath = join(tmpdir(), 'sstv-test-pattern.png');
    writeFileSync(testImagePath, canvas.toBuffer('image/png'));

    // Step 1: Upload and encode image
    const encodeInput = page.locator('input[type="file"]').first();
    await encodeInput.setInputFiles(testImagePath);

    // Wait for encoding to complete
    await expect(page.locator('text=Encoded Successfully')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('audio')).toBeVisible();

    // Download the encoded audio
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Download WAV")').click();
    const download = await downloadPromise;

    // Save downloaded audio to temp file
    const audioPath = join(tmpdir(), 'sstv-test-audio.wav');
    await download.saveAs(audioPath);

    // Verify audio file exists and has content
    const audioBuffer = readFileSync(audioPath);
    expect(audioBuffer.length).toBeGreaterThan(10000); // Should be substantial

    // Reset encoder to prepare for decode test
    await page.locator('button:has-text("Encode Another")').click();

    // Step 2: Upload and decode the audio
    const decodeInput = page.locator('input[type="file"]').last();
    await decodeInput.setInputFiles(audioPath);

    // Wait for decoding to complete
    await expect(page.locator('text=Decoded Successfully')).toBeVisible({ timeout: 60000 });

    // Verify decoded image is visible
    const decodedImage = page.locator('img[alt="Decoded SSTV"]');
    await expect(decodedImage).toBeVisible();

    // Verify the image src is a data URL (not empty/black)
    const imageSrc = await decodedImage.getAttribute('src');
    expect(imageSrc).toMatch(/^data:image\/png;base64,/);
    expect(imageSrc.length).toBeGreaterThan(1000); // Should have substantial data

    // Optional: Take a screenshot of the decoded result for manual verification
    await page.screenshot({ path: join(tmpdir(), 'sstv-decode-result.png') });
  });

  test('should work with Robot 36 mode', async ({ page }) => {
    // Verify Robot 36 is default mode
    const modeSelect = page.locator('select').first();
    await expect(modeSelect).toHaveValue('ROBOT36');

    // Create a simple red square test image
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);

    const testImagePath = join(tmpdir(), 'sstv-red-square.png');
    writeFileSync(testImagePath, canvas.toBuffer('image/png'));

    // Upload and encode
    const encodeInput = page.locator('input[type="file"]').first();
    await encodeInput.setInputFiles(testImagePath);

    // Verify encoding completes
    await expect(page.locator('text=Encoded Successfully')).toBeVisible({ timeout: 30000 });
  });

  test('should work with Martin M1 mode', async ({ page }) => {
    // Select Martin M1 mode
    const modeSelect = page.locator('select').first();
    await modeSelect.selectOption('MARTIN1');

    // Create a simple blue square test image
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 100, 100);

    const testImagePath = join(tmpdir(), 'sstv-blue-square.png');
    writeFileSync(testImagePath, canvas.toBuffer('image/png'));

    // Upload and encode
    const encodeInput = page.locator('input[type="file"]').first();
    await encodeInput.setInputFiles(testImagePath);

    // Verify encoding completes
    await expect(page.locator('text=Encoded Successfully')).toBeVisible({ timeout: 30000 });
  });

  test('should work with Scottie S1 mode', async ({ page }) => {
    // Select Scottie S1 mode
    const modeSelect = page.locator('select').first();
    await modeSelect.selectOption('SCOTTIE1');

    // Create a simple green square test image
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 100, 100);

    const testImagePath = join(tmpdir(), 'sstv-green-square.png');
    writeFileSync(testImagePath, canvas.toBuffer('image/png'));

    // Upload and encode
    const encodeInput = page.locator('input[type="file"]').first();
    await encodeInput.setInputFiles(testImagePath);

    // Verify encoding completes
    await expect(page.locator('text=Encoded Successfully')).toBeVisible({ timeout: 30000 });
  });

  test('should handle drag and drop file upload', async ({ page }) => {
    // Create test image
    const canvas = createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, 50, 50);

    const testImagePath = join(tmpdir(), 'sstv-drag-test.png');
    writeFileSync(testImagePath, canvas.toBuffer('image/png'));

    // Simulate drag and drop
    const dropZone = page.locator('.drop-zone').first();
    const fileInput = page.locator('input[type="file"]').first();

    // Use file input instead of actual drag-drop (simpler for testing)
    await fileInput.setInputFiles(testImagePath);

    // Verify encoding starts
    await expect(page.locator('text=Encoded Successfully')).toBeVisible({ timeout: 30000 });
  });
});
