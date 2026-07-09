> **Starting template, not a finished legal document.** Drafted to match what this codebase
> actually collects and stores (see schema.sql) so it's accurate rather than generic — but it
> has not been reviewed by a lawyer and does not address NDPR (Nigeria Data Protection
> Regulation) or any other jurisdiction's specific requirements in full. Have that review done
> before publishing this.

# Privacy Policy

**Last updated: [DATE]**

## What we collect

| Data | Why | Where it's stored |
|---|---|---|
| Phone number | Identifies your order and delivery; used for WhatsApp/push notifications | `customers` table |
| Name, delivery address | Fulfilling your order | `customers`, `orders` tables |
| Email (optional) | Payment receipt | `orders` table |
| Order contents and history | Order fulfilment, your own order-history lookup | `orders` table |
| Push notification device token (if you enable notifications in our app) | Sending you delivery updates | `device_tokens` table |
| Payment card details | We never see or store these — payment is processed entirely by [Paystack/Flutterwave] | Not stored by us at all |

## Why we collect it

We use this data solely to process and deliver your order, communicate with you about it
(confirmation, status updates), and — only if you've provided an email — send a payment
receipt. We do not sell your data, and we do not use it for advertising.

## Who we share it with

- **[Paystack/Flutterwave]**, to process payment. They receive your email and payment details
  directly; we never see or store your card number.
- **The partner supermarket fulfilling your order**, who receives your order contents and
  delivery address to prepare and hand off your order.
- **Our delivery riders**, who receive your delivery address and phone number to complete
  delivery.
- We do not share your data with anyone else, and we do not sell it.

## How long we keep it

Order records are retained for [X years] for accounting and tax purposes, even if you later
request deletion of your personal data — this matches standard practice under data protection
law, which permits retaining data where there's a legitimate legal basis (accounting
obligations) separate from the personal-data portion of a record.

## Your rights

You can ask us to:
- **Export** a copy of everything we hold about you, tied to your phone number.
- **Delete** your personal data (name, address, phone number, device tokens) — your order
  history is anonymized rather than deleted outright, for the retention reason above.

To make either request, contact us at [contact email/WhatsApp number]. [If you operate under
NDPR, GDPR, or a similar regime, a lawyer needs to confirm the exact response timeline you're
legally required to meet — commonly 30 days, but verify for your jurisdiction.]

## Security

We take reasonable technical measures to protect your data, including encrypted connections,
hashed passwords for staff accounts, and role-based access controls limiting which staff can
see what. No system is perfectly secure, and we can't guarantee absolute security.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected in the
"Last updated" date above.

## Contact

Questions about this policy or your data: [contact email/WhatsApp number].
