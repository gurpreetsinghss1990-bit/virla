export const INPUT_LIMITS = {
  name: 60,
  email: 254,
  phone: 20,
  shortLine: 120,
  address: 250,
  bio: 800,
  message: 2000,
  otp: 6,
  ifsc: 11,
  upi: 60,
  bankAccount: 18,
} as const;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MULTI_SPACE = /[ \t]{2,}/g;

export function cleanSingleLine(value: string, max: number): string {
  return value.replace(CONTROL_CHARS, '').replace(MULTI_SPACE, ' ').trim().slice(0, max);
}

export function cleanMultiline(value: string, max: number): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(MULTI_SPACE, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function digitsOnly(value: string, max: number = INPUT_LIMITS.phone): string {
  return value.replace(/\D/g, '').slice(0, max);
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function isValidEmail(value: string): boolean {
  const v = cleanSingleLine(value, INPUT_LIMITS.email);
  return v.length > 3 && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v);
}

export function cleanEmail(value: string): string {
  return value.replace(/\s/g, '').toLowerCase().slice(0, INPUT_LIMITS.email);
}

export function clampInt(value: string, max = 6): string {
  return value.replace(/\D/g, '').slice(0, max);
}

export function cleanOtp(value: string): string {
  return digitsOnly(value, INPUT_LIMITS.otp);
}

export function cleanIfsc(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INPUT_LIMITS.ifsc);
}

export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc(value));
}

export function cleanUpi(value: string): string {
  return value.replace(/\s/g, '').toLowerCase().slice(0, INPUT_LIMITS.upi);
}

export function isValidUpi(value: string): boolean {
  return /^[\w.\-]{2,64}@[a-z]{2,32}$/.test(cleanUpi(value));
}
