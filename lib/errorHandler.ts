// lib/errorHandler.ts
/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Read the human message out of a parsed API failure payload.
 *
 * Our routes answer failures two ways: legacy `{ error: "text" }` and the
 * shared envelope `{ success: false, error: { code, message } }` from
 * lib/api. Reading `.error` as a string on an envelope yields the object
 * itself, which `new Error(...)` stringifies to "[object Object]" — every
 * failed submit then reads as gibberish. This accepts both shapes (plus a
 * top-level `message`) and falls back honestly.
 */
export function readApiError(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const nested = record.error;
    if (typeof nested === 'string' && nested) return nested;
    if (nested && typeof nested === 'object') {
      const message = (nested as Record<string, unknown>).message;
      if (typeof message === 'string' && message) return message;
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }
  return fallback;
}
