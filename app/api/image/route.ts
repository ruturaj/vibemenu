type ImageBody = {
  dishName: string;
  alternateName?: string;
  dishDescription?: string;
  ingredients?: string[];
  visualPrompt?: string;
};

export const runtime = "nodejs";

function makePlaceholderDataUrl(title: string): string {
  const safeTitle = title.replace(/[<>&"']/g, "");
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 768'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#ffb45a' />
      <stop offset='55%' stop-color='#ff5e4d' />
      <stop offset='100%' stop-color='#1f2937' />
    </linearGradient>
  </defs>
  <rect width='1024' height='768' fill='url(#g)' />
  <circle cx='820' cy='140' r='200' fill='rgba(255,255,255,0.14)' />
  <circle cx='260' cy='700' r='220' fill='rgba(255,255,255,0.11)' />
  <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='54' font-family='Georgia'>${safeTitle}</text>
</svg>
`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ImageBody;
    const openAiKey =
      request.headers.get("X-Provider-OpenAI-Key")?.trim() || process.env.OPENAI_API_KEY?.trim() || "";

    if (!body?.dishName) {
      return Response.json({ error: "dishName is required" }, { status: 400 });
    }

    if (!openAiKey) {
      return Response.json({ imageUrl: makePlaceholderDataUrl(body.dishName), provider: "placeholder" });
    }

    const altLine = body.alternateName ? ` (${body.alternateName})` : "";
    const ingLine =
      body.ingredients && body.ingredients.length > 0
        ? ` Key ingredients: ${body.ingredients.slice(0, 8).join(", ")}.`
        : "";
    const descLine = body.dishDescription ? ` Described as: ${body.dishDescription}.` : "";

    const prompt =
      `Photorealistic high-end food photograph of the exact dish "${body.dishName}"${altLine}.` +
      descLine +
      ingLine +
      ` The plated dish MUST visually match "${body.dishName}" and its typical presentation in its native cuisine. ` +
      `Stay faithful to the description and ingredients above; do not invent unrelated components. ` +
      `Single dish in frame, elegant clean plate, moody restaurant setting, warm ambient lighting, shallow depth of field, macro lens, photorealistic textures, appetizing presentation. ` +
      `No text, no captions, no logos, no menus, no hands, no people.` +
      (body.visualPrompt ? ` Extra cues: ${body.visualPrompt}` : "");

    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt,
        size: "1024x1024",
        quality: "low"
      })
    });

    if (!imageRes.ok) {
      let detail = "";
      let code = "";
      try {
        const errBody = (await imageRes.json()) as { error?: { message?: string; code?: string; type?: string } };
        detail = errBody.error?.message || "";
        code = errBody.error?.code || errBody.error?.type || "";
      } catch {
        // ignore
      }

      const fatal =
        imageRes.status === 401 ||
        imageRes.status === 403 ||
        imageRes.status === 404 ||
        /quota|billing|insufficient|invalid_api_key|model_not_found/i.test(`${detail} ${code}`);

      if (fatal) {
        return Response.json(
          {
            error: detail || `Image provider error ${imageRes.status}`,
            code: code || `http_${imageRes.status}`,
            fatal: true
          },
          { status: imageRes.status }
        );
      }

      return Response.json(
        {
          imageUrl: makePlaceholderDataUrl(body.dishName),
          provider: "placeholder",
          warning: `Image provider error ${imageRes.status}${detail ? `: ${detail}` : ""}`
        },
        { status: 200 }
      );
    }

    const payload = (await imageRes.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const first = payload.data?.[0];
    if (!first) {
      return Response.json({ imageUrl: makePlaceholderDataUrl(body.dishName), provider: "placeholder" });
    }

    if (first.url) {
      return Response.json({ imageUrl: first.url, provider: "openai" });
    }

    if (first.b64_json) {
      return Response.json({ imageUrl: `data:image/png;base64,${first.b64_json}`, provider: "openai" });
    }

    return Response.json({ imageUrl: makePlaceholderDataUrl(body.dishName), provider: "placeholder" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image error";
    return Response.json({ error: message }, { status: 500 });
  }
}
