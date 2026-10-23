// Colours and type from teecas.online, in a light theme (the default) and the original dark one.
// The customer picks one in Settings.
//
// `colors` is a single object that switches palette in place (applyTheme), so screens keep reading
// colors.x as before. Styles made once at load time go through themed() so they follow too.

import { Appearance } from 'react-native';

const dark = {
  bg: '#1b120d',
  bg2: '#241a13',
  card: '#2c2019',
  card2: '#34261c',
  paprika: '#c8451c',
  paprikaBright: '#e05a26',
  gold: '#d9a15b',
  cream: '#f3e9dc', // main text colour
  creamDim: '#cbb9a5',
  muted: '#a8957f',
  line: 'rgba(243,233,220,0.14)',
  lineSoft: 'rgba(243,233,220,0.08)',
  leader: 'rgba(243,233,220,0.18)', // dotted line between a name and a price
  good: '#7fc77a',
  bad: '#ff8a73',
  white: '#ffffff',
  onAccent: '#f3e9dc', // text on paprika buttons and bars
  thumbOff: '#cbb9a5',
  bar: 'rgba(27,18,13,0.96)', // see-through bars over scrolling content
  goldTint: 'rgba(217,161,91,0.08)',
  glow: 'rgba(200,69,28,0.18)',
  statusBar: 'light',
  keyboard: 'dark',
};

const light = {
  bg: '#faf5ee',
  bg2: '#f1e7da',
  card: '#ffffff',
  card2: '#f6eee4',
  paprika: '#c8451c',
  paprikaBright: '#b23c15',
  gold: '#9c6524',
  cream: '#2a1b12', // main text colour
  creamDim: '#5e4a3b',
  muted: '#7d6856',
  line: 'rgba(42,27,18,0.14)',
  lineSoft: 'rgba(42,27,18,0.08)',
  leader: 'rgba(42,27,18,0.22)',
  good: '#2e7d32',
  bad: '#c0392b',
  white: '#ffffff',
  onAccent: '#fff8f0',
  thumbOff: '#ffffff',
  bar: 'rgba(250,245,238,0.96)',
  goldTint: 'rgba(156,101,36,0.08)',
  glow: 'rgba(200,69,28,0.12)',
  statusBar: 'dark',
  keyboard: 'light',
};

export const THEMES = { light, dark };
export const DEFAULT_THEME = 'light';

export const colors = { ...light };
let current = null;
let version = 0;

export function applyTheme(name) {
  const next = THEMES[name] ? name : DEFAULT_THEME;
  if (next === current) return;
  current = next;
  Object.assign(colors, THEMES[next]);
  version++;
  // Native parts (alerts, date pickers, the keyboard) follow the app's theme, not the phone's.
  try {
    Appearance.setColorScheme?.(next);
  } catch {}
}

applyTheme(DEFAULT_THEME); // until the saved choice loads

// Wraps a module-level StyleSheet.create so it is rebuilt with the new colours after a switch:
// const s = themed(() => StyleSheet.create({ ... })); then use s.foo as usual.
export function themed(make) {
  let made = null;
  let at = -1;
  return new Proxy(
    {},
    {
      get(_, key) {
        if (at !== version) {
          made = make();
          at = version;
        }
        return made[key];
      },
    },
  );
}

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
