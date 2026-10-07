export interface AuthUser {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  estado: string;
  roles?: Array<{
    id: string | number;
    nombre: string;
    descripcion?: string | null;
    estado?: string;
  }>;
  usuario_rol: unknown[];
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface RegisterRequest {
  nombre: string;
  apellido: string;
  correo: string;
  telefono?: string;
  contrasena: string;
}

export interface RegisterResponse {
  message: string;
  user?: AuthUser;
  dev_verification_code?: string;
}

export interface VerifyEmailRequest {
  correo: string;
  codigo: string;
}

export interface ForgotPasswordRequest {
  correo: string;
}

export interface ResetPasswordRequest {
  correo: string;
  codigo: string;
  nueva_contrasena: string;
}

export interface AuthMessageResponse {
  message: string;
}

export interface RefreshResponse {
  access_token: string;
}
