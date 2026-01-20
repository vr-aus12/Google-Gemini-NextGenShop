# NexShop Technical Documentation

## State Management
The application state is centralized in `App.tsx` using a single `MarketplaceState` interface. 
This state controls:
- **View Navigation**: `home`, `search`, `cart`, etc.
- **Cart Management**: Items, quantities, and totals.
- **Global Filters**: Applied search queries and category toggles.

## AI Agent Integration (`AIAgent.tsx`)
The `AIAgent` component acts as an observer and an actor.
- **Observing**: It receives the `currentCart` and `products` via props to provide context to the AI model if needed.
- **Acting**: It uses "Tool Calling" to call functions defined in `App.tsx` via the `actions` prop.

### Tool Definitions
Tools are defined in `geminiService.ts`. The most critical ones are:
- `searchProducts`: Updates `view` to 'search' and modifies filter state.
- `addToCart`: Matches product names from natural language to unique IDs in the database.
- `navigateTo`: Directly modifies the `view` property of the application state.

## Voice Recognition
Voice input uses the browser's native `webkitSpeechRecognition`. 
1. The user clicks the Mic icon.
2. The browser captures audio and converts it to text locally.
3. The text is passed to the AI Agent's standard message handler.
4. The AI handles the "meaning" of the transcribed text.

## Performance Optimization
To prevent "hanging" during AI requests:
- We use `gemini-3-flash-preview` for low-latency responses.
- `thinkingBudget` is set to `0` to ensure the agent acts quickly on UI commands.
- Persistent `ChatSession` is maintained to avoid the overhead of re-sending system instructions on every turn.