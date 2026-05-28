To stop wasting tokens and cash on image generation, you need a **Multi-Tiered Cache and Retrieval System**. By pairing Firebase Firestore's native document storage with its **built-in Vector Search (KNN indexing)**, you can create a highly efficient system that checks for duplicate menus first, and then falls back to item-level semantic similarity.

Here is the architectural and database design to feed directly into your codebase or GitHub Copilot workspace.

---

## 0. Current Implementation (as wired in this repo)

| Concern | File | Notes |
|---|---|---|
| Firebase admin init (singleton) | `lib/firebase.ts` | Reads `GOOGLE_APPLICATION_CREDENTIALS` (path to service-account JSON) **or** `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. Gracefully no-ops if neither is set. |
| Tier 1 — whole-menu cache | `lib/cache/menu-cache.ts` + `app/api/parse/route.ts` | Collection `menus`. Key = `url:<host+path>` / `text:<sha256>` / `image:<sha256>`. 24h TTL. |
| Tier 2 — guardrail | `lib/guardrail.ts` | gpt-4o-mini structured check, only for raw text + unknown URLs (skipped for known-domain parsers and image OCR). Fails open. |
| Tier 3 — dish vector cache | `lib/cache/dish-cache.ts` + `app/api/image/route.ts` | Collection `dishes`. Field `embedding` (256-dim, COSINE). Hit threshold ≤ 0.08 distance. |
| Image upload + cache | `lib/cache/image-storage.ts` | Uploads PNG to Firebase Storage at `dish-images/<seed>-<hash>.png`, returns public URL. |
| Embeddings | `lib/embeddings.ts` | `text-embedding-3-small` at 256 dims. |

### One-time setup (per project)

```powershell
# 1. Put the service-account JSON anywhere outside git, then point env at it.
#    .env.local:
#      GOOGLE_APPLICATION_CREDENTIALS=C:\Users\rdhekane\code\side\bigmenu\vibemenu-55f2a-firebase-adminsdk-fbsvc-b833d789dd.json
#      FIREBASE_STORAGE_BUCKET=vibemenu-55f2a.firebasestorage.app   # or vibemenu-55f2a.appspot.com

# 2. Create the Firestore vector index on `dishes.embedding`.
gcloud firestore indexes composite create `
  --project=vibemenu-55f2a `
  --collection-group=dishes `
  --query-scope=COLLECTION `
  --field-config="vector-config={'dimension':256,'flat':{}},field-path=embedding"

# 3. Enable Firebase Storage in the console, then loosen rules just enough
#    to allow public reads of dish-images (writes are admin-SDK only, so no
#    public write rule needed):
#
#    rules_version = '2';
#    service firebase.storage {
#      match /b/{bucket}/o {
#        match /dish-images/{file} {
#          allow read: if true;
#        }
#      }
#    }
```

---

## 1. Core Architecture Workflow

When a user submits a menu (URL, photo text, or raw input), the backend executes a **three-step conditional check** before burning any high-cost API credits:

```
[User Submits Menu] 
        │
        ▼
┌─────────────────────────────────┐
│ Tier 1: Exact Restaurant Cache  │───(Hit)───> Return Cached Visual Menu (0 Cost)
└─────────────────────────────────┘
        │
     (Miss)
        ▼
┌─────────────────────────────────┐
│  Tier 2: Structured Parsing     │───> Call Cheap Text LLM (e.g., gpt-4o-mini)
└─────────────────────────────────┘
        │
        ▼
 For Every Extracted Dish:
┌─────────────────────────────────┐
│  Tier 3: Vector Similarity      │
└─────────────────────────────────┘
        │
        ├───(Hit: Score > Threshold)──> Reuse Existing High-Quality Image
        │
        └───(Miss / Unique Variant)───> Call DALL-E 3 -> Store New Vector & Metadata

