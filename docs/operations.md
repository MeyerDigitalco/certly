# Running Certly

What a deployment needs, what breaks it, and what the failures look like from
outside. Written after a week spent finding most of it the hard way.

Certly is a multi-tenant HR compliance register for South African contractors.
Next.js 16 on Vercel, Supabase Postgres with row level security, PayFast for
payments, Resend for mail.

---

## Environment variables

Set in Vercel for Production, Preview and Development. **A changed variable
does nothing until the deployment is rebuilt.** More than one afternoon has
gone into debugging code that was behaving correctly against a value that had
not shipped yet.

**A variable listed in the dashboard is not necessarily a variable with a
value in it.** Three features were silently switched off for over a month by
variables that were present, correctly named, correctly scoped, and empty:
the scheduled jobs, the weekly digest, and the PayFast passphrase. Nothing in
the hosting UI distinguishes a blank value from a working one, and from inside
the application an empty string is indistinguishable from an unset variable
unless something looks.

So when missing configuration turns a feature off, say which piece is missing.
`describeEnv` in `src/lib/env-shape.ts` reports any variable as `absent`,
`blank` or a character count, never its value, and is safe to log from a
scheduled job or an admin surface. Use it on every new integration rather than
failing quietly, because a feature that does nothing and says nothing is the
most expensive failure in this codebase so far.

### Required

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Public, RLS does the work. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Server only. Never commit it, never expose it to the browser. |
| `CERTLY_PUBLIC_ORIGIN` | `https://certly.co.za`. The origin used in emailed links. Never derived from request headers in production, because a Host header is attacker controlled and a reset link built from one points the victim at the attacker. |

### Payments

| Variable | What it is |
|---|---|
| `PAYFAST_MERCHANT_ID` | From the PayFast dashboard. |
| `PAYFAST_MERCHANT_KEY` | Secret, despite sitting inside the signature string. |
| `PAYFAST_PASSPHRASE` | Must match the PayFast account exactly. No leading or trailing space. |
| `PAYFAST_SANDBOX` | `false` for live. The code tests `=== "true"`, so anything else is live, but write `false` so the intent is readable. |

### Mail and jobs

| Variable | What it is |
|---|---|
| `RESEND_API_KEY` | Sends the weekly digest. Supabase sends auth mail through Resend SMTP separately. |
| `CERTLY_EMAIL_FROM` | Verified sending address, `hello@certly.co.za`. Mail is skipped entirely if unset. |
| `CERTLY_EMAIL_REPLY_TO` | Optional. |
| `CRON_SECRET` | Vercel sends it as a bearer token. **Unset means every scheduled job refuses and nothing runs.** |

### Optional

| Variable | Default | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Certificate reading. Without it the scan feature reports as unavailable. |
| `CERTLY_EXTRACTION_MODEL` | `claude-sonnet-5` | Model used for extraction. |
| `DEFAULT_DUE_SOON_DAYS` | `30` | How far ahead a certificate counts as due. |
| `CERTLY_PLATFORM_ADMINS` | empty | Comma separated emails of Certly staff, not tenant owners. |
| `CERTLY_BASE_PRICE_CENTS` | list price | Lowers the base price for a live payment test. See below. |

### The test price override

`CERTLY_BASE_PRICE_CENTS=900` makes the base plan R9 a month so the payment
path can be tested against the real gateway for small money. It can only ever
lower the price, never raise it, never below R1, and only accepts plain
digits, so a mistyped value falls back to the list price rather than charging
someone R9990.

**Delete it and redeploy the moment the test is done.** The public marketing
copy hardcodes R999, so while the override is live the site advertises one
price and charges another. A forgotten test price is how a SaaS bills its
first real customer R9 a month forever.

---

## Database

Migrations live in `supabase/migrations/` and run in order. They are not
applied automatically; run them in the Supabase SQL editor.

| | |
|---|---|
| `0001` to `0008` | Schema, identification, documents, billing, register view, invitations, import |
| `0009` | Employee lifecycle, labour plans, onboarding candidates |
| `0010` | Employment equity and skills columns, training plans, absences |
| `0011` | Security hardening. Revokes `PUBLIC EXECUTE` on definer functions, adds the billing column guard and child-row org triggers |
| `0012` | Sector profile, mining versus general |
| `0013` | Compliance snapshots for the score trend |
| `0014` | Rate limits for paid endpoints |

