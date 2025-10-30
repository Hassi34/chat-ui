/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly NG_APP_AI_API_URL?: string;
}

declare interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
