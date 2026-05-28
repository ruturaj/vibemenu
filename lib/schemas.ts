import { z } from "zod";

export const DishSchema = z.object({
  id: z.string(),
  name: z.string(),
  alternateName: z.string().optional(),
  description: z.string(),
  price: z.string().optional(),
  category: z.string(),
  dietaryType: z.enum(["Veg", "Non-Veg", "Vegan", "Gluten-Free", "Unknown"]),
  visualPrompt: z.string(),
  ingredients: z.array(z.string()).default([]),
  tasteProfile: z
    .object({
      spiciness: z.number().min(0).max(10),
      sweetness: z.number().min(0).max(10),
      richness: z.number().min(0).max(10),
      texture: z.number().min(0).max(10)
    })
    .default({ spiciness: 5, sweetness: 3, richness: 5, texture: 5 }),
  howToOrder: z.string().default("Ask if this can be customized to your preferred spice level.")
});

export const MenuSchema = z.object({
  restaurantName: z.string().default("Unknown Restaurant"),
  dishes: z.array(DishSchema),
  chefPicks: z.array(z.string()).default([])
});

export type MenuSchemaType = z.infer<typeof MenuSchema>;
