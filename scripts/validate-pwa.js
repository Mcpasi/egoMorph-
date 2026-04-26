const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (err) {
    fail(`${file} konnte nicht gelesen werden: ${err.message}`);
    return null;
  }
}

function exists(file) {
  const ok = fs.existsSync(path.join(root, file));
  if (!ok) fail(`${file} fehlt`);
  return ok;
}

function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    fail(`${file} ist keine PNG-Datei`);
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

const manifest = readJson('manifest.json');
exists('index.html');
exists('sw.js');

if (manifest) {
  ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'icons'].forEach(key => {
    if (!manifest[key]) fail(`manifest.json: ${key} fehlt`);
  });

  if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen') {
    fail('manifest.json: display sollte standalone oder fullscreen sein');
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const required = ['192x192', '512x512'];
  required.forEach(size => {
    const icon = icons.find(item => item.sizes === size && item.src);
    if (!icon) {
      fail(`manifest.json: Icon ${size} fehlt`);
      return;
    }
    if (!exists(icon.src)) return;
    const actual = pngSize(icon.src);
    const expected = Number(size.split('x')[0]);
    if (actual && (actual.width !== expected || actual.height !== expected)) {
      fail(`${icon.src}: erwartet ${size}, gefunden ${actual.width}x${actual.height}`);
    }
  });

  if (!icons.some(item => typeof item.purpose === 'string' && item.purpose.includes('maskable'))) {
    fail('manifest.json: mindestens ein maskable Icon fehlt');
  }
}

const index = fs.existsSync(path.join(root, 'index.html'))
  ? fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  : '';
if (!/serviceWorker\.register\(['"]\.\/sw\.js['"]/.test(index)) {
  fail('index.html: Service Worker wird nicht mit ./sw.js registriert');
}
if (!/<link[^>]+rel=["']manifest["'][^>]+href=["']manifest\.json["']/.test(index)) {
  fail('index.html: Manifest-Link fehlt oder ist nicht korrekt');
}

if (failures.length) {
  console.error('PWA validation failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('PWA validation passed.');
