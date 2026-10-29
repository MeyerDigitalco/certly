"use client";

import { useRef, useTransition } from "react";

/**
 * useTransition that cannot be started twice over.
 *
 * Disabling a button on the pending flag stops the ordinary double click,
 * because the second press lands long after React has committed. It does not
 * stop two presses inside the same frame, and it does nothing at all for a
 * resubmitted form or a retried request.
 *
 * Where the write has a natural key, the database settles it and this is not
 * needed. Where it has none, as with company documents, two documents may
 * legitimately share a title and there is nothing for a constraint to catch,
 * so the guard has to be here. The ref is checked and set in the same tick,
 * before any await, so a second call cannot slip between the check and the
 * set, and it is released in a finally so a failed write does not leave the
 * form wedged.
 */
export function useGuardedTransition(): [
  boolean,
  (run: () => Promise<void>) => void,
] {
  const [pending, startTransition] = useTransition();
  const running = useRef(false);

  function start(run: () => Promise<void>): void {
    if (running.current) return;
    running.current = true;

    startTransition(async () => {
      try {
        await run();
      } finally {
        running.current = false;
      }
    });
  }

  return [pending, start];
}
