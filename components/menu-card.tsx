"use client";

import type { Dish } from "@/types";

const dietStyles: Record<Dish["dietaryType"], string> = {
  Veg: "bg-green-100 text-green-700",
  Vegan: "bg-emerald-100 text-emerald-700",
  "Non-Veg": "bg-rose-100 text-rose-700",
  "Gluten-Free": "bg-amber-100 text-amber-700",
  Unknown: "bg-slate-100 text-slate-700"
};

type MenuCardProps = {
  dish: Dish;
  onOpen: (dishId: string) => void;
};

export function MenuCard({ dish, onOpen }: MenuCardProps): React.ReactElement {
  return (
    <article
      className="glass flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/60 shadow-card transition hover:-translate-y-0.5"
      onClick={() => onOpen(dish.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(dish.id);
        }
      }}
    >
      <div className="relative h-44 w-full overflow-hidden bg-ink/10">
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" />
        ) : (
          <div className="shimmer h-full w-full" />
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold text-ink">{dish.name}</h3>
            {dish.alternateName ? (
              <p className="line-clamp-1 text-xs italic text-ink/60">{dish.alternateName}</p>
            ) : null}
          </div>
          {dish.price ? (
            <span className="shrink-0 rounded-lg bg-white/75 px-2 py-1 text-xs font-medium text-ink/80">{dish.price}</span>
          ) : null}
        </div>
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${dietStyles[dish.dietaryType]}`}>
          {dish.dietaryType}
        </span>
        <p className="text-sm text-ink/75">{dish.description}</p>
      </div>
    </article>
  );
}