Three storage buckets, all private, all with per-organisation path prefixes:
`certificates`, `identity-documents`, `company-documents`. The policies key on
the first path segment being the organisation id, so the prefix is
load-bearing rather than cosmetic.

### Tenant isolation

Every query and mutation takes an explicit `orgId` and filters on
`organisation_id`. RLS alone is not treated as sufficient, because a user can
belong to more than one organisation and a missing filter would read across
them.

`src/lib/hr/tenant-isolation.test.ts` enforces this by reading the source. It
also reads `supabase/migrations/` and fails if a table with an
`organisation_id` column is missing from `TENANT_TABLES`, so the list cannot
silently fall behind the schema. Deliberate cross-organisation reads go in the
named allowlists with a reason.

### POPIA

Health and disciplinary records are not captured at all. Population group,
gender and disability are stored only as the employee's own EEA1 declaration
and are never inferred. The statutory report pages and exports are admin only
for this reason: they name individuals alongside that declaration, which is
section 26 special personal information.

---

## PayFast

The integration is a signed form post, a redirect, and a server to server
notification. Each part failed for a different reason during setup, and none
of the failures said what was wrong.

### Account setup

1. **ITN must be enabled on the account.** Settings, Notifications, Instant
   Transaction Notification. The `notify_url` posted with the form is ignored
   when ITN is switched off account-wide, and it is off by default. This is
   silent: the payment succeeds, the customer is charged, and nothing ever
   reaches the application.
2. Notify URL: `https://certly.co.za/api/payfast/notify`
3. The passphrase on the account must match `PAYFAST_PASSPHRASE` exactly.

### Content Security Policy

`form-action` in `next.config.ts` must allow every host PayFast redirects
through:

```
form-action 'self' https://payfast.co.za https://*.payfast.co.za https://payfast.io https://*.payfast.io
```

`form-action` governs the whole navigation a form submission starts, redirects
included. PayFast answers `/eng/process` with a 302 and the flow spans two
domains, `payfast.co.za` and `payfast.io`, with customers sent between them by
geolocation. Listing only the host the form posts to lets the POST succeed and
then kills the redirect with no error visible on the page: the button sits on
"Opening PayFast..." forever. Both domains are listed with and without a
wildcard, because a wildcard does not match the bare domain.

A 302 on `/eng/process` in the Network tab means PayFast **accepted** the form.
If the page then does nothing, the problem is this header, not the signature.

### Two different signatures

The payment form and the notification follow different rules, and conflating
them cost the most time of anything here.

**Payment form.** Fields hashed in the order posted, PHP `urlencode` encoding,
empty values dropped, passphrase appended last. Values of `"0"` are kept;
only empty strings are dropped.

**Notification.** Same encoding, but **empty fields are included**. A
notification carries all ten `custom_*` fields whether the merchant used them
or not, so most arrive empty. Dropping them produces a hash that can never
match, which presents as "signature mismatch" on every single notification
while the payment form works perfectly.

`matchNotificationSignature` accepts three encodings and logs which matched:
`kept_empty` (observed in production, what PayFast actually does),
`dropped_empty` (the payment-form rule, retained defensively) and `raw` (the
body hashed exactly as received, which sidesteps any question of whether
decoding and re-encoding a value round trips). All three require the
passphrase, so accepting more than one weakens nothing.

### Duplicate notifications

PayFast may send the same notification twice. The second is refused, because
PayFast's own validate endpoint declines to confirm a notification it has
already confirmed. This is harmless and logs as
`refused: PayFast did not confirm the notification`. The handler is also
idempotent on `pf_payment_id`, so nothing double applies.

### Cancellation depends on the token

The in-app cancel calls PayFast's merchant API using `organisations.payfast_token`,
which is stored by the notification handler on a `COMPLETE`. **If the
notification never arrived, there is no token, and the cancel silently returns
success without reaching PayFast while the debit order keeps running.**

Before trusting an in-app cancellation on a new deployment:

```sql
select slug, plan, subscription_status,
       case when payfast_token is null then 'MISSING' else 'stored' end as token,
       billed_amount_cents, current_period_end
from organisations where slug = '<slug>';
```

`MISSING` means cancel in the PayFast dashboard instead.

### Reading a failure

