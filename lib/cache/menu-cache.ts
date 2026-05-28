import { admin, getDb } from "@/lib/firebase";
import type { MenuData } from "@/types";

const COLLECTION = "menus";
// Cache lives for 24h; refresh after that so menu edits propagate.
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredMenu = {
  data: MenuData;
  source: string;
  createdAt: admin.firestore.Timestamp;
};

export async function getCachedMenu(key: string): Promise<MenuData | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const doc = snap.data() as StoredMenu;
    const age = Date.now() - doc.createdAt.toMillis();
    if (age > TTL_MS) return null;
    return doc.data;
  } catch (err) {
    console.warn("[menu-cache] read failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function saveCachedMenu(
  key: string,
  data: MenuData,
  source: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection(COLLECTION).doc(key).set({
      data,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.warn("[menu-cache] write failed:", err instanceof Error ? err.message : err);
  }
}
