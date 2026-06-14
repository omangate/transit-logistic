export interface AuthUser {
  id: string;
  email: string;
  role: string;
  locale: string;
  phone: string | null;
  isVerified: boolean;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'customer' | 'fleet_owner';
  fullName?: string;
  phone?: string;
  locale?: 'en' | 'ar';
}
