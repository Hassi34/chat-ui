import { Component, ViewChild, inject, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ActiveChat } from './active-chat/active-chat';
import { ConversationSidebar } from './conversation-sidebar/conversation-sidebar';
import { LoginScreen } from './login-screen/login-screen';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, ConversationSidebar, ActiveChat, LoginScreen],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('AI Chat');
  protected readonly activeThreadId = signal<string | null>(null);
  protected readonly currentUser = inject(AuthService).currentUser;

  @ViewChild(ActiveChat) private activeChat?: ActiveChat;
  @ViewChild(ConversationSidebar) private sidebar?: ConversationSidebar;

  protected toggleSidebar(): void {
    this.sidebar?.toggle();
  }

  protected handleThreadChange(threadId: string | null): void {
    this.activeThreadId.set(threadId);
  }

  protected startNewChat(): void {
    this.activeChat?.resetConversation();
    this.sidebar?.startNewSession();
    this.activeThreadId.set(null);
  }
}
