"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

/**
 * The right-hand end of the guide masthead. Guides are static pages, so
 * the server cannot know who is reading. The browser can: a Supabase
 * session leaves a cookie prefixed "sb-", so a signed-in reader gets
 * "Your workspace" and a stranger gets "Sign in" and "Start free".
 *
 * Read through useSyncExternalStore rather than an effect, so the server
 * snapshot and the first client render agree and there is no flash of the
 * wrong nav. The cookie does not announce changes, so the subscription is
 * empty: the value is read once per mount, which is all this needs. A
 * crawler, and any browser where the cookie cannot be read, gets the
 * stranger's version.
 */
const AUTH_COOKIE = /(^|;\s*)sb-[^=]+-auth-token(\.\d+)?=/;

function subscribe(): () => void {
  return () => {};
}

function hasSession(): boolean {
  try {
    return AUTH_COOKIE.test(document.cookie);
  } catch {
    return false;
  }
}

export default function SessionNav() {
  const signedIn = useSyncExternalStore(subscribe, hasSession, () => false);

  if (signedIn) {
    return (
      <Link className="btn" href="/workspace">
        Your workspace
      </Link>
    );
  }
  return (
    <>
      <Link href="/login">Sign in</Link>
      <Link className="btn" href="/signup">
        Start free
      </Link>
    </>
  );
}
