// Shared strict request-body validation for Edge Functions.
// Rejects malformed JSON, oversized payloads, prototype-pollution keys,
// unknown properties and wrongly-typed values before they reach the DB.

export class RequestValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

const DEFAULT_MAX_BYTES = 32 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function assertNoForbiddenKeys(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new RequestValidationError('Invalid property name in request body');
    }
  }
}

export async function readJsonObject(
  req: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<Record<string, unknown>> {
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > maxBytes) {
    throw new RequestValidationError('Payload too large', 413);
  }

  const text = await req.text().catch(() => '');
  if (!text.trim()) throw new RequestValidationError('Empty request body');
  if (text.length > maxBytes) throw new RequestValidationError('Payload too large', 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestValidationError('Malformed JSON body');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RequestValidationError('Request body must be a JSON object');
  }

  const body = parsed as Record<string, unknown>;
  assertNoForbiddenKeys(body);
  return body;
}

export function parseJsonObjectText(
  text: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Record<string, unknown> {
  if (!text.trim()) throw new RequestValidationError('Empty payload');
  if (text.length > maxBytes) throw new RequestValidationError('Payload too large', 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestValidationError('Malformed JSON payload');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RequestValidationError('Payload must be a JSON object');
  }

  const body = parsed as Record<string, unknown>;
  assertNoForbiddenKeys(body);
  return body;
}

export function rejectUnknownKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (!allowedSet.has(key)) {
      throw new RequestValidationError(`Unexpected property: ${key}`);
    }
  }
}

type StringOptions = {
  min?: number;
  max?: number;
  pattern?: RegExp;
  trim?: boolean;
};

function validateString(
  value: unknown,
  field: string,
  options: StringOptions,
): string {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${field} must be a string`);
  }
  const normalized = options.trim === false ? value : value.trim();
  const min = options.min ?? 1;
  const max = options.max ?? 256;
  if (normalized.length < min || normalized.length > max) {
    throw new RequestValidationError(`${field} must be ${min}-${max} characters`);
  }
  if (options.pattern && !options.pattern.test(normalized)) {
    throw new RequestValidationError(`${field} has an invalid format`);
  }
  return normalized;
}

export function requireString(
  value: unknown,
  field: string,
  options: StringOptions = {},
): string {
  if (value === undefined || value === null || value === '') {
    throw new RequestValidationError(`${field} is required`);
  }
  return validateString(value, field, options);
}

export function optionalString(
  value: unknown,
  field: string,
  options: StringOptions = {},
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return validateString(value, field, options);
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new RequestValidationError(`${field} must be a boolean`);
  }
  return value;
}

export const ID_PATTERN = /^[A-Za-z0-9._-]+$/;
export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
export const HEX_PATTERN = /^[A-Fa-f0-9]{8,128}$/;

export function validationErrorResponse(
  err: unknown,
  headers: Record<string, string>,
): Response {
  const isValidation = err instanceof RequestValidationError;
  const message = isValidation ? err.message : 'Invalid request payload';
  const status = isValidation ? err.status : 400;

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
