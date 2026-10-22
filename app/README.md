# Teecas ordering app

The Teecas Amala Express Bukka app for Android and iOS, in the same paprika, gold and cream look as teecas.online. Built with Expo (SDK 58) and Expo Router.

Customers browse the menu, build an order and place it for delivery. They don't pick a branch: the order goes to the Teecas admin ([teecas-admin](https://github.com/davidfaloye/teecas-admin)) with no branch, and the branch nearest the customer that has the food takes it. Payment is **pay on delivery** (cash, transfer or POS). The total is for the food; the delivery fee is excluded and settled with the rider. WhatsApp opens with the order pre-written to Teecas, as the website does now. The customer can then follow the order (sent, accepted, on the way, delivered) and sees which branch is preparing it.

Screens: menu (popular dishes, category tabs, sold-out badges) · your order · checkout · order tracking · my orders.

## Show it to the client

```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go on a phone.

With no API configured the app runs in **demo mode**: the built-in Teecas menu, and orders go to WhatsApp only (a banner says so). To connect it to the admin, so orders appear on the admin board and tracking is live:

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_URL to the admin's URL, e.g. https://admin.teecas.online
npx expo start --clear
```

## Build for the stores

Builds run on EAS. Set the admin URL in `eas.json` (`EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles), then:

```bash
npx eas-cli@latest build --profile preview --platform android   # installable APK to share
npx eas-cli@latest build --profile production --platform all     # store builds
npx eas-cli@latest submit --platform all
```

App IDs are `com.cullinari.teecas` (Android package and iOS bundle identifier). Change them in `app.json` before the first store build if Teecas wants its own.

Apple expects apps made for a client to be published from the client's own Apple Developer account ($99 a year), so Teecas should open one and add you to it. Google Play is $25 once. Allow a few days for the first store review.

Menu, prices, sold-out dishes and whether app orders are open all come from the admin, so they change without a new release. Small code fixes can go out as over-the-air updates with `eas update`.

## Code layout

- `src/app/`: screens (Expo Router). `index` goes straight to `menu`, then `cart`, `checkout`, `order/[id]`, `orders`.
- `src/api.ts`: calls to the admin API, plus demo mode.
- `src/store.tsx`: cart, saved customer details and past orders, kept on the phone.
- `src/theme.ts`: colours and fonts from teecas.online.
- `src/demo.ts`: built-in sample menu (and branches, used only to check that orders are open).