The handler always answers 200, deliberately: telling a caller which check it
failed is free help to an attacker, and a non-200 only makes PayFast retry
something already refused. Every refusal is logged instead. In Vercel's runtime
logs, filter on `payfast.notify`:

| Line | Meaning |
|---|---|
| `signature ok via kept_empty` then `applied: COMPLETE ... token=stored` | Working |
| `refused: signature mismatch ... passphrase_set=yes` | `PAYFAST_PASSPHRASE` does not match the PayFast account |
| `refused: PayFast did not confirm the notification` | Validate call failed, or a duplicate |
| `refused: short payment` | Amount below the recomputed quote. Compare the logged paid and expected figures |
| nothing at all | PayFast is not calling. ITN disabled, or the notify URL is wrong |

A refused notification is final, because the 200 stops PayFast retrying.
Proving a fix needs a fresh transaction.

---

## Mail

Two separate paths, worth keeping straight.

**Authentication mail** is sent by Supabase through Resend SMTP: signup
confirmation, password reset, invitations to an existing account. Configure
SMTP under Supabase, Project Settings, Authentication. The templates are in
`docs/supabase-email-templates.md` and must be pasted into Supabase by hand.

They use `{{ .TokenHash }}` rather than `{{ .ConfirmationURL }}` so the link
works through `/auth/callback`. Note that when the signup was initiated by a
PKCE client the token is prefixed `pkce_`, which needs a verifier stored in
the browser that started the signup. Confirming on a different device is
therefore worth testing explicitly rather than assuming.

Also required in Supabase: confirm email on, Site URL `https://certly.co.za`,
and `/auth/callback` in the redirect allow list.

**Application mail** is the weekly expiry digest, and it is the only email the
application itself sends. There is no payment receipt, no welcome mail, and
invitations produce a link the owner copies rather than an email.

`digestIsWorthSending` skips any workspace with nothing expiring, so a quiet
run reports success having sent nothing. That makes the digest a poor way to
prove mail works. Use a real signup to a major provider instead, and check
which folder it lands in: Resend reporting "Delivered" means the receiving
server accepted it, not that it reached an inbox.

DNS on the sending domain: SPF, DKIM through Resend, and a DMARC record.

---

## Scheduled jobs

`vercel.json`:

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/digest` | `0 4 * * 1` | Weekly expiry digest to owners and admins |
| `/api/cron/reconcile-seats` | `0 3 1 * *` | Monthly, updates PayFast recurring amounts to match headcount |

Both authorise on `CRON_SECRET` as a bearer header only, never a query string,
because a secret in a URL lands in access logs. Both read every workspace under
the service role, so the secret is the only thing separating one customer's
people from another's. An unset secret refuses everything, which fails closed
but also means the jobs silently never run.

They answer **404** rather than 401 on a bad secret. Triggering the digest by
hand from Vercel and getting a 404 means the secret does not match.

The Hobby plan caps the project at two cron jobs, which is exactly what is
configured. Adding a third needs a paid plan.

---

## Deploying

```powershell
Set-Location C:\src\certly
npm run verify
git add -A
git commit -m "..."
git push
```

`npm run verify` runs typecheck, lint, the test suite and a production build.
It must be clean before pushing. Four lint warnings are known and accepted;
there should be zero errors.

Never run `npm audit fix --force`. It downgrades ExcelJS to a version that
breaks every statutory export. The two remaining moderate advisories are
`uuid` inside ExcelJS and are not worth that trade.

`.env.local` must never be committed. It holds the service role key. Check
with `git ls-files | Select-String "\.env"` before pushing.

---

## What is still manual

- Migrations are applied by hand in the Supabase SQL editor
- Supabase email templates are pasted by hand
- Promoting an owner and removing a user is SQL
- There is no staging environment; production is the only deployment

---

## Things that look broken and are not

- **Reports return 404 for a viewer.** Deliberate. Statutory reports are admin
  only because they carry EEA1 declarations.
- **An anonymous request to `/<org>/hr` returns 200 with a loading shell**
  rather than a redirect, because `[org]/loading.tsx` streams before
  `requireTenant` runs. No tenant data is in that shell; the redirect resolves
  in the browser.
- **The digest reports success having sent nothing.** Correct when nothing is
  expiring.
- **A second PayFast notification is refused.** Correct, see above.
