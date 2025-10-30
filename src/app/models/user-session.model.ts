export interface UserSession {
  username: string;
  displayName?: string | null;
  email?: string | null;
  provider?: 'password' | 'microsoft';
}
