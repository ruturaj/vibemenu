/**
 * OpenAI text-embedding-3-small at 256 dimensions.
 * Cheap (~$0.00002 per 1k tokens) and good enough for dish-level similarity.
 */
export async function getEmbedding(text: string, openAiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
      dimensions: 256
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Embedding API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vec = payload.data?.[0]?.embedding;
  if (!vec || vec.length === 0) throw new Error("Embedding API returned empty vector");
  return vec;
}

export function buildDishSearchString(dish: {
  name: string;
  description?: string;
  ingredients?: string[];
}): string {
  const parts = [`Name: ${dish.name}`];
  if (dish.description) parts.push(`Description: ${dish.description}`);
  if (dish.ingredients && dish.ingredients.length > 0) {
    parts.push(`Ingredients: ${dish.ingredients.join(", ")}`);
  }
  return parts.join(". ");
}
