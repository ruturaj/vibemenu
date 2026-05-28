import { admin, getDb } from "@/lib/firebase";

const COLLECTION = "dishes";
// Cosine distance: 0 = identical, 2 = polar opposite. <= 0.08 ≈ >96% similarity.
const STRONG_MATCH_DISTANCE = 0.08;

type StoredDish = {
  name: string;
  description?: string;
  ingredients?: string[];
  imageUrl: string;
  embedding: unknown;
  createdAt: admin.firestore.Timestamp;
};

export type DishMatch = {
  imageUrl: string;
  name: string;
  distance: number;
};

export async function findSimilarDish(vector: number[]): Promise<DishMatch | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const query = db
      .collection(COLLECTION)
      .findNearest({
        vectorField: "embedding",
        queryVector: admin.firestore.FieldValue.vector(vector),
        limit: 1,
        distanceMeasure: "COSINE",
        distanceResultField: "_distance"
      });

    const snap = await query.get();
    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data() as StoredDish & { _distance?: number };
    const distance = typeof data._distance === "number" ? data._distance : Number.POSITIVE_INFINITY;

    if (distance > STRONG_MATCH_DISTANCE) return null;
    if (!data.imageUrl) return null;

    return { imageUrl: data.imageUrl, name: data.name, distance };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface FAILED_PRECONDITION (missing index) loudly so the dev creates the index.
    if (/FAILED_PRECONDITION|index/i.test(msg)) {
      console.warn(
        "[dish-cache] vector index missing. Create it with the gcloud command in spec/vectordb.md."
      );
    } else {
      console.warn("[dish-cache] knn failed:", msg);
    }
    return null;
  }
}

export async function saveDish(payload: {
  name: string;
  description?: string;
  ingredients?: string[];
  imageUrl: string;
  vector: number[];
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection(COLLECTION).add({
      name: payload.name,
      description: payload.description || "",
      ingredients: payload.ingredients || [],
      imageUrl: payload.imageUrl,
      embedding: admin.firestore.FieldValue.vector(payload.vector),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.warn("[dish-cache] write failed:", err instanceof Error ? err.message : err);
  }
}
