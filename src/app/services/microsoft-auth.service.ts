import { Injectable } from '@angular/core';
import {
  AccountInfo,
  AuthenticationResult,
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  PublicClientApplication,
  SilentRequest,
} from '@azure/msal-browser';
import { microsoftAuthConfig } from '../auth/microsoft-auth.config';

type MsalState = {
  client: PublicClientApplication;
  ready: Promise<void>;
};

@Injectable({ providedIn: 'root' })
export class MicrosoftAuthService {
  private readonly msal?: MsalState;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = this.isConfigValid();

    if (!this.enabled) {
      return;
    }

    const client = new PublicClientApplication({
      auth: {
        clientId: microsoftAuthConfig.clientId,
        authority: `https://login.microsoftonline.com/${microsoftAuthConfig.tenantId}`,
        redirectUri: microsoftAuthConfig.redirectUri,
      },
      cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage,
        storeAuthStateInCookie: false,
      },
    });

    const ready = client.initialize();
    this.msal = { client, ready };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async loginPopup(): Promise<AuthenticationResult> {
    if (!this.msal) {
      throw new Error('Microsoft SSO is not configured.');
    }

    await this.msal.ready;
    const result = await this.msal.client.loginPopup({ scopes: microsoftAuthConfig.scopes });
    if (result.account) {
      this.msal.client.setActiveAccount(result.account);
    }
    return result;
  }

  async acquireTokenSilently(): Promise<AuthenticationResult | null> {
    if (!this.msal) {
      return null;
    }

    await this.msal.ready;
    const account = this.getActiveAccount();

    if (!account) {
      return null;
    }

    const request: SilentRequest = {
      scopes: microsoftAuthConfig.scopes,
      account,
    };

    try {
      return await this.msal.client.acquireTokenSilent(request);
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return null;
      }
      throw error;
    }
  }

  getActiveAccount(): AccountInfo | null {
    if (!this.msal) {
      return null;
    }

    const accounts = this.msal.client.getAllAccounts();
    const account = this.msal.client.getActiveAccount() ?? accounts[0] ?? null;

    if (account) {
      this.msal.client.setActiveAccount(account);
    }

    return account;
  }

  async logout(): Promise<void> {
    if (!this.msal) {
      return;
    }

    await this.msal.ready;
    const account = this.msal.client.getActiveAccount();
    await this.msal.client.logoutPopup({
      account: account ?? undefined,
      postLogoutRedirectUri: microsoftAuthConfig.redirectUri,
    });
  }

  private isConfigValid(): boolean {
    const clientId = microsoftAuthConfig.clientId?.trim();
    const tenantId = microsoftAuthConfig.tenantId?.trim();
    return Boolean(clientId && tenantId && !clientId.startsWith('REPLACE_') && !tenantId.startsWith('REPLACE_'));
  }
}
