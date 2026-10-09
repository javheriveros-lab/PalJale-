#!/usr/bin/env node
/**
 * Validaciones previas a EAS Build.
 * Uso:
 *   node scripts/validate-build.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requiredAssets = [
  ['icon.png', 1024, 1024],
  ['adaptive-icon.png', 1024, 1024],
  ['splash.png', 1242, 2436],
  ['favicon.png', 32, 32],
  ['notification-icon.png', 96, 96],
  ['notification-sound.wav'],
];

let errors = 0;

function fail(msg) {
  console.error(`❌ ${msg}`);
  errors += 1;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

// 1. Variables de entorno
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
if (!backendUrl) {
  fail('EXPO_PUBLIC_BACKEND_URL no está definida.');
} else {
  ok(`EXPO_PUBLIC_BACKEND_URL=${backendUrl}`);
}

// 2. app.json
const appJsonPath = path.join(root, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const projectId = appJson.expo?.extra?.eas?.projectId;
if (!projectId || projectId.includes('YOUR_EAS_PROJECT_ID')) {
  fail('app.json no tiene un EAS projectId válido. Ejecuta scripts/inject-eas-config.js');
} else {
  ok(`EAS projectId configurado: ${projectId}`);
}

// 3. Assets
for (const item of requiredAssets) {
  const [name, expectedW, expectedH] = item;
  const assetPath = path.join(root, 'assets', name);
  if (!fs.existsSync(assetPath)) {
    fail(`Falta asset: assets/${name}`);
    continue;
  }
  if (expectedW && expectedH && name.endsWith('.png')) {
    // No usamos sharp/pngjs para no agregar dependencias; solo verificamos existencia
    ok(`assets/${name} existe`);
  } else {
    ok(`assets/${name} existe`);
  }
}

// 4. google-services.json para Android push
const googleServicesPath = path.join(root, 'google-services.json');
if (!fs.existsSync(googleServicesPath)) {
  fail('Falta google-services.json para Android push. Descárgalo desde Firebase Console.');
} else {
  ok('google-services.json encontrado');
}

if (errors > 0) {
  console.error(`\n⚠️  Se encontraron ${errors} problema(s). Resuélvelos antes de correr EAS Build.`);
  process.exit(1);
} else {
  console.log('\n🚀 Todo listo para EAS Build.');
}
