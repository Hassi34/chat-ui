import { runtimeEnv, type RuntimeEnvKey } from './runtime-env.generated';

type MetaEnvRecord = Record<string, unknown>;

declare const process: { env?: Record<string, string | undefined> } | undefined;

const metaEnv: MetaEnvRecord = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export function readRuntimeEnv(key: RuntimeEnvKey): string | undefined {
  const fromGenerated = runtimeEnv[key];
  if (typeof fromGenerated === 'string' && fromGenerated.trim().length > 0) {
    return fromGenerated;
  }

  const fromMeta = metaEnv[key];
  if (typeof fromMeta === 'string' && fromMeta.trim().length > 0) {
    return fromMeta;
  }

  if (typeof process !== 'undefined') {
    const fromProcess = process.env?.[key];
    if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
      return fromProcess;
    }
  }

  return undefined;
}
