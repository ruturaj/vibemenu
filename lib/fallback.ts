import type { Dish, MenuData } from "@/types";

function inferCategory(line: string): string {
  const v = line.toLowerCase();
  if (v.includes("starter") || v.includes("appet")) return "Starters";
  if (v.includes("drink") || v.includes("beverage") || v.includes("cocktail")) return "Drinks";
  if (v.includes("dessert") || v.includes("sweet") || v.includes("ice cream")) return "Desserts";
  return "Mains";
}

function inferDiet(line: string): Dish["dietaryType"] {
  const v = line.toLowerCase();
  if (v.includes("vegan")) return "Vegan";
  if (v.includes("veg")) return "Veg";
  if (v.includes("gluten")) return "Gluten-Free";
  if (v.includes("chicken") || v.includes("mutton") || v.includes("fish") || v.includes("prawn")) {
    return "Non-Veg";
  }
  return "Unknown";
}

export function fallbackParse(raw: string): MenuData {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 18);

  const dishes: Dish[] = (lines.length > 0 ? lines : ["House Pasta - 420", "Firecracker Paneer - 360", "Lemon Tart - 220"]).map(
    (line, idx) => {
      const [namePart, pricePart] = line.split(/[-|:]/).map((s) => s.trim());
      const name = namePart || `Dish ${idx + 1}`;
      return {
        id: `dish-${idx + 1}`,
        name,
        description: `A signature ${name.toLowerCase()} with balanced flavor and texture.`,
        price: pricePart && /\d/.test(pricePart) ? pricePart : undefined,
        category: inferCategory(line),
        dietaryType: inferDiet(line),
        visualPrompt: `Professional high-end food photography of ${name}. Warm ambient lighting, macro lens, appetizing plating.`,
        ingredients: ["Chef special base", "Seasonal garnish", "House seasoning"],
        tasteProfile: {
          spiciness: Math.min(10, 2 + (idx % 6)),
          sweetness: Math.min(10, 3 + ((idx + 2) % 5)),
          richness: Math.min(10, 4 + ((idx + 1) % 5)),
          texture: Math.min(10, 5 + (idx % 4))
        },
        howToOrder: "Ask the server for pairing recommendations and spice adjustments.",
        imageUrl: undefined
      };
    }
  );

  return {
    restaurantName: "VibeMenu Demo Kitchen",
    dishes,
    chefPicks: dishes.slice(0, 4).map((dish) => dish.id)
  };
}
