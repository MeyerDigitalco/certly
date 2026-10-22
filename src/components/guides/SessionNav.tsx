"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The right-hand end of the guide masthead. Guides are static pages, so
 * the server cannot know who is reading. The browser can: a Supabase
 * session leaves a cookie prefixed "sb-", so a signed-in reader gets
 * "Your workspace" and a stranger gets "Sign in" and "Start free". Until
 * the effect runs, and whenever the cookie cannot be read, the stranger's
 * version renders, which is also what every crawler sees.
 */
export default function SessionNav() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    try {
      setSignedIn(/(^|;\s*)sb-[^=]+-auth-token(\.\d+)?=/.test(document.cookie));
    } catch {
      setSignedIn(false);
    }
  }, []);

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
