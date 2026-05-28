"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";

import { DishDetailSheet } from "@/components/dish-detail-sheet";
import { MenuCard } from "@/components/menu-card";
import { useMenuStore, type ImageQueueEntry } from "@/store/useMenuStore";

const MAX_CONCURRENT = 2;
const MAX_IMAGES = 10;

async function generateImage(
  dish: { id: string; name: string; alternateName?: string; description: string; ingredients: string[]; visualPrompt: string },
  keys: { openai: string; replicate: string }
): Promise<{ imageUrl?: string; warning?: string; error?: string; fatal?: boolean }> {
  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Provider-OpenAI-Key": keys.openai,
        "X-Provider-Replicate-Key": keys.replicate
      },
      body: JSON.stringify({
        dishName: dish.name,
        alternateName: dish.alternateName,
        dishDescription: dish.description,
        ingredients: dish.ingredients,
        visualPrompt: dish.visualPrompt
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      imageUrl?: string;
      warning?: string;
      error?: string;
      fatal?: boolean;
      code?: string;
    };

    if (!response.ok) {
      return {
        error: payload.error || `HTTP ${response.status}`,
        fatal: payload.fatal === true || response.status === 401 || response.status === 403 || response.status === 429
      };
    }

    return payload;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

export default function MenuPage(): React.ReactElement {
  const router = useRouter();
  const {
    menu,
    keys,
    source,
    patchDish,
    selectedDishId,
    setSelectedDishId,
    imageQueue,
    setImageQueue,
    updateQueueEntry
  } = useMenuStore();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showQueue, setShowQueue] = useState<boolean>(true);
  const [showSource, setShowSource] = useState<boolean>(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const startedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!menu) {
      router.replace("/");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const queue: ImageQueueEntry[] = menu.dishes
      .filter((dish) => !dish.imageUrl)
      .slice(0, MAX_IMAGES)
      .map((dish) => ({ dishId: dish.id, dishName: dish.name, status: "pending" }));
    setImageQueue(queue);

    let index = 0;
    let aborted = false;
    const dishesById = new Map(menu.dishes.map((dish) => [dish.id, dish]));

    async function worker(): Promise<void> {
      while (!aborted) {
        const current = index;
        index += 1;
        if (current >= queue.length) return;
        const entry = queue[current];
        const dish = dishesById.get(entry.dishId);
        if (!dish) continue;

        updateQueueEntry(entry.dishId, { status: "in-progress" });
        const result = await generateImage(dish, keys);

        if (aborted) return;

        if (result.imageUrl) {
          patchDish(dish.id, { imageUrl: result.imageUrl });
          updateQueueEntry(entry.dishId, { status: "done" });
        } else {
          updateQueueEntry(entry.dishId, { status: "error", error: result.error || result.warning });
          if (result.fatal) {
            aborted = true;
            setFatalError(result.error || "OpenAI API error. Queue stopped.");
            return;
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, () => worker());
    void Promise.all(workers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    if (!menu) return ["All"];
    return ["All", ...Array.from(new Set(menu.dishes.map((dish) => dish.category)))];
  }, [menu]);

  const visibleDishes = useMemo(() => {
    if (!menu) return [];
    if (activeCategory === "All") return menu.dishes;
    return menu.dishes.filter((dish) => dish.category === activeCategory);
  }, [activeCategory, menu]);

  const chefPicks = useMemo(() => {
    if (!menu) return [];
    return menu.dishes.filter((dish) => menu.chefPicks.includes(dish.id)).slice(0, 4);
  }, [menu]);

  const selectedDish = useMemo(() => {
    if (!menu || !selectedDishId) return null;
    return menu.dishes.find((dish) => dish.id === selectedDishId) || null;
  }, [menu, selectedDishId]);

  const queueStats = useMemo(() => {
    const done = imageQueue.filter((entry) => entry.status === "done").length;
    const errored = imageQueue.filter((entry) => entry.status === "error").length;
    const inFlight = imageQueue.filter((entry) => entry.status === "in-progress").length;
    const total = imageQueue.length;
    return { done, errored, inFlight, total, remaining: total - done - errored };
  }, [imageQueue]);

  if (!menu) {
    return <main className="p-6 text-center text-ink">Loading...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/60">Visual Feast</p>
          <h1 className="display-font text-4xl text-ink sm:text-5xl">{menu.restaurantName}</h1>
          <p className="mt-1 text-sm text-ink/70">{menu.dishes.length} dishes parsed</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink shadow"
        >
          New Menu
        </button>
      </header>

      {fatalError ? (
        <section className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Image generation stopped</p>
          <p className="mt-1">{fatalError}</p>
        </section>
      ) : null}

      {source ? (
        <section className="mb-4 rounded-2xl border border-white/60 bg-white/85 p-3 shadow-card">
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <FileText className="h-4 w-4 text-ink/60" />
              Original menu ({source.kind})
            </span>
            <span className="text-xs text-ink/60">{showSource ? "Hide" : "Show"}</span>
          </button>
          {showSource ? (
            <div className="mt-3">
              {source.kind === "image" && source.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source.imageDataUrl}
                  alt="Original menu"
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : null}
              {source.kind === "url" && source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-coral underline"
                >
                  {source.url}
                </a>
              ) : null}
              {source.kind === "text" && source.text ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-ink/5 p-3 text-xs text-ink/80">
                  {source.text}
                </pre>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {queueStats.total > 0 ? (
        <section className="mb-4 rounded-2xl border border-white/60 bg-white/85 p-3 shadow-card">
          <button
            type="button"
            onClick={() => setShowQueue((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              {queueStats.remaining > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-coral" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-mint" />
              )}
              Image queue: {queueStats.done}/{queueStats.total} done
              {queueStats.errored > 0 ? (
                <span className="text-rose-600">· {queueStats.errored} failed</span>
              ) : null}
            </span>
            <span className="text-xs text-ink/60">{showQueue ? "Hide" : "Show"}</span>
          </button>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-coral transition-[width] duration-300"
              data-progress={Math.round((queueStats.done / Math.max(1, queueStats.total)) * 100)}
              style={{ width: `${Math.round((queueStats.done / Math.max(1, queueStats.total)) * 100)}%` }}
            />
          </div>

          {showQueue ? (
            <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1 text-xs">
              {imageQueue.map((entry) => (
                <li key={entry.dishId} className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-ink/80">{entry.dishName}</span>
                  <span className="inline-flex items-center gap-1">
                    {entry.status === "pending" ? <span className="text-ink/50">queued</span> : null}
                    {entry.status === "in-progress" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-coral" />
                        <span className="text-coral">generating</span>
                      </>
                    ) : null}
                    {entry.status === "done" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-mint" />
                        <span className="text-mint">done</span>
                      </>
                    ) : null}
                    {entry.status === "error" ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-rose-600" />
                        <span className="line-clamp-1 max-w-[160px] text-rose-600" title={entry.error}>
                          {entry.error || "error"}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mb-5">
        <p className="mb-2 text-sm font-semibold text-ink">Chef&apos;s AI Picks</p>
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          {chefPicks.map((dish) => (
            <button
              type="button"
              key={dish.id}
              onClick={() => setSelectedDishId(dish.id)}
              className="glass min-w-[220px] snap-start rounded-2xl p-3 text-left"
            >
              <p className="line-clamp-1 text-sm font-semibold text-ink">{dish.name}</p>
              {dish.alternateName ? (
                <p className="line-clamp-1 text-xs italic text-ink/60">{dish.alternateName}</p>
              ) : null}
              <p className="line-clamp-2 text-xs text-ink/70">{dish.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            type="button"
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCategory === category ? "bg-ink text-white" : "bg-white/75 text-ink"
            }`}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleDishes.map((dish) => (
          <div key={dish.id} className="fade-rise">
            <MenuCard dish={dish} onOpen={setSelectedDishId} />
          </div>
        ))}
      </section>

      <DishDetailSheet
        dish={selectedDish}
        dishes={menu.dishes}
        onClose={() => setSelectedDishId(null)}
        onNavigate={(dishId) => setSelectedDishId(dishId)}
      />
    </main>
  );
}
