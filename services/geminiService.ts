
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";

export const marketplaceTools: FunctionDeclaration[] = [
  {
    name: 'searchProducts',
    description: 'Use this ONLY when the user is searching for something new or exploring. Parameters: query, category, minPrice, maxPrice.',
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
    description: 'Use this when the user says "add to cart", "buy this", or "I want this". REQUIRES a productId from the context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: 'The unique ID of the product to add' },
        quantity: { type: Type.NUMBER, description: 'Quantity to add (default 1)' }
      },
      required: ['productId']
    }
  },
  {
    name: 'viewProduct',
    description: 'Navigates to the details page of a specific product using its ID.',
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
    description: 'Navigates to a specific app view: home, search, cart, checkout, profile, orders, admin, presentation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        view: { type: Type.STRING, enum: ['home', 'search', 'cart', 'checkout', 'profile', 'orders', 'admin', 'presentation'], description: 'The view to navigate to' }
      },
      required: ['view']
    }
  }
];

export function createChatSession(initialContext?: string): Chat {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are Nex, the NexShop AI. 
      
      CORE RULE: Do NOT call 'searchProducts' if the user wants to ADD an item to their cart. 
      If the user says "add this to cart" and a product is currently selected or mentioned, use 'addToCart'.
      
      If the user asks about the app features, how it works, or wants to see a demo/presentation, navigate to 'presentation'.

      CONTEXT:
      ${initialContext || "No context provided."}
      
      TOOLS:
      - 'searchProducts': For exploration.
      - 'addToCart': For adding items to the basket.
      - 'navigateTo': For switching pages.
      
      GROUNDING:
      - Use Google Search for tech trends or hardware specs not in catalog.
      
      PERSONA: Direct, helpful, and professional.`,
      tools: [
        { functionDeclarations: marketplaceTools },
        { googleSearch: {} }
      ],
    }
  });
}

export const getDeepInsight = async (productName: string, reviews: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze these reviews for "${productName}" and provide a concise reasoned purchase verdict.
  REVIEWS: ${JSON.stringify(reviews)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { thinkingConfig: { thinkingBudget: 2000 } }
  });
  return response.text;
};

export const generateImage = async (prompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Marketing photo of ${prompt}` }] },
  });
  const part = response.candidates?.[0].content.parts.find(p => p.inlineData);
  return part ? `data:image/png;base64,${part.inlineData.data}` : null;
};
