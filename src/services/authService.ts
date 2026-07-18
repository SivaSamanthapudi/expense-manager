import { apiClient } from './apiClient';
import { AuthUser } from '../types';

export interface LoginPayload {
  identifier: string; // email or mobile number
  password: string;
}

export interface SignupPayload {
  name: string;
  email?: string;
  mobile?: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  message: string;
  field?: string;
}

export const parseApiError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (
      err as { response?: { data?: { error?: string; message?: string } } }
    ).response;
    if (res?.data?.error) return res.data.error;
    if (res?.data?.message) return res.data.message;
  }
  // if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
};

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async signup(payload: SignupPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      '/auth/signup',
      payload
    );
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>('/auth/me');
    return data;
  },

  async relink(): Promise<{ memberLinkStatus: string }> {
    const { data } = await apiClient.post<{ memberLinkStatus: string }>(
      '/auth/relink'
    );
    return data;
  },

  async updateProfile(payload: {
    name?: string;
    email?: string;
    mobile?: string;
    avatar?: string;
  }): Promise<{ user: AuthUser }> {
    const { data } = await apiClient.patch<{ user: AuthUser }>(
      '/auth/me',
      payload
    );
    return data;
  },

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await apiClient.patch('/auth/me/password', {
      currentPassword,
      newPassword,
    });
  },

  async forgotPassword(
    identifier: string
  ): Promise<{ message: string; devOtp?: string }> {
    const { data } = await apiClient.post<{ message: string; devOtp?: string }>(
      '/auth/forgot-password',
      { identifier }
    );
    return data;
  },

  async resetPassword(
    identifier: string,
    otp: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(
      '/auth/reset-password',
      { identifier, otp, newPassword }
    );
    return data;
  },
};
