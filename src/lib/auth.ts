import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export interface DriverSessionPayload {
  driverId: string;
  tenantId: string;
  prefixo: string;
  name: string;
  phone: string;
  plate?: string | null;
  role: 'DRIVER';
}

export interface OperatorTokenPayload {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
}

export interface DriverSsoIncomingPayload {
  tenant_id: string;
  prefixo: string;
  driver_external_id: string;
  timestamp: number; // UNIX epoch timestamp
}

// Passwords
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

// Operator JWT
export function signOperatorToken(payload: OperatorTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyOperatorToken(token: string): OperatorTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as OperatorTokenPayload;
  } catch {
    return null;
  }
}

// Driver Session JWT (short lived, e.g. 2 hours or renewed during activity)
export function signDriverSessionToken(payload: DriverSessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '4h' });
}

export function verifyDriverSessionToken(token: string): DriverSessionPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as DriverSessionPayload;
  } catch {
    return null;
  }
}

// Driver In-App SSO JWT verification using DRIVER_SSO_SECRET
export function verifyDriverSsoToken(token: string): DriverSsoIncomingPayload {
  const decoded = jwt.verify(token, env.DRIVER_SSO_SECRET) as DriverSsoIncomingPayload;

  if (!decoded.tenant_id || !decoded.prefixo || !decoded.timestamp) {
    throw new Error('Payload SSO inválido: campos obrigatórios ausentes.');
  }

  // Check 5 minutes expiration limit
  // Support both seconds and milliseconds timestamp
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const tokenTimeInSeconds = decoded.timestamp > 10000000000 ? Math.floor(decoded.timestamp / 1000) : decoded.timestamp;
  const timeDifferenceSeconds = Math.abs(nowInSeconds - tokenTimeInSeconds);

  // If older than 5 minutes (300 seconds)
  if (timeDifferenceSeconds > 300) {
    throw new Error('Token SSO expirado. O token é válido por no máximo 5 minutos.');
  }

  return decoded;
}

// Helper to generate a test driver SSO token for testing/demo
export function generateTestDriverSsoToken(
  tenantId: string,
  prefixo: string,
  externalId: string = 'ext-9999'
): string {
  const payload: DriverSsoIncomingPayload = {
    tenant_id: tenantId,
    prefixo: prefixo,
    driver_external_id: externalId,
    timestamp: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, env.DRIVER_SSO_SECRET, { expiresIn: '10m' });
}
