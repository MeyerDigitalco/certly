/**
 * Outbound email.
 *
 * Certly has no verified sending domain yet, so this is deliberately built to
 * do nothing useful and fail quietly until one exists. Every caller gets a
 * result object rather than an exception, and a missing API key is reported as
 * "skipped", not as an error, because a workspace's weekly digest not going
 * out must never take down the job that produced it.
 *
 * Resend is called over its REST API rather than through its SDK, which keeps
 * one fewer dependency in a project that has already had a dependency go bad.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendOutcome =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
}

export function emailConfig(): EmailConfig | null {
  // Trimmed, because pasting into a hosting dashboard is how a trailing
  // newline gets into a value, and a newline in a From header is a malformed
  // message rather than an obvious error.
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CERTLY_EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.CERTLY_EMAIL_REPLY_TO?.trim() || undefined,
  };
}

export function emailIsConfigured(): boolean {
  return emailConfig() !== null;
}

export async function sendEmail(message: EmailMessage): Promise<SendOutcome> {
  const config = emailConfig();
  if (!config) {
    return {
      status: "skipped",
      reason: "No sending domain is configured on this deployment.",
    };
  }

  if (!message.to || !message.to.includes("@")) {
    return { status: "skipped", reason: "No usable address." };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo ?? config.replyTo,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        status: "failed",
        reason: `${response.status} ${body.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return { status: "sent", id: data.id ?? "" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Network error",
    };
  }
}