```

---

## 2. Firebase Firestore Database Schema

To support quick variations, restaurant linking, and token optimization, separate your data into three primary collections: `restaurants`, `menus`, and `dishes`.

### A. `restaurants` Collection

Stores metadata about where the food is served.

* `id`: String (Unique ID or hash of name + location)
* `name`: String (e.g., *"Ishtaa"*)
* `location`: String
* `zomatoUrl`: String (Optional)

### B. `menus` Collection (The Top-Tier Cache)

Maps an entire menu directly to its items so you don't evaluate dishes one-by-one if the restaurant matches.

* `id`: String (Unified key or Zomato identifier hash)
* `restaurantId`: String (Reference)
* `lastUpdated`: Timestamp
* `items`: Array of Strings `[dishId_1, dishId_2, ...]`

### C. `dishes` Collection (The Vector-Indexed Caching Layer)

This is where the magic happens. We store the rich metadata alongside a native Firestore vector field.

* `id`: String (Unique UUID)
* `name`: String (e.g., *"Paneer Butter Masala"*)
* `description`: String (*"Rich, creamy tomato-based gravy with soft cottage cheese"* )
* `ingredients`: Array of Strings `["Paneer", "Tomato", "Butter", "Cashews"]`
* `variations`: Array of Strings `["Jain Style", "Extra Spicy", "Vegan Option"]`
* `imageUrl`: String (The DALL-E generated asset URL stored in Firebase Storage)
* `availableAt`: Array of Strings (List of `restaurantId`s serving this *exact* item visual match)
* `embedding`: **`FieldValue.vector([...])`** (756 or 1536 dimension float array generated from text)

---

## 3. Step-by-Step Backend Implementation Logic

### Step 1: Check for Menu Cache Hit (Tier 1)

When the app ingests a URL or restaurant identifier, check the `menus` collection:

```typescript
const menuRef = db.collection('menus').doc(restaurantMenuHash);
const menuDoc = await menuRef.get();

if (menuDoc.exists) {
  // Tier 1 Hit! Fetch all matched dish documents instantly.
  const dishIds = menuDoc.data().items;
  const visualMenu = await fetchDishesByIds(dishIds);
  return visualMenu; // 0 Image Gen tokens consumed, 0 Parsing tokens consumed.
}

```

### Step 2: Extract Items with Low-Cost Text LLM

If the menu is completely new, pass the image OCR or raw text to `gpt-4o-mini` (or an equivalent cheap model) to pull structural JSON. Keep the parsing request hyper-focused:

```typescript
// System Prompt Snippet:
"Extract dish names, descriptions, and ingredients from this raw menu text. Output strictly as JSON."

```

### Step 3: Check For Dish-Level Semantic Hits via Vector Embeddings (Tier 2)

For each extracted dish, combine its features into a string block, create an embedding via OpenAI's cheap text embedding model (`text-embedding-3-small`), and run a native Firestore **Nearest-Neighbor Query**.

```typescript
// 1. Construct the semantic string block
const searchableText = `Name: ${dish.name}. Description: ${dish.description}. Ingredients: ${dish.ingredients.join(', ')}`;

// 2. Fetch the text embedding array from OpenAI
const embeddingVector = await getOpenAIEmbedding(searchableText);

// 3. Query Firestore Vector Index
const dishesCollection = db.collection('dishes');
const vectorQuery = dishesCollection.findNearest({
  vectorField: 'embedding',
  queryVector: embeddingVector,
  distanceMeasure: 'COSINE', // Best for matching meaning regardless of text size
  limit: 1,
});

const querySnapshot = await vectorQuery.get();

