import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  currency?: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100), // smallest currency unit (kobo for NGN, cents for USD, etc.)
      reference: params.reference,
      callback_url: params.callbackUrl,
      // Only include if set — omitting it lets Paystack use the merchant
      // account's default currency, which is the right behavior for
      // tenants that haven't set an explicit currency override.
      ...(params.currency ? { currency: params.currency } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Paystack initialize failed: ${res.status}`);
  }

  const data = (await res.json()) as any;
  return {
    authorizationUrl: data.data.authorization_url as string,
    reference: data.data.reference as string,
  };
}

export function isConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

// Verifies the HMAC-SHA512 signature Paystack attaches to webhook requests.
// This is the only thing standing between "a customer paid" and "someone
// forged a request that looks like a payment" — never skip it.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

// Note: Paystack's refund endpoint takes their transaction reference, not
// an amount by default (full refund unless you pass `amount`). This issues
// a full refund — partial refunds are a real feature some orders will
// eventually need (damaged item, one missing product) but aren't wired up
// here; add an `amountNaira` param through to this call when that need
// actually comes up.
export async function refundTransaction(params: { reference: string }): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: params.reference }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Paystack refund failed (${res.status}): ${body}`);
  }
}
