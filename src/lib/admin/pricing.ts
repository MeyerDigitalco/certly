/**
 * What a workspace pays, from its headcount.
 *
 * The billing screen quotes this and the operator console totals it, so it
 * lives apart from both. Pure, with no server imports, so the arithmetic is
 * testable on its own.
 */

export const BASE_RANDS = 999;
export const INCLUDED_PEOPLE = 50;
export const PER_EXTRA_PERSON_RANDS = 10;

export function monthlyRands(people: number): number {
  const extra = Math.max(0, people - INCLUDED_PEOPLE);
  return BASE_RANDS + extra * PER_EXTRA_PERSON_RANDS;
}