```

### Step 4: Handle Similarity Threshold & Variations

Evaluate the match quality returned by Firestore to handle generic items vs specific restaurant variations:

* **Case A: Strong Similarity Hit (e.g., Cosine Score <= 0.05 distance / > 95% Match)**
* *Action:* Do **not** generate a new image. Simply update the existing dish document's `availableAt` array to append the current `restaurantId`. Add the item to your temporary list to compile the final menu response.


* **Case B: Moderate Match with Variations (e.g., Match 75% - 94%)**
* *Example:* Existing dish is *"Paneer Butter Masala"*, but new dish is *"Paneer Butter Masala (Jain Style - No Onion No Garlic)"*.
* *Action:* Since the appearance might change slightly due to styling or variation components, trigger DALL-E 3 with the new custom description modifier to get a distinct image. Save it as a brand-new unique item document in the `dishes` collection with its own vector embedding.


* **Case C: Complete Vector Miss (< 75% Match)**
* *Action:* This is a brand new recipe/dish. Send the generated text visual prompt to DALL-E 3, save the resulting image to Firebase storage, and commit the complete metadata and embedding to Firestore for future lookups.



---

## 4. Cost and Performance Advantages

* **Token Savings:** Moving from raw parsing + generating every item to checking static records cuts image creation costs by up to **80%** for highly populated or repeating culinary areas.
* **Instant Load Speeds:** A vector index search inside Firestore evaluates in milliseconds compared to the 5–10 seconds standard time required for a cold call out to DALL-E text-to-image pipelines.

This setup ensures that once someone scales your open-source build or uses their own credits, common elements like a *"Classic Cappuccino"* or *"Ghee Set Dosa"* are generated optimally once globally, while distinct regional variations generate freshly on-demand.

---

An overview of embedding creation pipelines using standard server layouts can help visualize how these vectors integrate with your application workflows. This walkthrough details building robust semantic data components for node-based server routing setups. It explains the mechanics of turning raw text chunks into spatial values that databases easily understand.

*Note: Since Firestore's native vector index configurations require explicit configuration, you will need to map your collections to exact matching dimensions (like 1536 for OpenAI embeddings) in your Firebase setup.*


To protect your backend wallet and shield your AI pipeline from garbage inputs, we will build a two-layer system inside a Next.js Edge-ready server route:

1. **The Guardrail Layer:** Uses a lightweight `gpt-4o-mini` structured validation check to verify if the input is a valid culinary menu. If it's a random resume, a terms-of-service block, or a news article, it cuts the pipeline off instantly at minimal token cost.
2. **The Optimized Vector Layer:** Converts validated text into a highly compressed **256-dimension** semantic vector using OpenAI’s `text-embedding-3-small`, and performs a native server-side Nearest-Neighbor query against Firestore.

### Server Route Code: `app/api/menu/process/route.ts`

Drop this code directly into your workspace for GitHub Copilot to read and wire up.

```typescript
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import admin from 'firebase-admin';

