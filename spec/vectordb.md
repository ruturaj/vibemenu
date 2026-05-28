To stop wasting tokens and cash on image generation, you need a **Multi-Tiered Cache and Retrieval System**. By pairing Firebase Firestore's native document storage with its **built-in Vector Search (KNN indexing)**, you can create a highly efficient system that checks for duplicate menus first, and then falls back to item-level semantic similarity.

Here is the architectural and database design to feed directly into your codebase or GitHub Copilot workspace.

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