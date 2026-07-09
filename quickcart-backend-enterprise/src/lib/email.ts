import nodemailer from "nodemailer";

/// SMTP-based email. Works with any SMTP provider (Postmark, SES SMTP,
/// SendGrid SMTP, even a plain Gmail app password for early testing) — no
/// vendor-specific SDK, so swapping providers is an env var change, not a
/// code change.
///
/// Unlike WhatsApp/push, a FAILED password-reset or verification email is
/// arguably more serious (the user is now stuck), so callers should check
/// the returned boolean and show the user an actual error rather than
/// silently pretending it worked — see routes/auth.ts for how it's used.
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn("SMTP not configured (SMTP_HOST unset) — skipping email:", params.subject);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "QuickCart <no-reply@quickcart.ng>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}
