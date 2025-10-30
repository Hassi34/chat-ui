import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../services/auth.service';
import { LoggingService } from '../services/logging.service';

@Component({
  selector: 'app-login-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './login-screen.html',
  styleUrl: './login-screen.scss',
})
export class LoginScreen {
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly error = signal('');

  private readonly logging = inject(LoggingService);

  constructor(private readonly authService: AuthService) {}

  protected handleSubmit(): void {
    const username = this.username().trim();
    const password = this.password();

    if (!username || !password) {
      this.logging.logError('Password login rejected: missing credentials', { source: 'login-screen' });
      this.error.set('Enter any username and password to continue.');
      return;
    }

    this.error.set('');
    this.isSubmitting.set(true);

    setTimeout(() => {
      this.authService.login(username, password);
      this.isSubmitting.set(false);
      this.username.set('');
      this.password.set('');
    }, 200);
  }

  protected async handleMicrosoftLogin(): Promise<void> {
    if (!this.authService.isMicrosoftEnabled()) {
      this.error.set('Microsoft login is not configured for this environment. Double-check your NG_APP_MSAL_* values and restart the dev server if you just added them.');
      this.logging.logError('Microsoft login attempted without configuration', { source: 'login-screen' });
      return;
    }

    this.error.set('');
    this.isSubmitting.set(true);

    try {
      await this.authService.loginWithMicrosoft();
    } catch (err) {
      console.error('Microsoft login failed', err);
      this.error.set('We could not sign you in with Microsoft right now. Try again or use your password.');
      this.logging.logError('Microsoft login failed', err, { source: 'login-screen' });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected handleUsernameChange(value: string): void {
    this.username.set(value);
  }

  protected handlePasswordChange(value: string): void {
    this.password.set(value);
  }
}
