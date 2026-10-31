/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Look up an account by email address.
 *
 * Supabase exposes no filtered query for auth users, so this pages through
 * the list. Kept in one place because the answer decides whether somebody is
 * shown a sign in screen or a create your password screen, and getting it
 * wrong in either direction is how a person ends up locked out of an
 * invitation they were sent.
 */

export interface AuthUserRef {
  id: string;
  email: string | null;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export async function findAuthUserByEmail(
  admin: any,
  email: string,
): Promise<AuthUserRef | null> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    const users = (data?.users ?? []) as AuthUserRef[];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (users.length < PAGE_SIZE) return null;
  }
  return null;
}
