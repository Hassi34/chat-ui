import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import { ChatAiService } from '../services/chat-ai.service';
import { AuthService } from '../services/auth.service';
import { ChatAgentResponse, ChatAgentRole } from '../models/chat-agent.model';
import { environment } from '../../environments/environment';
import { ChatInput } from './chat-input/chat-input';

type ChatRole = ChatAgentRole;

type ChatFeedback = 'up' | 'down';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  pending?: boolean;
  error?: boolean;
  feedback?: ChatFeedback;
  feedbackComment?: string;
  feedbackDraft?: string;
  feedbackSubmitted?: boolean;
}

@Component({
  selector: 'app-active-chat',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatIconModule, MatButtonModule, ChatInput],
  templateUrl: './active-chat.html',
  styleUrl: './active-chat.scss',
  host: {
    class: 'active-chat-host',
    '[class.active-chat-host--empty]': 'messages().length === 0',
    '[class.active-chat-host--has-messages]': 'messages().length > 0',
  },
})
export class ActiveChat {
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly isSending = signal(false);
  protected readonly threadId = signal<string | null>(null);
  protected readonly animatedGreeting = signal('');
  public readonly threadChanged = output<string | null>();
  private readonly fallbackAssistantMessage = environment.fallbackAssistantMessage;
  private readonly fallbackThreadId = environment.fallbackThreadId;
  protected readonly samplePrompts = [
    {
      text: 'What are the most promising tech stocks to research this week?',
      icon: 'trending_up',
    },
    {
      text: 'Give me a quick roundup of the latest AI breakthroughs.',
      icon: 'memory',
    },
    {
      text: 'Suggest a daily productivity routine that balances work and breaks.',
      icon: 'schedule',
    },
    {
      text: 'Which cryptocurrencies look promising for investment right now?',
      icon: 'currency_bitcoin',
    },
  ];

  @ViewChild('messageViewport') private messageViewport?: ElementRef<HTMLDivElement>;
  @ViewChild(ChatInput) private chatInput?: ChatInput;

  private readonly chatService = inject(ChatAiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private greetingAnimationHandle: number | null = null;
  private greetingTargetText = '';
  private greetingIndex = 0;
  private greetingDirection: 'forward' | 'backward' = 'forward';
  private greetingHoldTicks = 0;

  protected readonly greetingName = computed(() => {
    const session = this.authService.currentUser();
    const displayName = session?.displayName?.trim();
    if (displayName) {
      return displayName;
    }

    const username = session?.username?.trim();
    if (username) {
      return username;
    }

    return 'there';
  });

  private readonly _autoScroll = effect(() => {
    this.messages();
    this.scrollToBottom();
  });

  private readonly _animateGreeting = effect(
    () => {
      const name = this.greetingName();
      const target = `Welcome, ${name}`.trim();
      this.resetGreetingAnimation(target);
    },
    { allowSignalWrites: true }
  );

  public constructor() {
    this.destroyRef.onDestroy(() => this.stopGreetingAnimation());
  }

  protected async handleSend(rawContent: string): Promise<void> {
    const content = rawContent.trim();
    if (!content || this.isSending()) {
      return;
    }

    const userMessage = this.createMessage('user', content);
    this.messages.update((msgs) => [...msgs, userMessage]);

    const assistantDraft = this.createMessage('assistant', '', true);
    this.messages.update((msgs) => [...msgs, assistantDraft]);
    this.isSending.set(true);

    try {
      const response = await firstValueFrom(
        this.chatService.sendMessage(content, {
          threadId: this.threadId() ?? undefined,
        })
      );

      const assistantReply = this.extractReplyText(response);
      const responseThreadId = this.extractThreadId(response);

      if (responseThreadId) {
        this.updateThreadId(responseThreadId);
      }

      this.messages.update((msgs) =>
        msgs.map((msg) =>
          msg.id === assistantDraft.id
            ? { ...msg, content: assistantReply || '...', pending: false }
            : msg
        )
      );
    } catch (error) {
      const fallbackMessage = this.fallbackAssistantMessage;
      this.messages.update((msgs) =>
        msgs.map((msg) =>
          msg.id === assistantDraft.id
            ? {
                ...msg,
                content: fallbackMessage,
                pending: false,
                error: false,
              }
            : msg
        )
      );

      if (!this.threadId()) {
        this.updateThreadId(this.fallbackThreadId);
      }
    } finally {
      this.isSending.set(false);
    }
  }

  protected handleSamplePrompt(prompt: string): void {
    if (this.isSending()) {
      return;
    }

    this.chatInput?.prefillAndSubmit(prompt);
  }

  protected handleFeedback(messageId: string, feedback: ChatFeedback): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id !== messageId || msg.pending) {
          return msg;
        }

        if (feedback === 'down') {
          const isActive = msg.feedback === 'down';
          if (isActive) {
            return {
              ...msg,
              feedback: undefined,
              feedbackDraft: undefined,
              feedbackComment: undefined,
              feedbackSubmitted: false,
            };
          }

          return {
            ...msg,
            feedback: 'down',
            feedbackDraft: msg.feedbackComment ?? msg.feedbackDraft ?? '',
          };
        }

