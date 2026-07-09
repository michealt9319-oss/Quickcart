/// Flutterwave as a fallback when Paystack initialization fails (or when
/// FLUTTERWAVE_PRIMARY=true, as the primary). Kept in a separate file with
/// the same function shape as lib/paystack.ts intentionally — routes/payments.ts
/// depends on that shape, not on which provider is behind it, so swapping
/// primary/fallback is a config change, not a rewrite.
const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  currency?: string;
}) {
  const res = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amountNaira,
      currency: params.currency || "NGN",
      redirect_url: params.callbackUrl,
      customer: { email: params.email },
    }),
  });

  if (!res.ok) {
    throw new Error(`Flutterwave initialize failed: ${res.status}`);
  }

  const data = (await res.json()) as any;
  return {
    authorizationUrl: data.data.link as string,
    reference: params.reference,
  };
}

// Flutterwave signs webhooks with a static "verif-hash" header compared
// against your dashboard-configured secret hash — a simpler scheme than
// Paystack's HMAC, but still non-optional to check.
export function verifyWebhookSignature(signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH) return false;
  return signatureHeader === process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
}

export async function refundTransaction(params: { flutterwaveTransactionId: string }): Promise<void> {
  const res = await fetch(`${FLUTTERWAVE_BASE_URL}/transactions/${params.flutterwaveTransactionId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Flutterwave refund failed (${res.status}): ${body}`);
  }
}

// Flutterwave's refund endpoint wants THEIR internal transaction id, not
// our tx_ref (the reference we generate and store). This looks it up via
// their verify-by-reference endpoint first — refundTransaction above can't
// be called with just our reference alone.
export async function findTransactionIdByReference(txRef: string): Promise<string> {
  const res = await fetch(
    `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  if (!res.ok) {
    throw new Error(`Flutterwave transaction lookup failed (${res.status})`);
  }
  const data = (await res.json()) as any;
  return String(data.data.id);
}

export function isConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}
