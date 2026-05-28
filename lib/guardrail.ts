import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const GuardrailSchema = z.object({
  isMenu: z.boolean(),
  confidenceScore: z.number().min(0).max(1).default(0),
  rejectionReason: z.string().default("")
});

export type GuardrailResult = z.infer<typeof GuardrailSchema>;

/**
 * Cheap (~$0.0001) gpt-4o-mini check: is this text actually a restaurant menu?
 * Returns isMenu=true on any error so we fail open and don't block real users.
 */
export async function isMenuText(text: string, openAiKey: string): Promise<GuardrailResult> {
  if (!openAiKey || !text || text.trim().length < 20) {
    return { isMenu: true, confidenceScore: 0, rejectionReason: "" };
  }

  try {
    const openai = createOpenAI({ apiKey: openAiKey });
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      maxRetries: 0,
      schema: GuardrailSchema,
      system:
        "You are an intake filter for VibeMenu. Decide if the input text represents a restaurant food menu, beverage list, cafe menu, or culinary items catalog. " +
        "Reject personal blog posts, terms-of-service text, code, news, resumes, or any non-culinary content. " +
        "Be lenient: a partial menu, OCR noise, or non-English menu still counts as a menu.",
      prompt: text.slice(0, 3000)
    });
    return object;
  } catch {
    // Fail open — never block a real user because the guardrail itself broke.
    return { isMenu: true, confidenceScore: 0, rejectionReason: "" };
  }
}
