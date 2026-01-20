# NexShop Technical Documentation

## Application Flow
NexShop operates as a Single Page Application (SPA) where the state is driven by the `MarketplaceState` object in `App.tsx`. All user interactions trigger actions that simultaneously update the UI state and synchronize with the persistence layer.

## Persistence Layer (`services/api.ts`)
The persistence layer mimics a RESTful API but stores data in the browser's `localStorage`.
- **Database Tables**: Simulated using specific keys (e.g., `nex_db_users`).
- **Relational Logic**: The `carts` table maps `userId` to an array of products, ensuring multi-user support on the same machine.
- **Initialization**: The `initDB` function handles the "First Run" scenario, ensuring the marketplace is never empty.

## AI Agent Integration (`components/AIAgent.tsx`)
The AI Agent (Nex) uses the `@google/genai` SDK to interact with Gemini 3.

### Tool Calling Mechanism
Nex is configured with a set of `marketplaceTools` (defined in `services/geminiService.ts`).
1. **Context Awareness**: The agent receives a JSON-serialized snapshot of the current UI context (Current View, User Role, Cart Items, Catalog Samples).
2. **Intent Matching**: When a user provides a prompt, Gemini decides whether to respond with text or a `functionCall`.
3. **Execution**: The `AIAgent` component intercepts these calls and executes the corresponding logic via the `actions` prop provided by `App.tsx`.

### Models Used
- **gemini-3-flash-preview**: Primary model for the chat interface, optimized for low-latency tool calling and navigation.
- **gemini-3-pro-preview**: Used for "Deep Insights" (product review analysis) where complex reasoning is required.
- **gemini-2.5-flash-image**: Powers the "Marketing Studio" feature to generate product concept art from text descriptions.

## State Management
The `state` object in `App.tsx` is the single source of truth:
- `view`: Controls conditional rendering of main components (`home`, `search`, `admin`, etc.).
- `user`: Holds the current session data.
- `cart`: Synchronized with `api.getCart` on every relevant change.

## Performance & Optimization
- **Persistence Throttling**: Updates to `localStorage` are immediate but minimal (individual table updates).
- **AI Latency**: Nex uses a thinking budget of `0` for UI-critical tasks to ensure responsive navigation.
- **Asset Loading**: High-quality imagery is sourced from Unsplash via optimized URLs for fast rendering.
