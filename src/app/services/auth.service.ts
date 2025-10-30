import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthenticationResult } from '@azure/msal-browser';
import { UserSession } from '../models/user-session.model';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { LoggingService } from './logging.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<UserSession | null>(null);
  private readonly microsoftAuth = inject(MicrosoftAuthService);
  private readonly logger = inject(LoggingService);

  readonly currentUser = computed(() => this._currentUser());

  constructor() {
    void this.restoreMicrosoftSession();
  }

  isMicrosoftEnabled(): boolean {
    return this.microsoftAuth.isEnabled();
  }

  login(username: string, _password?: string): void {
    this.logger.logInfo('Password login succeeded', { username });
    this._currentUser.set({ username, provider: 'password' });
  }

  async loginWithMicrosoft(): Promise<UserSession> {
    this.logger.logInfo('Microsoft login initiated');

    try {
      const result = await this.microsoftAuth.loginPopup();
      const session = this.sessionFromAuthentication(result);
      this._currentUser.set(session);
      this.logger.logInfo('Microsoft login succeeded', { username: session.username });
      return session;
    } catch (error) {
      this.logger.logError('Microsoft login failed', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    const current = this._currentUser();
    this._currentUser.set(null);

    if (current) {
      this.logger.logInfo('User logged out', { username: current.username, provider: current.provider });
    }

    if (current?.provider === 'microsoft') {
      await this.microsoftAuth.logout().catch(() => undefined);
    }
  }

  private async restoreMicrosoftSession(): Promise<void> {
    if (!this.microsoftAuth.isEnabled()) {
      this.logger.logInfo('Skipped Microsoft session restore because SSO is disabled.');
      return;
    }

    const account = this.microsoftAuth.getActiveAccount();

    if (!account) {
      const token = await this.microsoftAuth.acquireTokenSilently();
      if (!token) {
        this.logger.logInfo('No Microsoft account restored from silent token.');
        return;
      }
      const session = this.sessionFromAuthentication(token);
      this._currentUser.set(session);
      this.logger.logInfo('Restored Microsoft session from silent token.', { username: session.username });
      return;
    }

    const session = {
      username: account.username,
      displayName: account.name ?? account.username,
      email: account.username,
      provider: 'microsoft',
    } as const;

    this._currentUser.set(session);
    this.logger.logInfo('Restored Microsoft session from active account.', { username: session.username });
  }

  private sessionFromAuthentication(result: AuthenticationResult): UserSession {
    const account = result.account;

    if (!account) {
      throw new Error('No account information returned from Microsoft login.');
    }

    return {
      username: account.username,
      displayName: account.name ?? account.username,
      email: account.username,
      provider: 'microsoft',
    };
  }
}
