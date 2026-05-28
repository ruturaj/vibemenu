Scanning a wall of dense, text-only text via an awkward PDF link while balancing a water glass on a tiny table is a universally mediocre dining experience. Turning that static text into a highly visual, aesthetic feast before you order is a killer app idea—and a perfect candidate for a "vibe-coded," high-velocity build using GitHub Copilot.

Here are the complete **Product Specification (PRD)** and **Technical Specification** documents, structured specifically to feed straight into Copilot or any LLM workspace.

---

# Product Specification (PRD): VibeMenu

## 1. Objective & Overview

**VibeMenu** is an open-source, mobile-first web application that converts textual or poorly formatted digital restaurant menus (URLs, Zomato links, or photos of a physical menu booklet) into a beautiful, highly visual, instagrammable interactive menu.

The application is structured around a **Bring Your Own Key (BYOK)** model, allowing anyone to run or self-host it for free by supplying their own AI provider tokens.

## 2. Core User Experience & Workflow

1. **The Ingestion:** The user lands on a clean, single-page interface. They can paste a menu URL, a food aggregator link (e.g., Zomato), or snap/upload photos of a physical menu.
2. **The Key Config:** If using the open-source public deployment, the user can click a subtle "Key" icon to enter their personal AI API keys (OpenAI, Replicate, etc.), which are saved strictly client-side.
3. **The Magic:** The app parses the menu text or images and simultaneously kicks off asynchronous, structured generation of dish images and sensory descriptions.
4. **The Vibe Menu:** The user is presented with a fluid, modern card layout grouped by course (Appetizers, Mains, Desserts) featuring photorealistic imagery, dynamic tags (e.g., Spicy, Vegan), and macro profiles.

## 3. Key Features (MVP Scope)

* **Multimodal Ingestion Engine:** Supports raw text pasting, image file uploads (JPEG/PNG), and external web URLs.
* **Intelligent Menu Parsing:** Automatically categorizes entries, identifies ingredients, and standardizes formats using structured LLM outputs.
* **Cinematic Food Image Generation:** Uses text-to-image models to generate high-fidelity food photography based on the exact dish name and ingredients list.
* **BYOK (Bring Your Own Key) Layer:** A settings panel allowing users to input their own API keys. If keys are missing, gracefully prompt them with a clear setup guide.
* **Mobile-First Interactive UX:** A buttery-smooth, swipable layout designed primarily for mobile browsers since users will be at restaurant tables.

---

# Technical Specification: VibeMenu

## 1. System Architecture

The application is a lightweight, serverless full-stack app utilizing **Next.js (App Router)** deployed to Vercel.

```
[Client Browser] ---> (Sends User API Keys via Custom Headers) ---> [Next.js API Routes]
        |                                                                 |
   (Saves Keys)                                                  (Proxies Request)
        v                                                                 v
 [Local Storage]                                                    [AI Engines]
                                                             (OpenAI / Groq / Replicate)

```

To eliminate CORS issues while protecting the confidentiality of client-side tokens during active sessions, API requests are proxied via Next.js API Edge Routes.

## 2. Technology Stack

* **Framework:** Next.js 16 (App Router) + TypeScript
* **Styling:** Tailwind CSS + Shadcn/ui (Radix UI primitives for fast component rendering)
* **State Management:** Zustand (with persist middleware for `localStorage` persistence)
* **AI SDK:** Vercel AI SDK (for easy orchestration and structured outputs via Zod)

## 3. Data Models & API Schemas

### Structured Menu Output Schema (Zod)

This defines how the parsing engine forces the LLM to structure the raw text/OCR input.

```typescript
import { z } from 'zod';

export const DishSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.string().optional(),
  category: z.string(), // e.g., "Starters", "Main Course"
  dietaryType: z.enum(['Veg', 'Non-Veg', 'Vegan', 'Gluten-Free', 'Unknown']),
  visualPrompt: z.string(), // Optimized prompt for image generation
});

export const MenuSchema = z.object({
  restaurantName: z.string().default('Unknown Restaurant'),
  dishes: z.array(DishSchema),
});

```

## 4. Step-by-Step Execution Pipeline

### Step 1: Text Extraction & OCR

* **If Image Input:** Send the image payload to a vision model (e.g., `gpt-4o` or `gemini-1.5-flash`) with a system prompt instructions to extract and map data matching `MenuSchema`.
* **If URL/Text Input:** Read the raw markdown or text dump, pass it to the model to run the identical extraction.

### Step 2: The BYOK Proxy Mechanism

All client requests must check `localStorage` for keys. If they exist, append them to the API route headers:

```typescript
// Header naming convention for API proxy
const headers = {
  'Content-Type': 'application/json',
  'X-Provider-OpenAI-Key': localStorage.getItem('byok_openai') || '',
  'X-Provider-Replicate-Key': localStorage.getItem('byok_replicate') || '',
};

```

The Server Route (`app/api/generate/route.ts`) will extract these headers and initialize the model providers dynamically rather than using process environment variables.

### Step 3: Visual Generation Pipeline

For each item parsed, a background call hooks into an image generation model (like **DALL-E 3** or **Flux.2** via Replicate).

* **The Injection Prompt Style:** > `"Professional high-end food photography of [dish.name], described as [dish.description]. Served on an elegant, clean plate inside a moody restaurant setting. Warm ambient lighting, macro lens shot, photorealistic texture, appetizing presentation."`

## 5. Directory Structure for Copilot Generation

Provide this layout to Copilot to let it understand where files should live:

```text
vibemenu/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # Main ingestion view
│   ├── menu/
│   │   └── page.tsx           # Interactive visual menu viewer
│   └── api/
│       ├── parse/
│       │   └── route.ts       # Handles OCR & text parsing
│       └── image/
│           └── route.ts       # Handles food image generation proxy
├── components/
│   ├── ui/                    # Shadcn primitives
│   ├── key-settings-modal.tsx # BYOK configuration UI
│   ├── menu-card.tsx          # Animated dish presentation card
│   └── upload-zone.tsx        # Drag-and-drop / Camera snapshot logic
├── store/
│   └── useMenuStore.ts        # Zustand global state (tracks current menu & keys)
└── types/
    └── index.ts

```