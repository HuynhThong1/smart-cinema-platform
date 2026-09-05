import { writeFile } from 'node:fs/promises';

function requiredUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return value.replace(/\/$/, '');
}

const config = {
  apiUrl: `${requiredUrl('API_URL')}/api/v1`,
  auth: {
    url: requiredUrl('KEYCLOAK_URL'),
    realm: 'smart-cinema',
    clientId: 'smart-admin',
  },
};

const target = new URL('../apps/smart-admin/public/app-config.json', import.meta.url);
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${target.pathname}`);
