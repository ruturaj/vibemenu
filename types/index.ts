export type DietaryType = "Veg" | "Non-Veg" | "Vegan" | "Gluten-Free" | "Unknown";

export type TasteProfile = {
  spiciness: number;
  sweetness: number;
  richness: number;
  texture: number;
};

export type Dish = {
  id: string;
  name: string;
  alternateName?: string;
  description: string;
  price?: string;
  category: string;
  dietaryType: DietaryType;
  visualPrompt: string;
  ingredients: string[];
  tasteProfile: TasteProfile;
  howToOrder: string;
  imageUrl?: string;
};

export type MenuData = {
  restaurantName: string;
  dishes: Dish[];
  chefPicks: string[];
};

export type ParseInput = {
  inputType: "text" | "url" | "image";
  text?: string;
  url?: string;
  imageBase64?: string;
};
