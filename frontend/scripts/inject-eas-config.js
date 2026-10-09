#!/usr/bin/env node
/**
 * Inyecta EAS_PROJECT_ID y opcionalmente Apple/Google IDs en app.json.
 * Uso:
 *   EAS_PROJECT_ID=xxxxx node scripts/inject-eas-config.js
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const projectId = process.env.EAS_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: Define EAS_PROJECT_ID antes de ejecutar este script.');
  process.exit(1);
}

appJson.expo.extra = appJson.expo.extra || {};
appJson.expo.extra.eas = { projectId };

// Actualizar URL de EAS Update
appJson.expo.updates = appJson.expo.updates || {};
appJson.expo.updates.url = `https://u.expo.dev/${projectId}`;

// Opcional: IDs de Apple/Google Play desde variables de entorno
if (process.env.APPLE_TEAM_ID) {
  appJson.expo.ios = appJson.expo.ios || {};
  appJson.expo.ios.teamId = process.env.APPLE_TEAM_ID;
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`app.json actualizado con EAS projectId: ${projectId}`);
console.log(`EAS Update URL: ${appJson.expo.updates.url}`);
