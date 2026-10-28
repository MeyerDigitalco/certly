"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Editable state that follows a prop when the prop changes underneath it.
 *
 * Every inline field on a report keeps a local draft so typing is not thrown
 * away on each keystroke, and still has to pick up a new server value when
 * the row is revalidated. That was written as an effect calling setState,
 * which React now flags, because an effect that sets state renders the stale
 * value first and then immediately renders again.
 *
 * This is React's documented alternative: compare the prop to the one last
 * seen during render and adjust there. The extra render still happens, but it
 * happens before anything is committed to the DOM, so the stale value is
 * never shown and there is no cascading effect.
 */
export function useSyncedDraft<T>(
  value: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState<T>(value);
  const [seen, setSeen] = useState<T>(value);

  if (!Object.is(seen, value)) {
    setSeen(value);
    setDraft(value);
  }

  return [draft, setDraft];
}
