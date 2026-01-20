
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
        productId: { type: Type.STRING, description: 'The unique ID or exact Name of the product' },
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
        view: { type: Type.STRING, enum: ['home', 'search', 'cart', 'checkout', 'seller-dashboard', 'compare', 'profile', 'orders', 'tests'], description: 'The destination view' }
      },
      required: ['view']
    }
  },
  {
    name: 'login',
    description: 'Signs the user in to the platform to access orders, cart, and profile.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'checkout',
    description: 'Initiates the checkout process for items in the cart.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'updateProfile',
    description: 'Updates user personal information, address, or payment details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        address: { type: Type.STRING },
        cardNumber: { type: Type.STRING },
        cardExpiry: { type: Type.STRING },
        cardCvv: { type: Type.STRING },
        role: { type: Type.STRING, enum: ['buyer', 'seller'] }
      }
    }
  },
  {
    name: 'postReview',
    description: 'Submits a review for a specific product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING },
        rating: { type: Type.NUMBER, description: 'Rating from 1 to 5' },
        comment: { type: Type.STRING }
      },
      required: ['productId', 'rating', 'comment']
    }
  },
  {
    name: 'trackOrder',
    description: 'Checks the status of an order or navigates to the orders page.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: 'Optional specific order ID' }
      }
    }
  },
  {
    name: 'setSellerOrderStatus',
    description: 'Allows a seller to update the fulfillment status of an order.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING },
        status: { type: Type.STRING, enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'] }
      },
      required: ['orderId', 'status']
    }
  },
  {
    name: 'addProduct',
    description: 'Allows a seller to list a new product for sale.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        price: { type: Type.NUMBER },
        category: { type: Type.STRING, enum: ['Electronics', 'Gaming', 'Workstation', 'Audio', 'Accessories'] },
        image: { type: Type.STRING, description: 'Optional image URL' }
      },
      required: ['name', 'price', 'category']
    }
  },
  {
    name: 'manageInventory',
    description: 'Navigates the seller to their inventory management tab.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'viewAnalytics',
    description: 'Navigates the seller to their store analytics dashboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];

export function createChatSession(initialContext?: string): Chat {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are Nex, the high-end retail AI for NexShop.
      
      CURRENT APP STATE:
      ${initialContext || "No context provided."}
      
      YOUR ROLE:
      - You can perform ANY action the user can do in the UI.
      - Search, Add to cart, Navigate, Login, Checkout, Manage Profile, Post Reviews, and Track Orders.
      - SELLER MODE: If user is a seller, you can manage inventory, add products, update order status, and view analytics.
      - If a user wants to become a seller, help them update their profile role to 'seller'.
      
      GUIDELINES:
      - Always use the tools to perform actions.
      - If they aren't logged in and want to see orders, call the 'login' tool first.
      - If they ask to add a product, use 'addProduct'.
      
      VOICE PERSONA: Professional and proactive.`,
      tools: [{ functionDeclarations: marketplaceTools }],
    }
  });
}