        const isActive = msg.feedback === 'up';
        if (isActive) {
          return {
            ...msg,
            feedback: undefined,
            feedbackComment: undefined,
            feedbackDraft: undefined,
            feedbackSubmitted: false,
          };
        }

        return {
          ...msg,
          feedback: 'up',
          feedbackComment: undefined,
          feedbackDraft: undefined,
          feedbackSubmitted: false,
        };
      })
    );
  }

  protected handleFeedbackCommentChange(messageId: string, value: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id !== messageId || msg.pending || msg.feedback !== 'down') {
          return msg;
        }

        return { ...msg, feedbackDraft: value };
      })
    );
  }

  protected handleFeedbackSubmit(messageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id !== messageId || msg.pending || msg.feedback !== 'down') {
          return msg;
        }

        const comment = (msg.feedbackDraft ?? '').trim();
        return {
          ...msg,
          feedbackComment: comment.length > 0 ? comment : undefined,
          feedbackSubmitted: true,
        };
      })
    );
  }

  protected handleFeedbackEdit(messageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id !== messageId || msg.pending || msg.feedback !== 'down') {
          return msg;
        }

        return {
          ...msg,
          feedbackSubmitted: false,
          feedbackDraft: msg.feedbackComment ?? msg.feedbackDraft ?? '',
        };
      })
    );
  }

  protected handleFeedbackCancel(messageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id !== messageId || msg.pending) {
          return msg;
        }

        return {
          ...msg,
          feedback: undefined,
          feedbackDraft: undefined,
          feedbackComment: undefined,
          feedbackSubmitted: false,
        };
      })
    );
  }

  public resetConversation(): void {
    this.isSending.set(false);
    this.messages.set([]);
    this.updateThreadId(null);
    this.chatInput?.reset();
  }

    protected async handleCopy(content: string): Promise<void> {
      const value = content?.trim();
      if (!value) {
        return;
      }

      try {
        if ('clipboard' in navigator && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          return;
        }
      } catch (error) {
        console.error('Copy to clipboard failed', error);
      }

      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

  private extractReplyText(response: ChatAgentResponse | string): string {
    if (typeof response === 'string') {
      return response.trim();
    }

    const text =
      response.response ?? response.reply ?? response.message ?? response.content ?? '';
    return text.trim();
  }

  private extractThreadId(response: ChatAgentResponse | string): string | null {
    if (typeof response === 'string') {
      return null;
    }

    const thread = response.thread_id ?? (response['threadId'] as string | undefined);
    return thread && thread.length > 0 ? thread : null;
  }

  private updateThreadId(next: string | null): void {
    if (this.threadId() === next) {
      return;
    }

    this.threadId.set(next);
    this.threadChanged.emit(next);
  }

  private createMessage(role: ChatRole, content: string, pending = false): ChatMessage {
    return {
      id: this.nextId(),
      role,
      content,
      pending,
      createdAt: new Date(),
      feedback: undefined,
      feedbackComment: undefined,
      feedbackDraft: undefined,
      feedbackSubmitted: false,
    };
  }

  private nextId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 11);
  }

  private scrollToBottom(): void {
    if (!this.messageViewport) {
      return;
    }

    requestAnimationFrame(() => {
      const element = this.messageViewport?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  private resetGreetingAnimation(target: string): void {
    this.stopGreetingAnimation();
    this.greetingTargetText = target;

    if (this.prefersReducedMotion || !target) {
      this.animatedGreeting.set(target);
      return;
    }

    this.greetingIndex = 0;
    this.greetingDirection = 'forward';
    this.greetingHoldTicks = 0;
    this.animatedGreeting.set('');
    this.scheduleGreetingTick(200);
  }

  private stopGreetingAnimation(): void {
    if (this.greetingAnimationHandle !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.greetingAnimationHandle);
    }

    this.greetingAnimationHandle = null;
  }

  private scheduleGreetingTick(delay: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.greetingAnimationHandle !== null) {
      window.clearTimeout(this.greetingAnimationHandle);
    }

    this.greetingAnimationHandle = window.setTimeout(() => this.runGreetingTick(), delay);
  }

  private runGreetingTick(): void {
    const target = this.greetingTargetText;

    if (!target) {
      this.animatedGreeting.set('');
      return;
    }

    if (this.greetingDirection === 'forward') {
      if (this.greetingIndex < target.length) {
        this.greetingIndex += 1;
        this.animatedGreeting.set(target.slice(0, this.greetingIndex));
        this.scheduleGreetingTick(110);
        return;
      }

      if (this.greetingHoldTicks < 10) {
        this.greetingHoldTicks += 1;
        this.scheduleGreetingTick(160);
        return;
      }

      this.greetingDirection = 'backward';
      this.greetingHoldTicks = 0;
      this.scheduleGreetingTick(90);
      return;
    }

    if (this.greetingIndex > 0) {
      this.greetingIndex -= 1;
      this.animatedGreeting.set(target.slice(0, this.greetingIndex));
      this.scheduleGreetingTick(70);
      return;
    }

    if (this.greetingHoldTicks < 6) {
      this.greetingHoldTicks += 1;
      this.scheduleGreetingTick(200);
      return;
    }

    this.greetingDirection = 'forward';
    this.greetingHoldTicks = 0;
    this.scheduleGreetingTick(140);
  }
}
