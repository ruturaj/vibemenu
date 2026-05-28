import { createHash } from "crypto";

import { getStorageBucket } from "@/lib/firebase";

/**
 * Uploads a PNG (raw bytes) to Firebase Storage at `dish-images/<hash>.png`
 * and returns a public download URL. Returns null if Storage is not configured.
 */
export async function uploadGeneratedImage(
  pngBytes: Buffer,
  filenameSeed: string
): Promise<string | null> {
  const bucket = getStorageBucket();
  if (!bucket) return null;

  const hash = createHash("sha256").update(pngBytes).digest("hex").slice(0, 16);
  const safeSeed = filenameSeed.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "dish";
  const path = `dish-images/${safeSeed}-${hash}.png`;

  try {
    const file = bucket.file(path);
    await file.save(pngBytes, {
      metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
      resumable: false
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`;
  } catch (err) {
    console.warn("[image-storage] upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function dataUrlToPngBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/(?:png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}
