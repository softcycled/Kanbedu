import { Storage } from "@google-cloud/storage";

function getStorage() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GCS_SERVICE_ACCOUNT_JSON is not set");
  return new Storage({ credentials: JSON.parse(raw) });
}

function getBucket() {
  const name = process.env.GCS_BUCKET_NAME;
  if (!name) throw new Error("GCS_BUCKET_NAME is not set");
  return getStorage().bucket(name);
}

export async function uploadToGCS(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await getBucket().file(objectPath).save(buffer, { contentType });
}

export async function getSignedUrl(objectPath: string): Promise<string> {
  const [url] = await getBucket().file(objectPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

export async function deleteFromGCS(objectPath: string): Promise<void> {
  await getBucket().file(objectPath).delete({ ignoreNotFound: true });
}
