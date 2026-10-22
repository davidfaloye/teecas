// Built-in sample data so the app works for a showcase without a server.
// Matches the admin's demo seed: three branches and the menu from teecas.online.

import type { Branch, Category, MenuItem } from './types';

export const DEMO_WHATSAPP = '2348088524502';

export const demoBranches: Branch[] = [
  {
    id: 'demo-ogba',
    name: 'Ogba Road',
    address: '144 Airport/Ogba Road, after ADP Junction, Benin City',
    landmark: 'Adjacent DVD filling station',
    whatsapp: DEMO_WHATSAPP,
    hours: 'Mon–Sat 8am – 9pm, Sun 12pm – 8pm',
    deliveryFee: 1000,
    acceptingOrders: true,
  },
  {
    id: 'demo-uniben',
    name: 'Uniben',
    address: 'Food truck, University of Benin, Ugbowo campus',
    landmark: 'Near the main gate',
    whatsapp: DEMO_WHATSAPP,
    hours: 'Mon–Fri 9am – 7pm',
    deliveryFee: 500,
    acceptingOrders: true,
  },
  {
    id: 'demo-ringroad',
    name: 'Ring Road',
    address: 'Sample address — King’s Square, Ring Road, Benin City',
    whatsapp: DEMO_WHATSAPP,
    hours: 'Daily 9am – 10pm',
    deliveryFee: 1000,
    acceptingOrders: true,
  },
];

export const demoCategories: Category[] = [
  { id: 'amala', name: 'Amala Cuisine', subtitle: 'Swallow · made fresh to order' },
  { id: 'soups', name: 'Soups', subtitle: 'Rich · slow-simmered' },
  { id: 'main', name: 'Main Course', subtitle: 'Rice, plantain & sides' },
  { id: 'protein', name: 'Protein', subtitle: 'Meat & fish · sold per portion' },
];

type Row = [string, string, number, string, string, boolean?];
const ROWS: Row[] = [
  ['amala', 'Amala', 1075, '🟤', 'Soft, smooth yam-flour swallow', true],
  ['amala', 'Plantain Amala', 1075, '🟫', 'Unripe plantain swallow, lighter on the stomach'],
  ['amala', 'Poundo', 1075, '⚪', 'Pounded-yam style swallow'],
  ['amala', 'Eba', 860, '🟡', 'Garri swallow, firm and filling'],
  ['soups', 'Egusi', 1700, '🥣', 'Melon seed soup with leafy greens', true],
  ['soups', 'Okro', 1700, '🥬', 'Draw soup with fresh okro'],
  ['soups', 'Vegetable (Efo Riro)', 1700, '🥗', 'Spinach stew with pepper and locust beans'],
  ['main', 'Jollof Rice', 2150, '🍛', 'Smoky party-style jollof', true],
  ['main', 'Fried Rice', 2150, '🍚', 'Mixed vegetables and liver'],
  ['main', 'Asun Rice', 2700, '🌶️', 'Spicy rice with peppered goat meat'],
  ['main', 'Ofada Rice', 2150, '🍙', 'Local brown rice'],
  ['main', 'Ofada Sauce', 2500, '🫕', 'Green pepper sauce with assorted meat'],
  ['main', 'Chinese Rice', 2700, '🥢', 'Stir-fried rice with vegetables'],
  ['main', 'Rice & Beans', 2150, '🫘', 'Served with stew'],
  ['main', 'White Rice', 1300, '🍚', 'Plain boiled rice'],
  ['main', 'Oil Beans', 1075, '🫘', 'Ukpaka-style oil beans'],
  ['main', 'Spaghetti', 2000, '🍝', 'Jollof spaghetti'],
  ['main', 'Moi Moi', 1075, '🧁', 'Steamed bean pudding'],
  ['main', 'Dodo (Plantain)', 550, '🍌', 'Fried ripe plantain', true],
  ['main', 'Salad', 1075, '🥗', 'Fresh coleslaw-style salad'],
  ['protein', 'Assorted', 1075, '🍖', 'Mixed offal, peppered'],
  ['protein', 'Ponmo', 1075, '🟠', 'Soft cow skin'],
  ['protein', 'Goatmeat', 3800, '🐐', 'Tender goat meat', true],
  ['protein', 'Cowleg', 2700, '🦴', 'Slow-cooked cow leg'],
  ['protein', 'Big Turkey', 7000, '🦃', 'Large fried turkey'],
  ['protein', 'Medium Turkey', 5000, '🦃', 'Medium fried turkey'],
  ['protein', 'Cow Head', 1650, '🐄', 'Peppered cow head'],
  ['protein', 'Chicken', 4500, '🍗', 'Fried chicken', true],
  ['protein', 'Meluza Fish', 4300, '🐟', 'Fried hake'],
  ['protein', 'Titus Fish', 4300, '🐟', 'Fried mackerel'],
  ['protein', 'Boiled Titus', 4300, '🐠', 'Mackerel cooked in the soup'],
  ['protein', 'Dryfish', 2700, '🐡', 'Smoked dry fish'],
  ['protein', 'Panla Fish', 1300, '🐟', 'Smoked hake'],
  ['protein', 'Fried Beef', 1650, '🥩', 'Fried beef'],
];

export function demoMenu(): { categories: Category[]; items: MenuItem[] } {
  return {
    categories: demoCategories,
    items: ROWS.map(([categoryId, name, price, emoji, description, popular], i) => ({
      id: `demo-${i}`,
      categoryId,
      name,
      price,
      emoji,
      description,
      popular: Boolean(popular),
      // Show the "sold out" state in the demo too.
      available: name !== 'Panla Fish',
    })),
  };
}
