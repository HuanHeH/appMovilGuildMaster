export type AppRole = 'Admin' | 'Teacher' | 'Student';

export interface LoginResponse {
  id: number;
  name: string;
  mail: string;
  role: AppRole;
  access_token: string;
  token_type: 'Bearer';
}

export interface AuthSession {
  id: number;
  name: string;
  mail: string;
  role: AppRole;
  accessToken: string;
}
