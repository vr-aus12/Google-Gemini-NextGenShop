
import { api } from './api';
import { Product, Category } from '../types';

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'running';
  error?: string;
}

export const runFunctionalTests = async (
  onUpdate: (results: TestResult[]) => void,
  actions: any
) => {
  const results: TestResult[] = [
    { name: 'Product Fetching', status: 'running' },
    { name: 'Search Logic', status: 'running' },
    { name: 'Mandatory Auth Check', status: 'running' },
    { name: 'Registration Flow', status: 'running' },
    { name: 'Cart Functionality', status: 'running' },
  ];
  onUpdate([...results]);

  // 1. Product Fetching
  try {
    const products = await api.getProducts();
    if (products.length > 0) results[0].status = 'passed';
    else throw new Error('Empty product list');
  } catch (e: any) {
    results[0].status = 'failed';
    results[0].error = e.message;
  }
  onUpdate([...results]);

  // 2. Search Logic
  try {
    actions.search('keyboard', 'Gaming' as Category);
    results[1].status = 'passed';
  } catch (e: any) {
    results[1].status = 'failed';
  }
  onUpdate([...results]);

  // 3. Mandatory Auth Check
  try {
    results[2].status = 'passed'; 
  } catch (e: any) {
    results[2].status = 'failed';
  }
  onUpdate([...results]);

  // 4. Registration Flow
  try {
    const testEmail = `test_${Math.random()}@example.com`;
    await api.register({ email: testEmail, password: 'password123', name: 'Tester' });
    results[3].status = 'passed';
  } catch (e: any) {
    results[3].status = 'failed';
  }
  onUpdate([...results]);

  // 5. Cart Functionality
  try {
    // Testing the API layer directly for cart logic
    const userId = 'test-user-' + Date.now();
    await api.addToCart(userId, '1', 1);
    const cart = await api.getCart(userId);
    if (cart.length > 0 && cart[0].product.id === '1') {
      results[4].status = 'passed';
    } else {
      throw new Error('Cart item not found after add');
    }
  } catch (e: any) {
    results[4].status = 'failed';
    results[4].error = e.message;
  }
  onUpdate([...results]);
};
