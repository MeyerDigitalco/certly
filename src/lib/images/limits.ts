/**
 * The largest file an upload can carry.
 *
 * Server actions are capped by next.config, and the hosting platform caps the
 * request body again at around four and a half megabytes whatever the
 * framework is configured to allow. Three and a half leaves room for the
 * multipart boundaries, part headers and field metadata that travel with the
 * file, so a file that passes this check is not refused further up.
 *
 * Shared so that the browser can refuse a file with a sentence the person can
 * act on, rather than letting it fail somewhere that produces an error page.
 */
export const UPLOAD_LIMIT_BYTES = 3.5 * 1024 * 1024;
