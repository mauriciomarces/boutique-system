import type {
  AuthMessageResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "../types/auth.types";

const API_BASE_URL = "/api/users/auth";

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      "Ocurrió un error al comunicarse con el servidor.";

    throw new Error(message);
  }

  return data as T;
}

export async function login(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  return request<LoginResponse>("/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function register(
  data: RegisterRequest,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyEmail(
  data: VerifyEmailRequest,
): Promise<AuthMessageResponse> {
  return request<AuthMessageResponse>("/verify-email", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resendVerification(
  correo: string,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/resend-verification", {
    method: "POST",
    body: JSON.stringify({ correo }),
  });
}

export async function forgotPassword(
  data: ForgotPasswordRequest,
): Promise<AuthMessageResponse> {
  return request<AuthMessageResponse>("/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resetPassword(
  data: ResetPasswordRequest,
): Promise<AuthMessageResponse> {
  return request<AuthMessageResponse>("/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  return request<RefreshResponse>("/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });
}

export async function logout(
  refreshToken: string,
): Promise<AuthMessageResponse> {
  return request<AuthMessageResponse>("/logout", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });
}

export async function getCurrentUser(
  accessToken: string,
): Promise<AuthUser> {
  return request<AuthUser>("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
