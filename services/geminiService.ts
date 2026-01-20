
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";

export const marketplaceTools: FunctionDeclaration[] = [
  {
    name: 'searchProducts',
    description: 'Searches for products based on a query, category, and price range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Text search query' },
        category: { type: Type.STRING, description: 'Category to filter by' },
        minPrice: { type: Type.NUMBER, description: 'Minimum price filter' },
        maxPrice: { type: Type.NUMBER, description: 'Maximum price filter' },
      }
    }
  },
  {
    name: 'addToCart',
    description: 'Adds a specific product to the user shopping cart.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: 'The unique ID or Name of the product' },
        quantity: { type: Type.NUMBER, description: 'How many items to add' }
      },
      required: ['productId']
    }
  },
  {
    name: 'viewProduct',
    description: 'Navigates the user to a detailed view of a specific product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: 'The unique ID or Name of the product' }
      },
      required: ['productId']
    }
  },
  {
    name: 'navigateTo',
    description: 'Changes the application page/view.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        view: { type: Type.STRING, enum: ['home', 'search', 'cart', 'checkout', 'seller-dashboard', 'compare'], description: 'The destination view' }
      },
      required: ['view']
    }
  },
  {
    name: 'addNewProduct',
    description: 'Allows a seller to list a new product in the marketplace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'The product name' },
        description: { type: Type.STRING, description: 'Detailed product description' },
        price: { type: Type.NUMBER, description: 'Price of the item' },
        category: { type: Type.STRING, description: 'Category (Gaming, Audio, Workstation, Electronics)' },
        specs: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of features' }
      },
      required: ['name', 'description', 'price', 'category', 'specs']
    }
  },
  {
    name: 'compareProducts',
    description: 'Adds products to the comparison list or takes user to the comparison view.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of product IDs or names to compare' },
        goToView: { type: Type.BOOLEAN, description: 'Whether to navigate to the compare view immediately' }
      }
    }
  },
  {
    name: 'getSellerData',
    description: 'Navigates to the seller dashboard and selects a specific tab like analytics or orders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: { type: Type.STRING, enum: ['analytics', 'orders', 'inventory'], description: 'The tab to open' }
      }
    }
  }
];

export function createChatSession(initialContext?: string): Chat {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are Nex, the proactive shopping assistant for NexShop.
      
      CRITICAL CONTEXT:
      ${initialContext || "No current context."}
      
      YOUR CAPABILITIES:
      1. Search: Use 'searchProducts' for general queries.
      2. Product Details: Use 'viewProduct' if the user wants to see more about an item.
      3. Cart: Use 'addToCart' to add items. 
      4. Navigation: Use 'navigateTo' to move between home, cart, checkout, seller-dashboard, and compare.
      5. Selling: Use 'addNewProduct' if a user wants to list an item. For seller insights, use 'getSellerData' to show analytics or orders.
      6. Comparison: Use 'compareProducts' to help users decide between items.
      
      VOICE INTERACTION:
      You are speaking to the user directly. Keep your spoken responses friendly and natural.`,
      tools: [{ functionDeclarations: marketplaceTools }],
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
}
