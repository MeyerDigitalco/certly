/**
 * Shared between the form and the action.
 *
 * In their own file because a "use server" module may export nothing but
 * async functions, so a constant the client needs cannot live beside the
 * action that enforces it.
 */

export const MIN_LENGTH = 5;
export const MAX_LENGTH = 4000;

export const SUGGESTION_BUCKET = "suggestion";
export const SUGGESTIONS_PER_HOUR = 10;
