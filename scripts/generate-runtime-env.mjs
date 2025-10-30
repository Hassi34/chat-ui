#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const envPath = resolve(repoRoot, '.env');
const outputPath = resolve(repoRoot, 'src/environments/runtime-env.generated.ts');

const SUPPORTED_KEYS = [
  'NG_APP_AI_API_URL',
  'NG_APP_FALLBACK_THREAD_ID',
  'NG_APP_FALLBACK_MESSAGE',
  'NG_APP_MSAL_CLIENT_ID',
  'NG_APP_MSAL_TENANT_ID',
  'NG_APP_MSAL_REDIRECT_URI',
  'NG_APP_MSAL_SCOPES',
  'NG_APP_LOGGING_API_URL',
];

const rawContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const parsedEnv = parseEnv(rawContent);

const lines = SUPPORTED_KEYS.map((key) => {
  const value = parsedEnv[key] ?? '';
  return `  ${key}: ${JSON.stringify(value)},`;
});

const fileHeading = `// This file is auto-generated from .env by scripts/generate-runtime-env.mjs
// Do not edit by hand — update .env instead.
`;

const typeDeclaration = `export type RuntimeEnvKey =
${SUPPORTED_KEYS.map((key) => `  | '${key}'`).join('\n')};
`;

const fileBody = `export const runtimeEnv: Partial<Record<RuntimeEnvKey, string>> = {
${lines.join('\n')}
};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${fileHeading}\n${typeDeclaration}\n${fileBody}`);

function parseEnv(content) {
  if (!content) {
    return {};
  }

  const lines = content.split(/\r?\n/);
  return lines.reduce((result, line) => {
    if (!line || line.trim().length === 0) {
      return result;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return result;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return result;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      return result;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
    return result;
  }, {});
}
