import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { getCachedMenu, saveCachedMenu } from "@/lib/cache/menu-cache";
import { menuCacheKey } from "@/lib/cache/keys";
import { fallbackParse } from "@/lib/fallback";
import { isMenuText } from "@/lib/guardrail";
import { getKnownDomainParser } from "@/lib/parsers";
import { MenuSchema } from "@/lib/schemas";
import type { ParseInput } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const STRUCTURE_PROMPT = `You convert raw restaurant menu text into a structured JSON menu.

CRITICAL completeness rule:
- The source already lists every dish. Your output MUST include EVERY dish from the source, in the original order. Never drop, merge, or summarize items. If the source has 18 dishes, output exactly 18 dishes. If unsure, prefer including over excluding.

Accuracy rules:
- Copy the dish name EXACTLY as written in the source (preserve casing, punctuation, language).
- Copy the price EXACTLY as written (e.g. "549", "₹549", "$12.50"). Do NOT convert currency, do NOT add or remove decimals, do NOT change the number. If no price is shown, leave price empty.
- Use the source's own category headings when present. Only invent a category if the source has none.
- Dietary type: Veg | Non-Veg | Vegan | Gluten-Free | Unknown. Use Unknown if you are not sure.
- alternateName: a short, plain-English explanation only when the dish name is non-English or jargony (e.g. for "Paneer Tikka" -> "Spiced grilled Indian cottage cheese"). Omit otherwise.
- description: short, factual, grounded in the source. Do not invent marketing language.
- ingredients: list ingredients that appear in the source. If none are listed, infer the 3-5 most likely ones for that exact dish.
- visualPrompt: a tight prompt for a food photo of THIS exact dish. Include the dish name verbatim plus 2-3 visual cues (key ingredients, plating style, cuisine). Keep it under 60 words.
- howToOrder: 1 short practical tip.
- chefPicks: 3-4 dish IDs that look most distinctive or popular.
- ids: stable kebab-case slugs based on the dish name (e.g. "paneer-tikka"). Make them unique.`;

async function extractMenuTextFromImage(openAiKey: string, imageBase64: string): Promise<string> {
  const openai = createOpenAI({ apiKey: openAiKey });
  const { text } = await generateText({
    model: openai("gpt-4.1-nano"),
    maxRetries: 0,
    messages: [
      {
        role: "system",
        content:
          "You are an OCR specialist for restaurant menus. Transcribe every dish, section heading, and price visible in the image VERBATIM. Preserve original spelling, language, and number formatting (do not convert currency). Output plain text grouped by the menu's own section headings, one dish per line in the format: `Dish Name - Price` followed by any description on the next indented line. Do not omit anything. Do not add anything that is not visible."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this menu verbatim." },
          { type: "image", image: `data:image/jpeg;base64,${imageBase64}` }
        ]
      }
    ]
  });

  return text.trim();
}

async function readSource(input: ParseInput, openAiKey: string): Promise<string> {
  if (input.inputType === "text") return input.text?.trim() || "";

  if (input.inputType === "url" && input.url) {
    try {
      const res = await fetch(input.url, { cache: "no-store" });
      const html = await res.text();
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return input.url;
    }
  }

  if (input.inputType === "image" && input.imageBase64) {
    if (!openAiKey) return "";
    return await extractMenuTextFromImage(openAiKey, input.imageBase64);
  }

  return "";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ParseInput;

    const openAiKey =
      request.headers.get("X-Provider-OpenAI-Key")?.trim() || process.env.OPENAI_API_KEY?.trim() || "";

    // Tier 1: Whole-menu cache lookup (any input type).
    const cacheKey = menuCacheKey(body);
    if (cacheKey) {
      const cached = await getCachedMenu(cacheKey);
      if (cached) {
        return Response.json({ ...cached, _cache: "menu-hit" });
      }
    }

    // Known-domain fast path: skip OCR/LLM, transform structured data directly.
    if (body.inputType === "url" && body.url) {
      const parser = getKnownDomainParser(body.url);
      if (parser) {
        try {
          const menu = await parser.parse(body.url);
          if (cacheKey) void saveCachedMenu(cacheKey, menu, parser.name);
          return Response.json(menu);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Domain parser failed";
          return Response.json({ error: `${parser.name} parser: ${message}` }, { status: 502 });
        }
      }
    }

    const sourceText = await readSource(body, openAiKey);

    if (!sourceText) {
      if (body.inputType === "image" && !openAiKey) {
        return Response.json(
          { error: "Image input requires an OpenAI key. Set OPENAI_API_KEY or paste a key in Settings." },
          { status: 400 }
        );
      }
      return Response.json({ error: "No input provided" }, { status: 400 });
    }

    if (!openAiKey) {
      return Response.json(fallbackParse(sourceText));
    }

    // Guardrail: only for raw text + unknown URLs (skip image OCR + known-domain parsers).
    if (body.inputType === "text" || body.inputType === "url") {
      const guard = await isMenuText(sourceText, openAiKey);
      if (!guard.isMenu) {
        return Response.json(
          {
            error: "This does not look like a restaurant menu.",
            reason: guard.rejectionReason || "Guardrail rejection"
          },
          { status: 422 }
        );
      }
    }

    const openai = createOpenAI({ apiKey: openAiKey });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      maxRetries: 0,
      schema: MenuSchema,
      system: STRUCTURE_PROMPT,
      prompt: `Source menu text (verbatim from OCR or original document):\n\n${sourceText.slice(0, 30000)}`
    });

    if (cacheKey) void saveCachedMenu(cacheKey, object, body.inputType);

    return Response.json(object);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    // Surface schema-mismatch errors clearly so the client can show them.
    if (message.includes("did not match schema") || message.includes("No object generated")) {
      return Response.json(
        {
          error:
            "The AI returned a response that did not match the expected menu schema. " +
            "This often happens when the source contains very little real menu text (e.g. a JavaScript-rendered page). " +
            "Try pasting the menu text directly or uploading an image."
        },
        { status: 502 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
