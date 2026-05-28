Here is the complete, screen-by-screen breakdown of the **VibeMenu** web application. This list maps out the entire user journey from arriving at the site to drooling over the final AI-generated dishes.

---

## 1. Screen 1: The Ingestion Hub (Home)

* **Path:** `/`
* **Purpose:** The minimalist entry point. This screen captures the menu data as quickly as possible with zero friction.
* **Key UI Elements:**
* **Central VibeMenu Branding:** Styled with an elegant glow.
* **"SNAP MENU" Hero Button:** Large, thumb-friendly tap target that opens the native device camera or file uploader.
* **URL Input Field:** A sleek, text input for pasting direct PDF links or Zomato/restaurant website URLs.
* **Floating Settings Gear/Key Icon:** Tucked in the corner to access the API credential panel.


* **User Action:** 1 Tap (to upload a photo) or 1 Paste + Enter.

## 2. Screen 2: The BYOK Configurator (Settings Modal)

* **Path:** `/` (Triggered overlay modal)
* **Purpose:** Allows users to supply their own OpenAI or image model API keys to run the app for free via open source.
* **Key UI Elements:**
* **API Key Fields:** Form inputs for `OpenAI API Key` and optionally an image generation provider (like `Replicate Key`).
* **"Save to Device" Toggle:** Reassures the user that keys are saved *only* in their local browser storage (`localStorage`) and never on your servers.
* **Status Indicator:** Simple green/red dots showing if the entered keys are validated.


* **User Action:** Paste key -> Tap "Save & Close".

## 3. Screen 3: The Processing Canvas (Loading State)

* **Path:** State transition on `/` or an intermediary route `/menu?loading=true`
* **Purpose:** Masks the 3–8 second delay while OpenAI reads the text/image, extracts the items, and generates the initial imagery.
* **Key UI Elements:**
* **Cinematic Ambient Spinner:** A large, pulsing glow ring.
* **Dynamic Status Ticker:** Text that updates in real-time to keep the user engaged (e.g., *"Reading menu via AI..."* -> *"Extracting ingredients..."* -> *"Plating your visual feast..."*).


* **User Action:** None (automatic transition).

## 4. Screen 4: The Visual Feast (Main Menu Feed)

* **Path:** `/menu`
* **Purpose:** The core value proposition—a beautiful, highly visual, instagrammable version of the restaurant's menu.
* **Key UI Elements:**
* **"Chef’s AI Picks" Carousel:** A premium horizontal slider at the top highlighting 3–4 dishes the AI flags as highly rated, unique, or popular based on reviews/descriptions.
* **Category Filters:** Sticky tabs right below the hero section (e.g., *Starters, Mains, Drinks, Desserts*) for lightning-fast scrolling.
* **The Grid Feed:** Vertical cards for each dish containing:
* An AI-generated photo of the exact dish.
* Dish Name and standardized pricing.
* Dietary tags (Veg, Vegan, Gluten-Free) colored cleanly.
* A 1-sentence "Vibe Description" (e.g., *"Crispy, smoky, and slightly sweet"*).




* **User Action:** Scroll, filter by category, or tap a card for a deep dive.

## 5. Screen 5: The Dish Deep-Dive (Detail View)

* **Path:** Sliding bottom-sheet drawer or `/menu/[dish_id]`
* **Purpose:** Gives the user absolute clarity on exactly what a specific item is before they order it from the waiter.
* **Key UI Elements:**
* **Hero Imagery:** High-resolution, full-width photo of the dish.
* **Deconstructed Ingredients List:** AI-parsed bullet points showing exactly what goes into it (crucial for allergies or picky eaters).
* **Taste Profile Graph:** Visual bars showing *Spiciness, Sweetness, Richness,* and *Texture*.
* **"How to Order" Prompt:** A tiny helper text block (e.g., *"Ask for this to be made extra spicy if you like a kick"*).


* **User Action:** Tap "Back" to return to the feed, or swipe left/right to view the next dish detail.

---

### The Behind-The-Scenes Tech Pipeline Flow

```
[Raw Input] ──> [OpenAI GPT-4o OCR / Parsing] ──> [Structured JSON Data]
                                                         │
         ┌───────────────────────────────────────────────┴──────────────────────────────┐
         ▼                                                                              ▼
[AI Suggestion Logic Engine]                                                 [DALL-E 3 / Flux Image Prompting]
   (Flags trending/best items)                                                   (Generates appetizing food pics)
         │                                                                              │
         └───────────────────────────────────────┬──────────────────────────────────────┘
                                                 ▼
                                     [Render Screen 4 & 5]

```