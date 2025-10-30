import { environment } from '../../environments/environment';

export type MicrosoftAuthConfiguration = {
  /** Azure AD application (client) ID */
  clientId: string;
  /** Azure AD tenant ID or 'common' */
  tenantId: string;
  /** Redirect URI registered for the application */
  redirectUri: string;
  /** OAuth scopes requested during login */
  scopes: string[];
};

export const microsoftAuthConfig: MicrosoftAuthConfiguration = {
  clientId: environment.microsoftAuth.clientId,
  tenantId: environment.microsoftAuth.tenantId,
  redirectUri: environment.microsoftAuth.redirectUri,
  scopes: [...environment.microsoftAuth.scopes],
};
