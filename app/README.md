# Teecas ordering app

The Teecas Amala Express Bukka app for Android and iOS, in the same paprika, gold and cream look as teecas.online. Built with Expo (SDK 58) and Expo Router, in plain JavaScript.

Customers browse the menu, build an order and place it for delivery. They don't pick a branch: the order goes to the Teecas admin ([teecas-admin](https://github.com/davidfaloye/teecas-admin)) with no branch, and the branch nearest the customer that has the food takes it. Payment is **pay on delivery** (cash, transfer or POS). The total is for the food; the delivery fee is excluded and settled with the rider. WhatsApp opens with the order pre-written to Teecas, as the website does now. The customer can then follow the order (sent, accepted, on the way, delivered) and gets a notification each time it moves.

Screens: first-launch tour · menu (search, popular dishes, category tabs, sold-out badges) · your order · checkout · order tracking · my orders · settings · terms and privacy.

## Run it

```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go on a phone.

With no API configured the app uses the built-in Teecas menu and orders go to WhatsApp only. To connect it to the admin, so orders appear on the admin board and tracking is live:

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_URL to the admin's URL, e.g. https://admin.teecas.online
npx expo start --clear
```

## Order notifications

- **App open:** the app checks active orders every 20 seconds and shows a notification when one changes. Works on iOS (including Expo Go) and in Android development and store builds. **Expo Go on Android has no notifications at all** since SDK 53: the app runs normally there, and Settings says order updates aren't available in that preview.
- **App closed:** the admin sends a push through Expo's push service. This needs:
  1. the admin's push support (`server/push.js`, `PUT /api/public/orders/:id/push`) deployed;
  2. an EAS project id: run `npx eas-cli@latest init` once, which adds `extra.eas.projectId` to `app.json`;
  3. a development or store build. Expo Go on Android can't receive push notifications since SDK 53.
  4. For iOS, push credentials: `npx eas-cli@latest credentials` (EAS sets them up on the first build).

Settings → Order updates turns both off (and tells the admin to stop pushing for open orders).

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

## Checks before a release

```bash
npm run lint
npx expo export --platform android --platform ios   # bundles the app; fails on import or syntax errors
```

## Code layout

- `src/app/`: screens (Expo Router). `index` sends first-time users to `welcome` (the tour), everyone else to `menu`; then `cart`, `checkout`, `order/[id]`, `orders`, `settings`, `terms`.
- `src/api.js`: calls to the admin API. Every response is checked and normalised here, so an empty reply, an edited order or an unknown status shows a message instead of crashing.
- `src/store.jsx`: cart, saved customer details, past orders, settings; kept on the phone.
- `src/notifications.js`, `src/orderWatcher.js`, `src/pushSync.js`: order notifications.
- `src/terms.js`: terms of service and privacy text (plain data, easy to edit).
- `src/theme.js`: colours, fonts and formatting from teecas.online.
- `src/demo.js`: built-in menu used when no API is configured.
