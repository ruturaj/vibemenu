import { createHash } from "crypto";

import type { ParseInput } from "@/types";

/**
 * Deterministic cache key for an incoming menu request.
 * - Known URL: normalized URL (host + path) so the same restaurant page always hits.
 * - Text: sha256 of the trimmed text.
 * - Image: sha256 of the base64 payload.
 */
export function menuCacheKey(input: ParseInput): string | null {
  if (input.inputType === "url" && input.url) {
    try {
      const u = new URL(input.url);
      const normalized = `${u.host}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
      return `url:${normalized}`;
    } catch {
      return null;
    }
  }
  if (input.inputType === "text" && input.text) {
    return `text:${createHash("sha256").update(input.text.trim()).digest("hex").slice(0, 32)}`;
  }
  if (input.inputType === "image" && input.imageBase64) {
    return `image:${createHash("sha256").update(input.imageBase64).digest("hex").slice(0, 32)}`;
  }
  return null;
}

export function dishKey(name: string): string {
  return createHash("sha256").update(name.toLowerCase().trim()).digest("hex").slice(0, 24);
}
