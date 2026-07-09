import { sendEmail } from "./email";

/// Fires when something needs a human's attention soon — currently just
/// webhook processing failures, but built generically so other failure
/// classes can use it later. Two channels, either or both configurable:
/// - OPS_ALERT_EMAIL: a plain email via the existing SMTP config
/// - SLACK_ALERT_WEBHOOK_URL: an incoming webhook URL for a Slack channel
///
/// Deliberately best-effort like every other notification in this
/// codebase — an alerting failure must never throw back into the code path
/// that was already handling a failure. That would be the worst possible
/// place for a second, unrelated crash.
export async function alertOps(params: { subject: string; message: string }): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (process.env.OPS_ALERT_EMAIL) {
    tasks.push(
      sendEmail({
        to: process.env.OPS_ALERT_EMAIL,
        subject: `[QuickCart alert] ${params.subject}`,
        html: `<pre>${params.message}</pre>`,
      })
    );
  }

  if (process.env.SLACK_ALERT_WEBHOOK_URL) {
    tasks.push(
      fetch(process.env.SLACK_ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${params.subject}*\n${params.message}` }),
      })
    );
  }

  if (tasks.length === 0) {
    console.warn(`No alerting configured (OPS_ALERT_EMAIL / SLACK_ALERT_WEBHOOK_URL) — alert dropped: ${params.subject}`);
    return;
  }

  try {
    await Promise.all(tasks);
  } catch (err) {
    console.error("Failed to send ops alert:", err);
  }
}
