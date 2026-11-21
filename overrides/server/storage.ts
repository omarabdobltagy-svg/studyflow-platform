import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageResult = { key: string; url: string };
type S3Config = { client: S3Client; bucket: string };
let cachedS3: S3Config | null = null;

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "").replace(/\\/g, "/");
  const segments = key.split("/");
  if (!key || segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage object path.");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getS3Config(): S3Config | null {
  const endpoint = process.env.STUDYFLOW_STORAGE_ENDPOINT?.trim();
  const bucket = process.env.STUDYFLOW_STORAGE_BUCKET?.trim();
  const region = process.env.STUDYFLOW_STORAGE_REGION?.trim();
  const accessKeyId = process.env.STUDYFLOW_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STUDYFLOW_STORAGE_SECRET_ACCESS_KEY?.trim();
  const configured = [endpoint, bucket, region, accessKeyId, secretAccessKey].filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== 5) {
    throw new Error("Incomplete StudyFlow storage configuration. Connect all five Railway bucket reference variables.");
  }
  if (cachedS3) return cachedS3;
  const parsed = new URL(endpoint!);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("StudyFlow storage endpoint must be HTTPS and must not contain embedded credentials.");
  }
  const urlStyle = process.env.STUDYFLOW_STORAGE_URL_STYLE?.trim().toLowerCase() || "path";
  if (urlStyle !== "path" && urlStyle !== "virtual-host") {
    throw new Error("STUDYFLOW_STORAGE_URL_STYLE must be 'path' or 'virtual-host'.");
  }
  cachedS3 = {
    bucket: bucket!,
    client: new S3Client({
      endpoint: parsed.origin,
      region: region!,
      forcePathStyle: urlStyle === "path",
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    }),
  };
  return cachedS3;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage is not configured. Connect a Railway S3 bucket using STUDYFLOW_STORAGE_* variables, or configure BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY.");
  }
  const normalizedUrl = forgeUrl.replace(/\/+$/, "");
  const parsed = new URL(normalizedUrl);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Storage API URL must use HTTPS and must not contain embedded credentials.");
  }
  return { forgeUrl: normalizedUrl, forgeKey };
}

async function forgeGetSignedUrl(key: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const response = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage signed URL failed (${response.status}): ${message}`);
  }
  const { url } = (await response.json()) as { url: string };
  if (!url) throw new Error("Storage provider returned an empty signed URL.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Storage download URL must be HTTPS and contain no embedded credentials.");
  }
  return parsed.toString();
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<StorageResult> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3 = getS3Config();
  if (s3) {
    const body = Buffer.from(data as any);
    await s3.client.send(new PutObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      CacheControl: "private, no-store",
    }));
    return { key, url: await storageGetSignedUrl(key) };
  }

  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResponse = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResponse.ok) {
    const message = await presignResponse.text().catch(() => presignResponse.statusText);
    throw new Error(`Storage presign failed (${presignResponse.status}): ${message}`);
  }
  const { url: signedUploadUrl } = (await presignResponse.json()) as { url: string };
  if (!signedUploadUrl) throw new Error("Storage provider returned an empty upload URL.");
  const destination = new URL(signedUploadUrl);
  if (destination.protocol !== "https:" || destination.username || destination.password) {
    throw new Error("Storage upload URL must be HTTPS and contain no embedded credentials.");
  }
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResponse = await fetch(destination, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResponse.ok) throw new Error(`Storage upload failed (${uploadResponse.status}).`);
  return { key, url: await forgeGetSignedUrl(key) };
}

export async function storageGet(relKey: string): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const s3 = getS3Config();
  if (s3) {
    return getSignedUrl(s3.client, new GetObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      ResponseCacheControl: "private, no-store",
    }), { expiresIn: 300 });
  }
  return forgeGetSignedUrl(key);
}
