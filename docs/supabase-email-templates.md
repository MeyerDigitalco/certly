# Certly email templates for Supabase

Paste each block into Supabase, Authentication, Emails, Templates. Set the
subject line above the body. Every template below is self-contained HTML
with inline styles, which is what mail clients need.

## The one rule that makes these work

The default Supabase template uses `{{ .ConfirmationURL }}`. Certly's client
uses the PKCE flow, so that link only works in the same browser the action
started in. Someone who signs up on a laptop and opens the email on their
phone gets "link expired".

Every template here uses this shape instead:

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=TYPE&next=PATH
```

That is verified server side, so it works from any device. `/auth/callback`
accepts only the six types used below and ignores anything else.

## Which of these are live

| Template | Status |
|---|---|
| Confirm sign up | **Live.** Every new workspace depends on it. |
| Reset password | **Live.** Used by the Forgot password page. |
| Password changed | **Turn on.** A real security control, currently off. |
| Invite user | Dormant. Certly invites through its own `/invite/<token>` link, which the owner copies and sends. |
| Magic link or OTP | Dormant. Certly uses passwords. |
| Change email address | Dormant. There is no change-email feature in the app yet. |
| Reauthentication | Dormant. |

Brand the dormant ones anyway. If one ever fires, an unstyled default from
an unfamiliar sender is the kind of mail people report as phishing.

---

## 1. Confirm sign up

**Subject:** `Confirm your Certly workspace`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">New workspace</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Confirm your email and your workspace opens.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          You asked to create a Certly workspace with this address. Confirm it and
          we will set the workspace up and take you straight in. Nothing is created
          until you do, so an address you do not own can never hold your company name.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/workspace"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Confirm and open my workspace
        </a>
      </td></tr>
      <tr><td style="padding:14px 32px 28px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#8E866F;">
          Button not working? Copy this into your browser:<br>
          <span style="color:#5C574B;word-break:break-all;font-family:'Courier New',monospace;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/workspace</span>
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5C574B;">
          Did not sign up? Ignore this email. No workspace is created and no one
          gains access to anything.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly, site access compliance for South African contractors.<br>
          Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2. Reset password

**Subject:** `Reset your Certly password`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Password reset</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Set a new password.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          Someone asked to reset the password on the Certly account for
          <b style="color:#16130E;">{{ .Email }}</b>. This link opens the page where
          you choose a new one. It expires, so use it now rather than later.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/set-password?change=1"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Choose a new password
        </a>
      </td></tr>
      <tr><td style="padding:14px 32px 28px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#8E866F;">
          Button not working? Copy this into your browser:<br>
          <span style="color:#5C574B;word-break:break-all;font-family:'Courier New',monospace;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/set-password?change=1</span>
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5C574B;">
          Did not ask for this? Ignore the email and your password stays as it is.
          If it keeps happening, reply and tell us.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 3. Password changed

Turn the toggle on under Security. This is the email that tells someone
their account was taken over.

**Subject:** `Your Certly password was changed`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Security</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Your password was changed.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          The password on the Certly account for <b style="color:#16130E;">{{ .Email }}</b>
          has just been changed. If that was you, there is nothing to do.
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #C41E1E;background:#F7F3E9;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0;font-size:14px;line-height:1.5;color:#16130E;">
              <b>If it was not you</b>, reset the password immediately at
              certly.co.za/forgot-password and tell the workspace owner. Your
              register holds identity numbers and medical certificates.
            </p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 4. Magic link or OTP

Dormant. Branded so it never goes out looking like spam.

**Subject:** `Your Certly sign-in link`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Sign in</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Sign in to Certly.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          This link signs you in as <b style="color:#16130E;">{{ .Email }}</b>. It works
          once and then expires.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/workspace"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Sign in
        </a>
        <p style="margin:18px 0 0;font-size:14px;color:#5C574B;">
          Or enter this code: <b style="color:#16130E;font-family:'Courier New',monospace;font-size:18px;letter-spacing:3px;">{{ .Token }}</b>
        </p>
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5C574B;">
          Did not ask to sign in? Ignore this. Nobody can use the link but you.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 5. Invite user

Dormant. Certly's own invitations come from the Settings page as a link the
owner sends. This template only fires if someone uses Supabase's admin invite
directly.

**Subject:** `You have been invited to a Certly workspace`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Invitation</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">You have been invited to Certly.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          Someone added <b style="color:#16130E;">{{ .Email }}</b> to their workspace.
          Accept and set a password to get in.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/set-password"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Accept the invitation
        </a>
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5C574B;">
          Not expecting this? Ignore it and nothing happens.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 6. Change email address

Dormant until the app offers it. If you turn on "Secure email change" in
Supabase, two emails go out and the one sent to the **new** address needs
`{{ .TokenHashNew }}` in place of `{{ .TokenHash }}`.

**Subject:** `Confirm your new Certly email address`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Email change</span>
      </td></tr>
      <tr><td style="padding:30px 32px 10px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Confirm the change.</h1>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#5C574B;">
          A request was made to move the Certly account from
          <b style="color:#16130E;">{{ .Email }}</b> to
          <b style="color:#16130E;">{{ .NewEmail }}</b>. Confirm it and sign-in moves
          to the new address.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/workspace"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Confirm the new address
        </a>
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5C574B;">
          Did not request this? Do not confirm, and change your password at once.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 7. Reauthentication

Dormant. A six digit code, no link.

**Subject:** `Your Certly confirmation code`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#16130E;text-transform:uppercase;">Certly</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Confirm it is you</span>
      </td></tr>
      <tr><td style="padding:30px 32px 26px;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#16130E;font-weight:800;">Confirmation code</h1>
        <p style="margin:16px 0 20px;font-size:15px;line-height:1.55;color:#5C574B;">
          Enter this code to confirm the action you just started.
        </p>
        <div style="background:#F7F3E9;border:1px solid #C9C0A9;padding:18px;text-align:center;">
          <span style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#16130E;">{{ .Token }}</span>
        </div>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8E866F;">
          Nobody from Certly will ever ask you for this code. If you did not start
          anything, ignore this email.
        </p>
      </td></tr>
      <tr><td style="padding:0 32px 22px;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#8E866F;">
          Certly &middot; Meyer Digital Co. &middot; certly.co.za
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## Before you test

1. Authentication, Providers, Email: **Confirm email** on.
2. Authentication, URL Configuration: Site URL `https://certly.co.za`, and
   `https://certly.co.za/auth/callback` in Redirect URLs. If Site URL is wrong,
   every `{{ .SiteURL }}` above points at the wrong place.
3. SMTP Settings pointed at Resend, sender `hello@certly.co.za`.
4. Authentication, Rate Limits: raise the email limit above the built-in default.

Then sign up in a private window with an address you can open on your phone,
and confirm the link works from a different device to the one you signed up on.
That is the specific failure these templates exist to avoid.
