/// Optional. If SECRETS_MANAGER_ARN is set, fetches a JSON secret from AWS
/// Secrets Manager at startup and merges its keys into process.env —
/// letting production secrets (PAYSTACK_SECRET_KEY, JWT_SECRET, SMTP
/// credentials, etc.) live in Secrets Manager instead of a plaintext .env
/// file or plaintext environment variables in your hosting platform's
/// dashboard.
///
/// Deliberately NOT required: every existing env var still works exactly
/// as before if SECRETS_MANAGER_ARN is unset — this doesn't change local
/// development at all. Existing environment variables take precedence over
/// values from the secret (so a value already set locally, e.g. for a
/// quick override, isn't silently clobbered) — only env vars that are
/// currently empty/unset get filled in from the secret.
///
/// The secret itself must be a flat JSON object of key-value pairs, e.g.:
///   { "JWT_SECRET": "...", "PAYSTACK_SECRET_KEY": "...", "SMTP_PASSWORD": "..." }
export async function loadSecretsIntoEnv(): Promise<void> {
  const arn = process.env.SECRETS_MANAGER_ARN;
  if (!arn) return;

  try {
    // Required lazily so a deployment that never sets SECRETS_MANAGER_ARN
    // doesn't need the AWS SDK installed correctly configured to even boot.
    const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || process.env.S3_REGION || "us-east-1" });
    const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));

    if (!result.SecretString) {
      console.warn("Secrets Manager returned no SecretString for", arn);
      return;
    }

    const secrets = JSON.parse(result.SecretString) as Record<string, string>;
    let loaded = 0;
    for (const [key, value] of Object.entries(secrets)) {
      if (!process.env[key]) {
        process.env[key] = value;
        loaded++;
      }
    }
    console.log(`Loaded ${loaded} secret(s) from Secrets Manager into environment`);
  } catch (err) {
    // Fail loudly but don't crash startup — a Secrets Manager outage
    // shouldn't take down an app that might still work with whatever env
    // vars are already set directly on the host.
    console.error("Failed to load secrets from Secrets Manager:", err);
  }
}
