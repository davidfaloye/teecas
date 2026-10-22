import Constants from 'expo-constants';
import { DEMO_WHATSAPP, demoBranches, demoMenu } from './demo';
import { naira } from './theme';
import type { Branch, Category, Customer, MenuItem, Order } from './types';

const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fromConfig || '').replace(/\/+$/, '');

// With no API configured the app runs on built-in sample data and orders go to WhatsApp only.
export const DEMO_MODE = !API_URL;

export class ApiError extends Error {
  code?: string;
  details?: { unavailable?: string[] };
  constructor(message: string, code?: string, details?: ApiError['details']) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/public${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError("We couldn't reach Teecas. Check your internet and try again.", 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong. Try again.', data?.code, data?.details);
  return data as T;
}

export async function fetchBranches(): Promise<Branch[]> {
  if (DEMO_MODE) return demoBranches;
  const d = await request<{ branches: Branch[] }>('/branches');
  return d.branches;
}

// The whole menu. Sold out means off at every branch; Teecas picks a branch that has the food.
export async function fetchMenu(): Promise<{ categories: Category[]; items: MenuItem[] }> {
  if (DEMO_MODE) return demoMenu();
  return request('/menu');
}

// Orders are for delivery and carry no branch: Teecas assigns one when it accepts the order.
export type PlaceOrderInput = {
  customer: Customer;
  note: string;
  lines: { item: MenuItem; qty: number }[];
};

export type PlacedOrder = { order: Order; whatsapp: { url: string; text: string; phone: string }; demo: boolean };

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  if (DEMO_MODE) return placeDemoOrder(input);
  const d = await request<{ order: Order; whatsapp: PlacedOrder['whatsapp'] }>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      fulfilment: 'delivery',
      customer: input.customer,
      note: input.note,
      items: input.lines.map((l) => ({ id: l.item.id, qty: l.qty })),
    }),
  });
  return { ...d, demo: false };
}

export async function fetchOrder(id: string, token: string): Promise<{ order: Order; branch: Branch | null; whatsapp: PlacedOrder['whatsapp'] | null }> {
  return request(`/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
}

// ---- demo mode: same WhatsApp message the server writes ----

export function orderMessage(o: Order, phone: string, note: string) {
  const parts = [
    "Hello, I'd like to place an order for:",
    '',
    ...o.items.map((i) => `${i.name} ~ ${i.qty}`),
    '',
    `Order: #${o.number}`,
    `Delivery to: ${o.customer.address}`,
    `Total: ${naira(o.total)} (pay on delivery, delivery fee excluded)`,
    `Name: ${o.customer.name}`,
    `Phone: ${phone}`,
  ];
  if (note) parts.push(`Note: ${note}`);
  return parts.join('\n');
}

function placeDemoOrder(input: PlaceOrderInput): PlacedOrder {
  const unavailable = input.lines.filter((l) => !l.item.available).map((l) => l.item.name);
  if (unavailable.length) {
    throw new ApiError(`Sold out: ${unavailable.join(', ')}. Remove it to continue.`, 'ITEM_UNAVAILABLE', { unavailable });
  }
  const items = input.lines.map((l) => ({ name: l.item.name, qty: l.qty, price: l.item.price, lineTotal: l.item.price * l.qty }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const now = new Date().toISOString();
  const order: Order = {
    id: `demo-${Date.now()}`,
    number: `D${Math.floor(1000 + Math.random() * 9000)}`,
    branchId: null,
    branchName: '',
    status: 'placed',
    statusHistory: [{ status: 'placed', at: now }],
    fulfilment: 'delivery',
    items,
    subtotal,
    deliveryFee: 0,
    deliveryFeeExcluded: true,
    total: subtotal,
    paymentMethod: 'pay_on_delivery',
    paymentStatus: 'unpaid',
    customer: { name: input.customer.name, address: input.customer.address },
    createdAt: now,
  };
  const text = orderMessage(order, input.customer.phone, input.note);
  return {
    order,
    whatsapp: { phone: DEMO_WHATSAPP, text, url: `https://wa.me/${DEMO_WHATSAPP}?text=${encodeURIComponent(text)}` },
    demo: true,
  };
}
