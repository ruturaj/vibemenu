"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { Dish } from "@/types";

type DishDetailSheetProps = {
  dish: Dish | null;
  dishes: Dish[];
  onClose: () => void;
  onNavigate: (dishId: string) => void;
};

const widthByScore = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-1/2",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full"
];

function TasteBar({ label, value }: { label: string; value: number }): React.ReactElement {
  const clamped = Math.max(0, Math.min(10, Math.round(value)));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-ink/70">
        <span>{label}</span>
        <span>{clamped}/10</span>
      </div>
      <div className="h-2 w-full rounded-full bg-ink/10">
        <div className={`h-full rounded-full bg-coral ${widthByScore[clamped]}`} />
      </div>
    </div>
  );
}

export function DishDetailSheet({ dish, dishes, onClose, onNavigate }: DishDetailSheetProps): React.ReactElement | null {
  if (!dish) return null;

  const currentIndex = dishes.findIndex((d) => d.id === dish.id);
  const prev = currentIndex > 0 ? dishes[currentIndex - 1] : null;
  const next = currentIndex < dishes.length - 1 ? dishes[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/60" role="dialog" aria-modal="true">
      <div className="glass h-[88vh] w-full overflow-y-auto rounded-t-3xl p-4 sm:mx-auto sm:max-w-2xl fade-rise">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display-font text-3xl text-ink">{dish.name}</h3>
            {dish.alternateName ? (
              <p className="text-sm italic text-ink/60">{dish.alternateName}</p>
            ) : null}
            {dish.price ? <p className="mt-1 text-sm font-medium text-ink">{dish.price}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dish detail"
            className="rounded-full bg-white p-2 text-ink shadow"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 h-64 w-full overflow-hidden rounded-2xl bg-ink/10">
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" />
          ) : (
            <div className="shimmer h-full w-full" />
          )}
        </div>

        <p className="mb-4 text-sm text-ink/80">{dish.description}</p>

        <section className="mb-5 rounded-2xl bg-white/70 p-4">
          <h4 className="mb-2 text-sm font-semibold text-ink">Ingredients</h4>
          <ul className="list-disc space-y-1 pl-4 text-sm text-ink/80">
            {dish.ingredients.length > 0 ? (
              dish.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)
            ) : (
              <li>Ingredients unavailable</li>
            )}
          </ul>
        </section>

        <section className="mb-5 rounded-2xl bg-white/70 p-4">
          <h4 className="mb-2 text-sm font-semibold text-ink">Taste Profile</h4>
          <div className="space-y-3">
            <TasteBar label="Spiciness" value={dish.tasteProfile.spiciness} />
            <TasteBar label="Sweetness" value={dish.tasteProfile.sweetness} />
            <TasteBar label="Richness" value={dish.tasteProfile.richness} />
            <TasteBar label="Texture" value={dish.tasteProfile.texture} />
          </div>
        </section>

        <section className="rounded-2xl bg-ink p-4 text-white">
          <h4 className="mb-1 text-sm font-semibold">How to Order</h4>
          <p className="text-sm text-white/85">{dish.howToOrder}</p>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onNavigate(prev.id)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-ink disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onNavigate(next.id)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
