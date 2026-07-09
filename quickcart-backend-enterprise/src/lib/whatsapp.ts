/// WhatsApp Business Cloud API integration.
///
/// Important: Meta only allows free-form text messages to a customer within
/// a 24-hour window after they last messaged your business number. Anything
/// sent outside that window — which includes most order status updates,
/// since "with_rider" might happen hours after checkout — MUST use a
/// pre-approved message template, or the send will fail. This module only
/// implements the template path for that reason; there is deliberately no
/// "just send a text" fallback that would work in testing and then break
/// once a real order crosses the 24-hour boundary in production.
///
/// Before this works, create and get approval for these templates in
/// Meta Business Manager (WhatsApp Manager → Message Templates):
///
///   order_confirmed        "Hi! Your QuickCart order {{1}} has been
///                          confirmed and is being prepared."
///   order_packing          "Your QuickCart order {{1}} is being packed
///                          now."
///   order_with_rider       "Your QuickCart order {{1}} is on its way!"
///   order_delivered        "Your QuickCart order {{1}} has been
///                          delivered. Enjoy!"
///
/// Template approval typically takes anywhere from a few minutes to a
/// couple of days the first time — factor that into your launch timeline,
/// don't leave it until the day before soft launch.
const WHATSAPP_API_VERSION = "v20.0";

const TEMPLATE_BY_STATUS: Record<string, string> = {
  confirmed: "order_confirmed",
  packing: "order_packing",
  with_rider: "order_with_rider",
  delivered: "order_delivered",
};

interface SendResult {
  sent: boolean;
  reason?: string;
}

async function sendTemplateMessage(params: {
  toPhone: string;
  templateName: string;
  bodyParams: string[];
}): Promise<SendResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    // Deliberately non-fatal: a missing WhatsApp config should never break
    // order processing or payment confirmation. Log and move on — this is
    // the "Week 5" integration, not something that should be able to break
    // Week 1-4 functionality if it isn't configured yet.
    console.warn("WhatsApp not configured — skipping notification. Set WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable.");
    return { sent: false, reason: "not_configured" };
  }

  // WhatsApp expects the phone number in international format without a
  // leading '+' or any spaces/dashes, e.g. "2348012345678". Normalize here
  // so the rest of the app can keep storing whatever format the customer
  // typed in at checkout.
  const normalizedPhone = params.toPhone.replace(/[^\d]/g, "").replace(/^0/, "234");

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: params.bodyParams.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`WhatsApp send failed (${res.status}): ${body}`);
      return { sent: false, reason: `http_${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    // Never let a WhatsApp API outage take down order processing.
    console.error("WhatsApp send threw an error:", err);
    return { sent: false, reason: "exception" };
  }
}

/// Called after an order's status changes to one of the four notifiable
/// states. Silently does nothing for statuses without a template mapped
/// (e.g. "pending", "cancelled") — add templates for those too if you want
/// to notify on cancellation.
export async function notifyOrderStatus(params: {
  customerPhone: string;
  orderNumber: string;
  status: string;
}): Promise<SendResult> {
  const templateName = TEMPLATE_BY_STATUS[params.status];
  if (!templateName) {
    return { sent: false, reason: "no_template_for_status" };
  }

  return sendTemplateMessage({
    toPhone: params.customerPhone,
    templateName,
    bodyParams: [params.orderNumber],
  });
}
