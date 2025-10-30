import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../services/auth.service';
import { LoggingService } from '../services/logging.service';

type SidebarChat = {
  id: string;
  title: string;
  createdAt: Date;
};

@Component({
  selector: 'app-conversation-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './conversation-sidebar.html',
  styleUrl: './conversation-sidebar.scss',
})
export class ConversationSidebar {
  protected readonly expanded = signal(true);
  protected readonly currentChat = signal<SidebarChat>(this.createCurrentChat());

  protected readonly chats = signal<SidebarChat[]>([
    this.currentChat(),
    { id: 'marketing-plan', title: 'Marketing plan ideas', createdAt: new Date(Date.now() - 3600_000) },
    { id: 'brainstorm-prompts', title: 'Brainstorm prompts', createdAt: new Date(Date.now() - 7200_000) },
    { id: 'lesson-plan-outline', title: 'Lesson plan outline', createdAt: new Date(Date.now() - 10800_000) },
  ]);
  protected readonly searchTerm = signal('');
  protected readonly filteredChats = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.chats();

    if (!term) {
      return items;
    }

    return items.filter((chat) => chat.title.toLowerCase().includes(term));
  });
  protected readonly hasChats = computed(() => this.chats().length > 0);
  protected readonly hasFilteredChats = computed(() => this.filteredChats().length > 0);
  protected readonly activeChatId = signal<SidebarChat['id'] | ''>(this.currentChat().id);
  protected readonly usernameInput = signal('');
  protected readonly passwordInput = signal('');
  protected readonly loginError = signal('');
  protected readonly ssoPending = signal(false);

  private readonly authService = inject(AuthService);
  private readonly logging = inject(LoggingService);
  protected readonly currentUser = computed(() => this.authService.currentUser());
  protected readonly isLoggedIn = computed(() => this.currentUser() !== null);

  private readonly syncActiveChat = effect(() => {
    const chats = this.chats();
    const current = this.activeChatId();

    if (chats.length === 0 && current !== '') {
      this.activeChatId.set('');
      return;
    }

    if (chats.length > 0 && !chats.some((chat) => chat.id === current)) {
      this.activeChatId.set(chats[0]?.id ?? '');
    }
  });

  toggle(): void {
    this.expanded.update((value) => !value);
  }

  setActiveChat(chatId: string): void {
    if (this.activeChatId() !== chatId && this.chats().some((chat) => chat.id === chatId)) {
      this.activeChatId.set(chatId);
    }
  }

  protected formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  startNewSession(): void {
    const fresh = this.createCurrentChat();
    this.currentChat.set(fresh);
    this.activeChatId.set(fresh.id);
    this.chats.update((items) => {
      if (items.length === 0) {
        return [fresh];
      }

      const [, ...rest] = items;
      return [fresh, ...rest];
    });
  }

  private createCurrentChat(): SidebarChat {
    return {
      id: 'current-chat',
      title: 'Current chat',
      createdAt: new Date(),
    };
  }

  protected handleSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  protected handleUsernameChange(value: string): void {
    this.usernameInput.set(value);
  }

  protected handlePasswordChange(value: string): void {
    this.passwordInput.set(value);
  }

  protected handleLogin(): void {
    const username = this.usernameInput().trim();
    const password = this.passwordInput();

    if (!username || !password) {
      this.loginError.set('Enter both username and password to continue.');
      this.logging.logError('Password login rejected: missing credentials', { source: 'conversation-sidebar' });
      return;
    }

    this.loginError.set('');
    this.authService.login(username, password);
    this.usernameInput.set('');
    this.passwordInput.set('');
  }

  protected handleLogout(): void {
    this.authService.logout();
  }

  protected async handleMicrosoftLogin(): Promise<void> {
    if (!this.authService.isMicrosoftEnabled()) {
      this.loginError.set('Microsoft login is not configured. Double-check your NG_APP_MSAL_* values and restart the dev server if you just added them.');
      this.logging.logError('Microsoft login attempted without configuration', { source: 'conversation-sidebar' });
      return;
    }

    this.loginError.set('');
    this.ssoPending.set(true);

    try {
      await this.authService.loginWithMicrosoft();
    } catch (error) {
      console.error('Sidebar Microsoft login failed', error);
      this.loginError.set('Unable to sign in with Microsoft right now.');
      this.logging.logError('Microsoft login failed', error, { source: 'conversation-sidebar' });
    } finally {
      this.ssoPending.set(false);
    }
  }

}
