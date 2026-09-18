/* eslint-disable no-console -- Centralized error diagnostics funnel. This is the
 * only module allowed to touch console.*; everything else uses logError so
 * lint stays clean while server/client error telemetry is preserved. */

export function logError(message: string, ...args: unknown[]): void {
  console.error(message, ...args);
}
