# NexShop | Premium AI-Driven Marketplace

NexShop is a cutting-edge retail experience that merges high-end electronics with a conversational AI agent powered by **Google Gemini 3 Pro**. Unlike traditional chatbots, "Nex" is deeply integrated into the application state, allowing it to navigate, filter products, and manage the shopping cart through natural language or voice commands.

![NexShop Preview](https://picsum.photos/seed/nexshop-hero/1200/400)

## ✨ Features

### 🤖 Proactive AI Shopping Assistant (Nex)
- **Natural Language Navigation**: Ask Nex to "Take me to the cart" or "Go back home."
- **Context-Aware Search**: "Find me mechanical keyboards under $200" automatically applies filters and triggers a search.
- **Cart Management**: Commands like "Add the first item to my cart" or "Remove the Sony headphones" work seamlessly.
- **Persistent Memory**: Nex remembers your previous queries within a session for a fluid conversation.

### 🎙️ Voice-Activated Interface
- Integrated **Web Speech API** for hands-free shopping.
- Real-time transcription and visual feedback in the agent UI.

### 💎 High-End UI/UX
- **Glassmorphism Design**: Modern, clean aesthetic using Tailwind CSS.
- **Responsive Layout**: Optimized for mobile, tablet, and desktop viewing.
- **Micro-interactions**: Subtle animations and "agent pulse" effects to indicate AI status.

---

## 🛠️ Technical Architecture

NexShop uses a **Function-Calling (Tool Use)** architecture. When you speak or type to Nex:

1.  **Intent Parsing**: The prompt is sent to the Gemini 3 Pro model via the `@google/genai` SDK.
2.  **Tool Selection**: Based on your intent, the model chooses from a set of predefined tools (`searchProducts`, `addToCart`, `navigateTo`, etc.).
3.  **State Synchronization**: The React frontend intercept these tool calls and updates the `MarketplaceState` (e.g., changing the `view` or `searchQuery`).
4.  **Feedback**: The model generates a conversational response to confirm the action it just took.

---

## 🚀 Getting Started

### 1. Installation
```bash
git clone https://github.com/your-username/nexshop-ai-marketplace.git
cd nexshop-ai-marketplace
npm install
```

### 2. Environment Setup
Create a `.env` file in the project root:
```env
VITE_GEMINI_API_KEY=your_google_ai_studio_api_key
```

### 3. Development
```bash
npm run dev
```

---

## ⌨️ Example Voice/Chat Prompts

| Intent | Prompt Example |
| :--- | :--- |
| **Search** | "Search for premium gaming monitors" |
| **Filter** | "Show me only audio equipment over $300" |
| **Detail** | "Tell me more about the Samsung Odyssey monitor" |
| **Cart** | "Add two Logitech mice to my shopping cart" |
| **Flow** | "I'm done, take me to the checkout page" |

---

## 🗺️ Roadmap
- [ ] **Multi-modal Support**: Upload a photo of a product to find it in the store.
- [ ] **Auth Integration**: Google OAuth 2.0 for persistent user profiles.
- [ ] **Real-time Inventory**: Backend integration with SQLite for dynamic stock levels.
- [ ] **Personalization**: AI recommendations based on browsing history.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
