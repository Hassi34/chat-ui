import { readRuntimeEnv } from './runtime-env';

const FALLBACK_AI_URL = 'http://test-ai/agent';
const FALLBACK_THREAD_ID = 'fallback-thread';
const FALLBACK_ASSISTANT_MESSAGE =
  'The API call to the back end AI failed, returning the default message.';

const FALLBACK_MSAL_CLIENT_ID = 'REPLACE_WITH_CLIENT_ID';
const FALLBACK_MSAL_TENANT_ID = 'REPLACE_WITH_TENANT_ID_OR_COMMON';
const FALLBACK_MSAL_SCOPES = ['User.Read'];
const FALLBACK_MSAL_REDIRECT_URI =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:4200';
const FALLBACK_LOGGING_API_URL = 'http://localhost:4000/api/logs';

const runtimeAiUrl = readRuntimeEnv('NG_APP_AI_API_URL');
const runtimeFallbackThreadId = readRuntimeEnv('NG_APP_FALLBACK_THREAD_ID');
const runtimeFallbackMessage = readRuntimeEnv('NG_APP_FALLBACK_MESSAGE');
const runtimeMsalClientId = readRuntimeEnv('NG_APP_MSAL_CLIENT_ID');
const runtimeMsalTenantId = readRuntimeEnv('NG_APP_MSAL_TENANT_ID');
const runtimeMsalRedirectUri = readRuntimeEnv('NG_APP_MSAL_REDIRECT_URI');
const runtimeMsalScopes = readRuntimeEnv('NG_APP_MSAL_SCOPES');
const runtimeLoggingApiUrl = readRuntimeEnv('NG_APP_LOGGING_API_URL');

type MicrosoftAuthEnvConfig = {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
};

type EnvironmentConfig = {
  production: boolean;
  aiApiUrl: string;
  fallbackThreadId: string;
  fallbackAssistantMessage: string;
  microsoftAuth: MicrosoftAuthEnvConfig;
  loggingApiUrl: string;
};

function resolveValue(runtimeValue: unknown, fallbackValue: string): string {
  return typeof runtimeValue === 'string' && runtimeValue.trim().length > 0
    ? runtimeValue
    : fallbackValue;
}

function parseScopes(scopesValue: unknown, fallback: string[]): string[] {
  if (typeof scopesValue !== 'string') {
    return fallback;
  }

  const entries = scopesValue
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  return entries.length > 0 ? entries : fallback;
}

export const environment: EnvironmentConfig = {
  production: true,
  aiApiUrl: resolveValue(runtimeAiUrl, FALLBACK_AI_URL),
  fallbackThreadId: resolveValue(runtimeFallbackThreadId, FALLBACK_THREAD_ID),
  fallbackAssistantMessage: resolveValue(runtimeFallbackMessage, FALLBACK_ASSISTANT_MESSAGE),
  microsoftAuth: {
    clientId: resolveValue(runtimeMsalClientId, FALLBACK_MSAL_CLIENT_ID),
    tenantId: resolveValue(runtimeMsalTenantId, FALLBACK_MSAL_TENANT_ID),
    redirectUri: resolveValue(runtimeMsalRedirectUri, FALLBACK_MSAL_REDIRECT_URI),
    scopes: parseScopes(runtimeMsalScopes, FALLBACK_MSAL_SCOPES),
  },
  loggingApiUrl: resolveValue(runtimeLoggingApiUrl, FALLBACK_LOGGING_API_URL),
};