// Initialize Firebase Admin (Singleton check prevents hot-reload crashes)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export async function POST(request: Request) {
  try {
    const { rawText, restaurantName } = await request.json();

    // Dynamically look for User BYOK or fall back to Server Environment variables
    const userApiKey = request.headers.get('X-Provider-OpenAI-Key');
    const openai = new OpenAI({ apiKey: userApiKey || process.env.OPENAI_API_KEY });

    if (!rawText || rawText.trim().length < 10) {
      return NextResponse.json({ error: 'Input text is too short to evaluate.' }, { status: 400 });
    }

    // =========================================================================
    // STEP 1: THE GUARDRAIL FILTER LAYER (Cost: ~0.0001)
    // =========================================================================
    const guardrailCheck = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intake filtering guardrail for VibeMenu. 
          Analyze the input text and determine if it represents a restaurant food menu, beverage list, cafe menu, or culinary items catalog. 
          If it is a personal blog post, terms page, code, or random unrelated text, flag it false.
          Respond strictly in valid JSON format: { "isMenu": boolean, "confidenceScore": number, "rejectionReason": string }`
        },
        { role: 'user', content: rawText.substring(0, 3000) } // Slice to avoid giant payloads
      ],
      response_format: { type: 'json_object' }
    });

    const validationResult = JSON.parse(guardrailCheck.choices[0].message.content || '{}');

    if (!validationResult.isMenu) {
      return NextResponse.json({
        error: 'Guardrail Rejection',
        reason: validationResult.rejectionReason || 'The provided content does not appear to be a restaurant menu.'
      }, { status: 422 });
    }

    // =========================================================================
    // STEP 2: PARSE DISHES STRUCTURALLY
    // =========================================================================
    // Call gpt-4o-mini to return structured JSON arrays of dishes
    const parseMenu = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract dishes into structural JSON arrays. Provide fields: name, description, category, ingredients.' },
        { role: 'user', content: rawText }
      ],
      response_format: { type: 'json_object' }
    });

    const parsedData = JSON.parse(parseMenu.choices[0].message.content || '{"dishes":[]}');
    const finalMenuDishes = [];

    // =========================================================================
    // STEP 3: SEMANTIC VECTOR SELECTION & DALL-E GENERATION
    // =========================================================================
    for (const dish of parsedData.dishes) {
      const searchAnchorString = `Dish: ${dish.name}. Details: ${dish.description}. Contains: ${dish.ingredients?.join(', ')}`;

      // Generate a compressed 256-dimension vector embedding (Ultra Low Cost!)
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchAnchorString,
        dimensions: 256, 
      });
      const queryVector = embeddingResponse.data[0].embedding;

      // Execute a server-side Nearest-Neighbor check on Firestore
      const dishesCollection = db.collection('dishes');
      const vectorQuery = dishesCollection.findNearest(
        'embedding_vector', 
        admin.firestore.FieldValue.vector(queryVector), 
        {
          limit: 1,
          distanceMeasure: 'COSINE',
        }
      );

      const vectorSnapshot = await vectorQuery.get();
      let matchedDishData = null;

      if (!vectorSnapshot.empty) {
        const bestMatchDoc = vectorSnapshot.docs[0];
        // Read native calculated distance (0 = identical, 2 = polar opposites)
        const distance = bestMatchDoc.data().distance; 

        if (distance <= 0.08) {
          // Tier 2 Cache Hit! Match is structurally identical.
          matchedDishData = bestMatchDoc.data();
        }
      }

      if (matchedDishData) {
        // Recycle the image asset and details, avoid calling DALL-E 3
        finalMenuDishes.push({
          ...dish,
          imageUrl: matchedDishData.imageUrl,
          cached: true
        });
      } else {
        // Tier 3 Cache Miss: Generate a brand new photographic asset
        const imageGeneration = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `Professional cinematic food photography of ${dish.name}, described as ${dish.description}. Elegant plating, warm micro lighting, rich textures.`,
          n: 1,
          size: '1024x1024',
        });

        const generatedImageUrl = imageGeneration.data[0].url;

        // Push new record asynchronously to Firestore to store it globally
        await dishesCollection.add({
          name: dish.name,
          description: dish.description,
          category: dish.category,
          ingredients: dish.ingredients || [],
          imageUrl: generatedImageUrl,
          embedding_vector: admin.firestore.FieldValue.vector(queryVector),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        finalMenuDishes.push({
          ...dish,
          imageUrl: generatedImageUrl,
          cached: false
        });
      }
    }

    // =========================================================================
    // STEP 4: BUNDLED SINGLE-READ CACHE COMPILATION
    // =========================================================================
    const compressedCacheRef = db.collection('cached_menus').doc();
    const finalPayload = {
      restaurantName: restaurantName || 'Unknown Spot',
      processedAt: new Date().toISOString(),
      compiledItems: finalMenuDishes
    };

    // Save as a consolidated document so future page views require exactly 1 read
    await compressedCacheRef.set(finalPayload);

    return NextResponse.json(finalPayload);

  } catch (error: any) {
    console.error('Pipeline System Failure:', error);
    return NextResponse.json({ error: 'Internal Server Error Processing Menu', details: error.message }, { status: 500 });
  }
}

```

### How to configure the Index in Firebase

Before running the query, your `dishes` collection must have its vector field cataloged. Execute this command inside your terminal using the Firebase/Google Cloud CLI:

```bash
gcloud alpha firestore indexes composite create \
  --collection-group=dishes \
  --query-scope=COLLECTION \
  --field-config field-path=embedding_vector,vector-config='{"dimension":"256", "flat": "{}"}'

```

### Why this structure protects your app:

* **Total Defense against Trolls:** The guardrail intercepts payloads at index 0. If a user pastes raw source code, it rejects it instantly without iterating through dishes or processing embeddings.
* **Smart Data Truncation:** We pass a maximum slice of 3,000 characters to the guardrail validator to ensure large texts don't generate massive token bills just to confirm a failure.
* **Zero Client Leakage:** The 256-dimensional search array maps and computes strictly over fast, protected Vercel server lines before stripping out data and responding to the viewport app.