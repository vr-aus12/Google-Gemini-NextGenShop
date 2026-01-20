
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const marketplaceTools: FunctionDeclaration[] = [
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
        productId: { type: Type.STRING, description: 'The unique ID of the product' },
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
        productId: { type: Type.STRING, description: 'The unique ID of the product' }
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
        view: { type: Type.STRING, enum: ['home', 'cart', 'checkout'], description: 'The destination view' }
      },
      required: ['view']
    }
  }
];

export function createChatSession(): Chat {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are an expert shopping assistant for NexShop. 
      Your goal is to help users find products, manage their cart, and navigate the app.
      When a user asks to find something, use the searchProducts tool.
      If a user wants more details on an item, use viewProduct.
      If they want to buy or check out, navigate them to the cart or checkout.
      Provide helpful, brief, and friendly responses. If you use a tool, also acknowledge it briefly in text.`,
      tools: [{ functionDeclarations: marketplaceTools }],
      thinkingConfig: { thinkingBudget: 0 } // Disable thinking for maximum speed in UI navigation
    }
  });
}

export async function sendAgentMessage(chat: Chat, prompt: string) {
  const response = await chat.sendMessage({ message: prompt });
  return response;
}
