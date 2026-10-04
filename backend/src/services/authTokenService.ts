import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

export const AUTH_COOKIE_NAME = 'print_exam_session';

export interface AccessTokenPayload {
  id: number;
  username: string;
  role: string;
  sessionVersion: number;
  pending2FA?: false;
}
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' });
}

function cookieSecurityAttributes(): string {
  const production = process.env.NODE_ENV === 'production';
  const configured = String(process.env.AUTH_COOKIE_SAME_SITE || (production ? 'none' : 'lax')).toLowerCase();
  const sameSite = configured === 'strict' ? 'Strict' : configured === 'none' ? 'None' : 'Lax';
  return `HttpOnly; Path=/; Max-Age=43200; SameSite=${sameSite}${production ? '; Secure' : ''}`;
}

export function setAuthCookie(res: Response, token: string): void {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieSecurityAttributes()}`);
}

export function clearAuthCookie(res: Response): void {
  const production = process.env.NODE_ENV === 'production';
  const configured = String(process.env.AUTH_COOKIE_SAME_SITE || (production ? 'none' : 'lax')).toLowerCase();
  const sameSite = configured === 'strict' ? 'Strict' : configured === 'none' ? 'None' : 'Lax';
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=${sameSite}${production ? '; Secure' : ''}`
  );
}

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}
