export type Branch = {
  id: string;
  name: string;
  slug?: string;
  address: string;
  landmark?: string;
  phone?: string;
  whatsapp: string;
  hours?: string;
  deliveryFee: number;
  acceptingOrders: boolean;
};

export type Category = { id: string; name: string; subtitle?: string };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  emoji?: string;
  imageUrl?: string;
  popular?: boolean;
  available: boolean;
};

export type Fulfilment = 'delivery' | 'pickup';

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

export type OrderLine = { name: string; qty: number; price: number; lineTotal: number };

export type Order = {
  id: string;
  number: number | string;
  branchId: string;
  branchName: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  fulfilment: Fulfilment;
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'pay_on_delivery';
  paymentStatus: 'paid' | 'unpaid';
  customer: { name: string; address?: string };
  cancelReason?: string;
  createdAt: string;
  trackingToken?: string;
};

// What the phone keeps about orders it placed.
export type SavedOrder = {
  id: string;
  number: number | string;
  token?: string;
  branchName: string;
  total: number;
  createdAt: string;
  demo?: boolean;
  whatsappUrl: string;
  // Snapshot for demo orders (no server to ask).
  snapshot?: Order;
};

export type Customer = { name: string; phone: string; address: string };
