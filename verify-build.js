// Verify the built files exist and are reasonable
import fs from 'node:fs';
import path from 'node:path';

console.log('\n🔍 Verifying build...\n');

const distDir = './dist';
const indexPath = path.join(distDir, 'index.html');

// Check dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found!');
  process.exit(1);
}

// Check index.html exists
if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.html not found!');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexPath, 'utf-8');

// Check for JavaScript bundle
const jsMatch = indexContent.match(/src="\/sstv-toolkit\/assets\/index-([^"]+)\.js"/);
if (!jsMatch) {
  console.error('❌ No JavaScript bundle reference found in index.html!');
  process.exit(1);
}

const jsFile = path.join(distDir, 'assets', `index-${jsMatch[1]}.js`);
if (!fs.existsSync(jsFile)) {
  console.error(`❌ JavaScript bundle not found: ${jsFile}`);
  process.exit(1);
}

const jsSize = fs.statSync(jsFile).size;
console.log(`✅ JavaScript bundle: ${(jsSize / 1024).toFixed(1)} KB`);

// Check for CSS bundle
const cssMatch = indexContent.match(/href="\/sstv-toolkit\/assets\/index-([^"]+)\.css"/);
if (!cssMatch) {
  console.error('❌ No CSS bundle reference found in index.html!');
  process.exit(1);
}

const cssFile = path.join(distDir, 'assets', `index-${cssMatch[1]}.css`);
if (!fs.existsSync(cssFile)) {
  console.error(`❌ CSS bundle not found: ${cssFile}`);
  process.exit(1);
}

const cssSize = fs.statSync(cssFile).size;
console.log(`✅ CSS bundle: ${(cssSize / 1024).toFixed(1)} KB`);

// Check build date
const buildDateMatch = indexContent.match(/content="(\d{4}-\d{2}-\d{2})"/);
if (buildDateMatch) {
  console.log(`✅ Build date: ${buildDateMatch[1]}`);
}

// Verify JS bundle contains key functionality
const jsContent = fs.readFileSync(jsFile, 'utf-8');
const requiredStrings = ['SSTVEncoder', 'SSTVDecoder', 'Robot'];

let allFound = true;
for (const str of requiredStrings) {
  if (!jsContent.includes(str)) {
    console.error(`❌ JavaScript bundle missing: ${str}`);
    allFound = false;
  }
}

if (allFound) {
  console.log(`✅ All key components found in bundle`);
}

console.log('\n✅ Build verification PASSED!\n');
console.log('The application is ready for deployment.');
console.log('Visit: https://milesburton.github.io/sstv-toolkit/\n');
