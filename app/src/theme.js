// Colours and type from teecas.online.

export const colors = {
  bg: '#1b120d',
  bg2: '#241a13',
  card: '#2c2019',
  card2: '#34261c',
  paprika: '#c8451c',
  paprikaBright: '#e05a26',
  gold: '#d9a15b',
  cream: '#f3e9dc',
  creamDim: '#cbb9a5',
  muted: '#a8957f',
  line: 'rgba(243,233,220,0.14)',
  lineSoft: 'rgba(243,233,220,0.08)',
  good: '#7fc77a',
  bad: '#ff8a73',
  white: '#ffffff',
};

export const fonts = {
  brand: 'ArchivoBlack_400Regular',
  head: 'Fraunces_700Bold',
  headSemi: 'Fraunces_600SemiBold',
  italic: 'Fraunces_600SemiBold_Italic',
  body: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

// ₦1,075, written by hand so it looks the same on every phone.
export function naira(n) {
  const v = Math.round(Number(n) || 0);
  return '₦' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function validDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 7:45pm. Empty string for a missing or broken date instead of "NaN:NaN".
export function clock(iso) {
  const d = validDate(iso);
  if (!d) return '';
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

// 22 Oct, 7:45pm
export function dayAndClock(iso) {
  const d = validDate(iso);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(iso)}`;
}
