import Link from "next/link";

import { getDb, isFirestoreEnabled } from "@/lib/firebase";
import type { MenuData } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MenuRow = {
  id: string;
  restaurantName: string;
  source: string;
  dishCount: number;
  createdAt: string;
  sourceUrl: string | null;
  data: MenuData;
};

type DishRow = {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  imageUrl: string;
  createdAt: string;
};

async function loadData(): Promise<{ menus: MenuRow[]; dishes: DishRow[]; error: string | null }> {
  if (!isFirestoreEnabled()) {
    return { menus: [], dishes: [], error: "Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local." };
  }
  const db = getDb();
  if (!db) return { menus: [], dishes: [], error: "Could not get Firestore handle." };

  try {
    const [menusSnap, dishesSnap] = await Promise.all([
      db.collection("menus").orderBy("createdAt", "desc").limit(200).get(),
      db.collection("dishes").orderBy("createdAt", "desc").limit(500).get()
    ]);

    const menus: MenuRow[] = menusSnap.docs.map((doc) => {
      const raw = doc.data() as { data: MenuData; source: string; createdAt: { toMillis(): number } };
      // Recover URL from doc id if it's a URL-based key (encoded "/" -> "__").
      const id = doc.id;
      let sourceUrl: string | null = null;
      if (id.startsWith("url:")) {
        const rest = id.slice(4).replace(/__/g, "/");
        sourceUrl = `https://${rest}`;
      }
      return {
        id,
        restaurantName: raw.data?.restaurantName || "(unknown)",
        source: raw.source || "unknown",
        dishCount: raw.data?.dishes?.length || 0,
        createdAt: raw.createdAt ? new Date(raw.createdAt.toMillis()).toLocaleString() : "",
        sourceUrl,
        data: raw.data
      };
    });

    const dishes: DishRow[] = dishesSnap.docs.map((doc) => {
      const raw = doc.data() as {
        name?: string;
        description?: string;
        ingredients?: string[];
        imageUrl?: string;
        createdAt?: { toMillis(): number };
      };
      return {
        id: doc.id,
        name: raw.name || "(no name)",
        description: raw.description || "",
        ingredients: raw.ingredients || [],
        imageUrl: raw.imageUrl || "",
        createdAt: raw.createdAt ? new Date(raw.createdAt.toMillis()).toLocaleString() : ""
      };
    });

    return { menus, dishes, error: null };
  } catch (err) {
    return { menus: [], dishes: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export default async function AdminPage(): Promise<React.ReactElement> {
  const { menus, dishes, error } = await loadData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/60">Admin</p>
          <h1 className="display-font text-4xl text-ink">Cache Inspector</h1>
          <p className="mt-1 text-sm text-ink/70">
            {menus.length} cached menus · {dishes.length} cached dishes
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink shadow"
        >
          Home
        </Link>
      </header>

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ink">Restaurants ({menus.length})</h2>
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/5 text-xs uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-3 py-2">Restaurant</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Dishes</th>
                <th className="px-3 py-2">Cached At</th>
                <th className="px-3 py-2">Doc ID / URL</th>
              </tr>
            </thead>
            <tbody>
              {menus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink/60">
                    No menus cached yet.
                  </td>
                </tr>
              ) : (
                menus.map((m) => (
                  <tr key={m.id} className="border-t border-ink/10 align-top">
                    <td className="px-3 py-2 font-medium text-ink">{m.restaurantName}</td>
                    <td className="px-3 py-2 text-ink/70">{m.source}</td>
                    <td className="px-3 py-2 text-ink/70">{m.dishCount}</td>
                    <td className="px-3 py-2 text-ink/60">{m.createdAt}</td>
                    <td className="px-3 py-2 text-xs">
                      {m.sourceUrl ? (
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 underline"
                        >
                          {m.sourceUrl}
                        </a>
                      ) : (
                        <span className="text-ink/50">{m.id}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Dishes ({dishes.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.length === 0 ? (
            <p className="text-sm text-ink/60">No dishes cached yet.</p>
          ) : (
            dishes.map((d) => (
              <article key={d.id} className="overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-card">
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-ink/5 text-xs text-ink/50">
                    no image
                  </div>
                )}
                <div className="space-y-1 p-3">
                  <h3 className="font-medium text-ink">{d.name}</h3>
                  {d.description ? <p className="text-xs text-ink/70 line-clamp-3">{d.description}</p> : null}
                  {d.ingredients.length > 0 ? (
                    <p className="text-[11px] text-ink/55">{d.ingredients.slice(0, 6).join(" · ")}</p>
                  ) : null}
                  <p className="pt-1 text-[10px] text-ink/40">{d.createdAt}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
