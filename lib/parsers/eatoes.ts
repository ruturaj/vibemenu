import type { Dish, DietaryType, MenuData } from "@/types";

const API_BASE = "https://server.eatoes.com/v2/menu";

type EatoesVariety = { name?: string; price?: string | number | null; type?: string };
type EatoesItem = {
  _id?: string;
  itemName?: string;
  description?: string;
  price?: string | number | null;
  type?: string;
  publish?: number;
  isActive?: boolean;
  chefRecommend?: boolean;
  ingredients?: unknown;
  subCategory_id?: string;
  varietyArr?: EatoesVariety[];
};
type EatoesNamed = {
  _id?: string;
  category?: string;
  subCategory?: string;
  category_id?: string;
  publish?: number;
  isActive?: boolean;
};
type EatoesMenu = {
  _id?: string;
  title?: string;
  restaurantName?: string;
  categories?: EatoesNamed[];
  subCategories?: EatoesNamed[];
  items?: EatoesItem[];
};
type EatoesResponse = {
  body?: { menuitems?: EatoesMenu | EatoesMenu[] };
};

const slugFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (!/eatoes\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // Expected: /<slug>/menu  OR  /<slug>
    if (parts.length === 0) return null;
    if (parts[parts.length - 1] === "menu") return parts[parts.length - 2] || null;
    return parts[0] || null;
  } catch {
    return null;
  }
};

export const matchesEatoes = (url: string): boolean => slugFromUrl(url) !== null;

const mapDietary = (raw?: string): DietaryType => {
  const t = (raw || "").toLowerCase();
  if (t === "veg" || t === "vegetarian") return "Veg";
  if (t === "nonveg" || t === "non-veg" || t === "non veg") return "Non-Veg";
  if (t === "vegan") return "Vegan";
  if (t === "gluten-free" || t === "glutenfree" || t === "gf") return "Gluten-Free";
  return "Unknown";
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "dish";

const formatPrice = (
  basePrice: EatoesItem["price"],
  varieties: EatoesVariety[] | undefined
): string | undefined => {
  if (varieties && varieties.length > 0) {
    const parts = varieties
      .map((v) => {
        const p = v.price == null ? "" : String(v.price).trim();
        const n = (v.name || "").trim();
        if (!p) return "";
        return n ? `${p} (${n})` : p;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" / ");
  }
  if (basePrice == null) return undefined;
  const s = String(basePrice).trim();
  return s.length > 0 ? s : undefined;
};

const isLive = (x: { publish?: number; isActive?: boolean } | undefined): boolean =>
  !!x && x.publish === 1 && x.isActive !== false;

const toIngredients = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => {
      if (typeof v === "string") return v.trim();
      if (v && typeof v === "object" && "name" in v) return String((v as { name: unknown }).name || "").trim();
      return "";
    })
    .filter(Boolean);
};

export async function parseEatoesUrl(url: string): Promise<MenuData> {
  const slug = slugFromUrl(url);
  if (!slug) throw new Error("Not an eatoes URL");

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Eatoes API returned ${res.status}`);
  const json = (await res.json()) as EatoesResponse;

  const raw = json.body?.menuitems;
  const menus: EatoesMenu[] = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
  if (menus.length === 0) throw new Error("Eatoes response had no menus");

  const restaurantName = menus[0].title || menus[0].restaurantName || slug;

  const dishes: Dish[] = [];
  const usedIds = new Set<string>();
  const chefPicks: string[] = [];

  for (const menu of menus) {
    const liveCategories = (menu.categories || []).filter(isLive);
    const catById = new Map(liveCategories.map((c) => [c._id || "", (c.category || "").trim()]));
    const liveSubCats = (menu.subCategories || []).filter(
      (s) => isLive(s) && catById.has(s.category_id || "")
    );
    const subCatById = new Map(
      liveSubCats.map((s) => [
        s._id || "",
        {
          name: (s.subCategory || "").trim(),
          parent: catById.get(s.category_id || "") || ""
        }
      ])
    );

    for (const it of menu.items || []) {
      if (!isLive(it)) continue;
      const subCat = subCatById.get(it.subCategory_id || "");
      if (!subCat) continue;

      const name = (it.itemName || "").trim();
      if (!name) continue;

      const category = subCat.name
        ? subCat.parent
          ? `${subCat.parent} • ${subCat.name}`
          : subCat.name
        : subCat.parent || "Menu";

      let baseId = slugify(name);
      let id = baseId;
      let n = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${n}`;
        n += 1;
      }
      usedIds.add(id);

      const description = (it.description || "").trim();
      const ingredients = toIngredients(it.ingredients);

      const dish: Dish = {
        id,
        name,
        description,
        price: formatPrice(it.price ?? null, it.varietyArr),
        category,
        dietaryType: mapDietary(it.type),
        ingredients,
        visualPrompt: `${name}. ${description}`.slice(0, 280),
        tasteProfile: { spiciness: 5, sweetness: 3, richness: 5, texture: 5 },
        howToOrder: "Ask the server about portion size and customization options."
      };

      dishes.push(dish);
      if (it.chefRecommend && chefPicks.length < 6) chefPicks.push(id);
    }
  }

  if (dishes.length === 0) throw new Error("Eatoes menu has no live dishes");

  return {
    restaurantName,
    dishes,
    chefPicks: chefPicks.length > 0 ? chefPicks : dishes.slice(0, 3).map((d) => d.id)
  };
}
