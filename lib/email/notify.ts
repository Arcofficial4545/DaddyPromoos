import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Emails a contact-form submission to the site owner using Resend's REST API
 * (no SDK dependency — just a fetch). It no-ops and returns false when
 * RESEND_API_KEY is not configured, so the contact form keeps working in dev
 * or before email is set up; the message is always persisted regardless.
 *
 * Env:
 *  - RESEND_API_KEY      (required to actually send)
 *  - CONTACT_TO_EMAIL    (defaults to the owner inbox below)
 *  - CONTACT_FROM_EMAIL  (defaults to Resend's shared onboarding sender)
 */
export async function sendContactNotification(
  payload: ContactPayload,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL ?? "arcoffical1@gmail.com";
  const from =
    process.env.CONTACT_FROM_EMAIL ?? "DaddyPromoos <onboarding@resend.dev>";

  if (!apiKey) return false;

  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br>");

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        // Hitting "Reply" in your inbox goes straight to the sender.
        reply_to: payload.email,
        subject: `New contact message from ${payload.name}`,
        text: `Name: ${payload.name}\nEmail: ${payload.email}\n\nMessage:\n${payload.message}`,
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0b1f17">
            <h2 style="margin:0 0 12px">New contact message</h2>
            <p style="margin:0"><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
            <p style="margin:0 0 12px"><strong>Email:</strong>
              <a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a>
            </p>
            <div style="padding:12px 16px;background:#ecf9ee;border-radius:8px">${safeMessage}</div>
          </div>`,
      }),
    });
    return res.ok;
  } catch {
    // Never let an email failure break the form submission.
    return false;
  }
}
