# NexShop | AI-Powered Voice Marketplace

NexShop is a premium hardware retail application built with **React**, **TypeScript**, and **Tailwind CSS**. It features a robust, persistent data layer and a sophisticated AI shopping assistant powered by Google Gemini.

## 🏗️ Architecture

- **Frontend**: React 19 (ESM) with Tailwind CSS for high-fidelity UI.
- **Persistence Layer**: Custom "LocalDB" engine built on top of `localStorage` providing relational-like persistence for Users, Products, Carts, and Orders.
- **AI Agent**: Integrated Google Gemini 3 (Flash & Pro) for natural language navigation, tech-trend analysis, and automated cart management.
- **State Management**: Centralized reactive state in `App.tsx` with asynchronous synchronization to the persistent layer.

## 🚀 Getting Started

NexShop is designed to be zero-config. There is no external backend required as the data layer is handled directly in the browser.

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file or ensure `process.env.API_KEY` is available with your Google Gemini API Key.
```bash
VITE_GEMINI_API_KEY=your_gemini_key
```

### 3. Run the App
```bash
npm run dev
```

## 🛠️ Key Features

### Persistent "Serverless" DB
The application implements a robust API service (`services/api.ts`) that manages data persistence.
- **Persistence**: Your cart, orders, and user profile survive page refreshes and browser restarts.
- **Admin HQ**: Log in with `admin@nexshop.ai` (password: `admin`) to view system-wide user lists and global orders.
- **Auto-Seeding**: On the first load, the database is automatically populated with high-end hardware products.

### AI Shopping Assistant (Nex)
Nex isn't just a chatbot; it's a functional agent:
- **Navigation**: "Go to my cart" or "Show me the home page".
- **Intelligent Search**: "Find me mechanical keyboards under $200".
- **Direct Action**: "Add that Sony headset to my bag".
- **Grounding**: Uses Google Search grounding to provide real-time hardware specs and tech trends.

## 🤖 Administrative Access
- **Email**: `admin@nexshop.ai`
- **Password**: `admin`
- **Capabilities**: View all registered accounts, monitor recent orders, and run system health diagnostics.

---
*NexShop: Elevating the retail experience through intelligent automation.*
