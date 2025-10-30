import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatAgentRequestPayload, ChatAgentResponse } from '../models/chat-agent.model';
import { AuthService } from './auth.service';
import { UserSession } from '../models/user-session.model';

@Injectable({ providedIn: 'root' })
export class ChatAiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = environment.aiApiUrl;
  private readonly authService = inject(AuthService);

  sendMessage(
    message: string,
    options: { threadId?: string; userId?: string } = {}
  ): Observable<ChatAgentResponse | string> {
    const resolvedUserId = options.userId ?? this.resolveActiveUserId();

    if (!resolvedUserId) {
      return throwError(() => new Error('Cannot send chat request without an authenticated user.'));
    }

    const payload: ChatAgentRequestPayload = {
      query: message,
      user_id: resolvedUserId,
    };

    if (options.threadId) {
      payload.thread_id = options.threadId;
    }

    return this.http.post<ChatAgentResponse | string>(this.endpoint, payload);
  }

  private resolveActiveUserId(): string | null {
    const session = this.authService.currentUser();
    return this.resolveUserIdentifier(session ?? undefined);
  }

  private resolveUserIdentifier(session?: UserSession): string | null {
    if (!session) {
      return null;
    }

    const candidateUsername = session.username?.trim();
    if (candidateUsername) {
      return candidateUsername;
    }

    const candidateEmail = session.email?.trim();
    if (candidateEmail) {
      return candidateEmail;
    }

    return null;
  }
}
