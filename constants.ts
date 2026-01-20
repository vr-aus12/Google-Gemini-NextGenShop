
import { Product } from './types';

export const DUMMY_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Mechanical Gaming Keyboard',
    description: 'Ultra-responsive RGB mechanical keyboard with tactile switches.',
    price: 129.99,
    category: 'Gaming',
    image: 'https://picsum.photos/seed/keyboard/400/400',
    rating: 4.8,
    specs: ['RGB Lighting', 'Tactile Brown Switches', 'Aluminum Frame'],
    // Added missing seller properties
    seller_id: 's1',
    seller_name: 'Gaming Central'
  },
  {
    id: '2',
    name: 'Logitech G Pro Wireless',
    description: 'The preferred mouse for esports professionals worldwide.',
    price: 99.99,
    category: 'Gaming',
    image: 'https://picsum.photos/seed/mouse/400/400',
    rating: 4.9,
    specs: ['Lightspeed Wireless', 'HERO 25K Sensor', '80g Lightweight'],
    // Added missing seller properties
    seller_id: 's2',
    seller_name: 'ProGear'
  },
  {
    id: '3',
    name: 'Sony WH-1000XM5',
    description: 'Industry-leading noise canceling headphones with premium sound.',
    price: 348.00,
    category: 'Audio',
    image: 'https://picsum.photos/seed/headphones/400/400',
    rating: 4.7,
    specs: ['30h Battery', 'LDAC Support', 'Multi-point Bluetooth'],
    // Added missing seller properties
    seller_id: 's3',
    seller_name: 'Audio Hub'
  },
  {
    id: '4',
    name: 'Ergonomic Office Chair',
    description: 'Premium mesh chair designed for 12+ hours of comfort.',
    price: 499.00,
    category: 'Workstation',
    image: 'https://picsum.photos/seed/chair/400/400',
    rating: 4.6,
    specs: ['Adjustable Lumbar', '4D Armrests', 'Breathable Mesh'],
    // Added missing seller properties
    seller_id: 's4',
    seller_name: 'Office Pro'
  },
  {
    id: '5',
    name: 'Samsung 32" Odyssey G7',
    description: '1000R curved gaming monitor with 240Hz refresh rate.',
    price: 699.99,
    category: 'Gaming',
    image: 'https://picsum.photos/seed/monitor/400/400',
    rating: 4.5,
    specs: ['240Hz', '1ms response', 'QLED Technology'],
    // Added missing seller properties
    seller_id: 's1',
    seller_name: 'Gaming Central'
  },
  {
    id: '6',
    name: 'MacBook Pro 14"',
    description: 'The ultimate power machine for creators and pros.',
    price: 1999.00,
    category: 'Electronics',
    image: 'https://picsum.photos/seed/laptop/400/400',
    rating: 4.9,
    specs: ['M3 Pro Chip', 'Liquid Retina XDR', '18GB RAM'],
    // Added missing seller properties
    seller_id: 's5',
    seller_name: 'Apple Store'
  },
  {
    id: '7',
    name: 'Keychron Q1 Pro',
    description: 'Full aluminum custom wireless mechanical keyboard.',
    price: 189.00,
    category: 'Workstation',
    image: 'https://picsum.photos/seed/keychron/400/400',
    rating: 4.8,
    specs: ['Gasket Mount', 'Double-shot PBT', 'Screw-in stabs'],
    // Added missing seller properties
    seller_id: 's6',
    seller_name: 'Keyboard Enthusiasts'
  },
  {
    id: '8',
    name: 'Blue Yeti Microphone',
    description: 'The gold standard for professional recording and streaming.',
    price: 109.99,
    category: 'Audio',
    image: 'https://picsum.photos/seed/mic/400/400',
    rating: 4.4,
    specs: ['Tri-capsule array', 'Multiple patterns', 'USB connection'],
    // Added missing seller properties
    seller_id: 's3',
    seller_name: 'Audio Hub'
  }
];
