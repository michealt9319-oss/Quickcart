import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/// Generates a short-lived presigned URL the CLIENT uploads directly to —
/// the file bytes never pass through this API. This is the standard
/// pattern for file uploads in a stateless API: avoids needing multipart
/// parsing, temp disk storage, or streaming large files through your own
/// server's memory/bandwidth.
///
/// Works with AWS S3 directly, or any S3-compatible provider (Cloudflare
/// R2, DigitalOcean Spaces, MinIO for local dev) by setting S3_ENDPOINT.
export function isConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);
}

function getClient(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
}

export async function createPresignedUpload(params: {
  organizationId: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!isConfigured()) {
    throw Object.assign(new Error("Image upload is not configured (missing S3_BUCKET / AWS credentials)"), {
      status: 501,
    });
  }

  const extension = params.contentType.split("/")[1] || "jpg";
  const key = `products/${params.organizationId}/${randomUUID()}.${extension}`;

  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes to complete the upload
  const publicUrl = process.env.S3_PUBLIC_BASE_URL
    ? `${process.env.S3_PUBLIC_BASE_URL}/${key}`
    : `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl };
}
