
# NexShop | AI-Powered Retail Marketplace

NexShop is a modern, high-end retail marketplace demo featuring **Nex**, a proactive AI shopping assistant built with Google's Gemini 3 Pro.

## 🚀 Key Features

- **AI Shopping Assistant**: A floating agent that can search products, filter by category/price, navigate pages, and manage your cart using natural language.
- **Voice Integration**: Use your microphone to talk to Nex directly. Just click the mic icon and speak your request.
- **Dynamic Product Filtering**: Instant search and category filtering for a premium shopping experience.
- **Mobile-First Design**: Fully responsive UI built with Tailwind CSS and Lucide icons.
- **Native AI Actions**: The assistant doesn't just talk; it performs actions in the UI (e.g., "Add the Sony headphones to my cart").

## 🛠️ Tech Stack

- **Frontend**: React (v18+)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Intelligence**: Google Gemini API (@google/genai)
- **Deployment**: Ready for Vercel, Netlify, or GitHub Pages.

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key from [AI Studio](https://aistudio.google.com/)

### 2. Installation
```bash
# Clone the repository (once created)
git clone https://github.com/your-username/nexshop-ai-marketplace.git

# Navigate to the project
cd nexshop-ai-marketplace

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory and add your API key:
```env
VITE_GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Running the App
```bash
npm run dev
```

## 🤖 Using the AI Agent
Try commands like:
- *"Show me some gaming keyboards under $150"*
- *"What's in my cart right now?"*
- *"Take me to the checkout page"*
- *"Search for noise canceling headphones and open the first result"*

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
