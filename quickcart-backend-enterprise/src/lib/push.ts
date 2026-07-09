import { query } from "../db";

/// Sends push notifications via Firebase Cloud Messaging's legacy HTTP
/// server-key API. This is the simpler of Google's two APIs to integrate
/// (one bearer token, one HTTP call) but Google has been steering new
/// Firebase projects toward the HTTP v1 API (OAuth2 service-account auth)
/// and the legacy API's long-term availability is not guaranteed for new
/// projects. If FCM_SERVER_KEY isn't available to you, migrate this file to
/// the v1 API — the send() call is isolated here specifically so that
/// migration only touches one file.
///
/// Like WhatsApp notifications, this is entirely best-effort: a missing
/// config or a failed send is logged and swallowed, never allowed to break
/// order processing.
async function send(token: string, title: string, body: string): Promise<boolean> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.warn("FCM_SERVER_KEY not set — skipping push notification.");
    return false;
  }

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
      }),
    });
    if (!res.ok) {
      console.error(`FCM send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("FCM send threw an error:", err);
    return false;
  }
}

/// Looks up every device registered for a phone number within an
/// organization and pushes to all of them (a customer may have the app on
/// more than one device). Silently does nothing if no device is registered
/// — most customers order via WhatsApp/web only and have never opened the
/// app, which is the expected common case, not an error.
export async function sendPushToPhone(params: {
  organizationId: string;
  phone: string;
  title: string;
  body: string;
}): Promise<void> {
  const devices = await query<{ push_token: string }>(
    `SELECT push_token FROM device_tokens WHERE organization_id = $1 AND phone = $2`,
    [params.organizationId, params.phone]
  );

  for (const device of devices) {
    await send(device.push_token, params.title, params.body);
  }
}
