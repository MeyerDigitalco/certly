/**
 * Describe configuration without printing it.
 *
 * A variable that exists in a hosting dashboard but holds an empty value
 * looks, from inside the application, exactly like one that was never set,
 * and looks in the dashboard exactly like one that works. That gap has twice
 * produced a feature that silently did nothing for weeks: a weekly digest
 * that never sent, and a scheduled job that refused every run.
 *
 * The answer is to say what arrived, by shape rather than by value, wherever
 * missing configuration turns a feature off. Never log the result of this on
 * a path a visitor can trigger: it is for scheduled jobs and admin surfaces,
 * where the reader is already trusted.
 */

export function describeEnv(names: string[]): string {
  return names.map((name) => `${name}=${envShape(name)}`).join(" ");
}

export function envShape(name: string): string {
  const raw = process.env[name];
  if (raw === undefined) return "absent";

  const trimmed = raw.trim();
  if (!trimmed) {
    return raw.length === 0
      ? "blank"
      : `blank (${raw.length} characters of whitespace)`;
  }

  const padding = raw.length - trimmed.length;
  return padding > 0
    ? `${trimmed.length} characters (plus ${padding} of whitespace)`
    : `${trimmed.length} characters`;
}
