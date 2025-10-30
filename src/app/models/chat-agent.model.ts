export type ChatAgentRole = 'user' | 'assistant';

export interface ChatAgentRequestPayload {
  query: string;
  user_id: string;
  thread_id?: string;
}

export interface ChatAgentResponse {
  status?: string;
  response?: string;
  reply?: string;
  message?: string;
  content?: string;
  thread_id?: string;
  [key: string]: unknown;
}
