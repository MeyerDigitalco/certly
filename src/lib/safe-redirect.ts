const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const PROTOCOL_RELATIVE = /^[/\\]{2}/;

/**
 * Reduce a caller-supplied "next" value to a path on this site.
 *
 * The value reaches us from a query string or a hidden form field, so it is
 * attacker-controlled. Anything absolute, protocol-relative, or carrying a
 * scheme is discarded rather than sanitised, because a half-cleaned redirect
 * target is still a redirect target.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 512) return fallback;
  if (CONTROL_CHARS.test(trimmed)) return fallback;
  if (!trimmed.startsWith("/")) return fallback;
  if (PROTOCOL_RELATIVE.test(trimmed)) return fallback;

  return trimmed;
}
