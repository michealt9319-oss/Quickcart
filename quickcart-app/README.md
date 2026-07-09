# QuickCart — Mobile App (Flutter, iOS + Android)

One codebase for both platforms, calling the same `quickcart-backend` API the web storefront
uses. This matches the "one codebase, not separate native apps" principle from
`QuickCart_Technical_Architecture_Recommendation.md` — just applied now that you're actually
building native apps, rather than at the pilot stage.

**This is not a Flutter Web app.** The Next.js storefront already covers web; rebuilding it a
second time in Flutter would be duplicate effort for no real benefit at this stage.

## Multi-tenant (enterprise backend) support

If you're pointing this app at `quickcart-backend-enterprise` instead of the lean
`quickcart-backend`, set your tenant's slug at build/run time:

```
flutter run --dart-define=API_BASE_URL=https://api.quickcart.ng --dart-define=ORG_SLUG=quickcart-lagos
```

Leave `ORG_SLUG` unset when targeting the lean backend — it's simply not sent, which is exactly
what the lean backend expects. Everything else about the app is unaffected; the enterprise
backend's admin/RBAC/reporting additions are deliberately not surfaced here — this stays a
customer-facing app only, same as always.

## Cart persistence

The cart now survives the app being killed — it's saved to on-device storage
(`shared_preferences`) on every change and reloaded at startup (`CartService.loadFromDisk()`,
called from `main.dart`). This is real native device storage, unlike a browser sandbox — there
was no reason to keep it in-memory-only once it started actually costing customers a lost cart.

## Push notifications

Wired to Firebase Cloud Messaging, registering the device's token with the backend right after
checkout (`services/push_service.dart`, called from `checkout_screen.dart`) — that's the first
point the app has a phone number to associate the token with. The backend
(`quickcart-backend-enterprise` only) triggers the actual notifications when an order's status
changes; this app's only job is registering the token.

**To actually enable this, you need to set up Firebase yourself** — not done here, since it
requires a real Firebase project:
1. Create a Firebase project, add it to this app via the FlutterFire CLI: `flutterfire configure`
   (this generates `firebase_options.dart`, which doesn't exist in this package).
2. Uncomment the `Firebase.initializeApp(...)` call noted in `main.dart`.
3. Set `FCM_SERVER_KEY` in the backend's `.env` (see that project's README).

Without this setup, the app still works completely normally — push registration fails silently
(by design, same as every other best-effort integration in this stack) and customers just don't
get push notifications, relying on WhatsApp instead.

## App icon and splash screen

Config is in `pubspec.yaml` (`flutter_launcher_icons`, `flutter_native_splash`), but the actual
image files are not included — see `assets/icon/README.md` for exactly what to supply and the
two commands to run afterward.

## Important: generating the native project shell

This package contains the app's actual source (`lib/`) and `pubspec.yaml`, but **not** the
generated native Android/iOS project folders (`android/`, `ios/`) — those are boilerplate that
the Flutter CLI generates reliably from your installed SDK/Xcode/Android Studio versions, and
handwriting them tends to go stale or subtly wrong. Generate them yourself, once:

```
# From inside this quickcart-app folder:
flutter create .
```

This adds `android/`, `ios/`, and a few other generated files/folders around the existing
`lib/` and `pubspec.yaml` without overwriting them. If you don't have Flutter installed yet,
follow Google's official install guide for your OS first: https://docs.flutter.dev/get-started/install

## Setup

1. Run `flutter create .` as above (one-time step).
2. `flutter pub get`
3. Make sure `quickcart-backend` is running (locally or deployed) — see its own README.
4. Run the app, pointing it at your backend:
   ```
   # Android emulator, backend running on your laptop:
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000

   # iOS simulator, backend running on your laptop:
   flutter run --dart-define=API_BASE_URL=http://localhost:4000

   # Physical device — use your machine's LAN IP, not localhost:
   flutter run --dart-define=API_BASE_URL=http://192.168.x.x:4000

   # Against a deployed backend:
   flutter run --dart-define=API_BASE_URL=https://api.quickcart.ng
   ```
   See `lib/config.dart` for why the Android emulator specifically needs `10.0.2.2`.

## What's here

Six customer-facing screens — deliberately no admin screen; the admin order queue stays on
the web app, since ops staff running the pilot don't need a native app for it:

- **Home/Browse** — search, category chips, product grid
- **Product detail** — quantity picker, add to cart
- **Cart** — line items, quantity edit, fee breakdown
- **Checkout** — name, phone, email, address, then creates the order and starts payment
- **Payment (in-app WebView)** — Paystack's hosted checkout page, never a custom card form
- **Order status** (post-payment) and **order lookup** (phone + order number, no login needed)

## Architecture notes

- **State management:** `provider` + a single `CartService` (`ChangeNotifier`) — no Riverpod,
  no Bloc, no code generation. This is a six-screen app; adding a heavier state management
  library wouldn't pay for itself yet.
- **Cart persistence:** in-memory only, lost if the app is killed. Matches the web app's
  session-only cart in spirit; add on-device persistence only if lost carts actually become a
  complaint, not preemptively.
- **Payments:** an in-app `WebView` loads Paystack's own hosted checkout page. Card details
  never touch app code — this is intentional and matches the backend's "always verify
  server-side" rule. The WebView intercepts the redirect back to the backend's callback URL and
  swaps in a native order-status screen instead of rendering the web app's confirmation page
  inside the WebView.
- **No customer accounts.** Orders are tied to a phone number, exactly like the web app and
  exactly like WhatsApp ordering already works. Add real accounts only once repeat customers
  want saved addresses as a convenience.

## Building for release

```
flutter build apk --release --dart-define=API_BASE_URL=https://api.quickcart.ng   # Android
flutter build ipa --release --dart-define=API_BASE_URL=https://api.quickcart.ng   # iOS
```

The Android command produces an installable APK directly. The iOS command produces an `.ipa`
that still needs an Apple Developer account and App Store Connect (or TestFlight) to
distribute — there's no way around Apple's signing requirements regardless of framework choice.

## Next steps

1. Run `flutter create .` and confirm the app builds and runs against your local backend.
2. Add your first supermarket partner's real products (same database the web app reads from —
   no separate mobile catalog to maintain).
3. Test the full flow on a real device with a Paystack test card.
4. Decide on app icons, splash screen, and store listings once the core flow is solid —
   polish is cheap to add later; a broken checkout flow is not.

## Added in this pass

- **Order history** ("My orders", `screens/order_history_screen.dart`) — matched by phone
  number, same trust model as order lookup (no account/password). Requires
  `quickcart-backend-enterprise`'s `/orders/history` endpoint — will 404 against the lean
  backend, and the screen surfaces that plainly rather than a generic error.
- **Real product images** — `ProductCard` and the product detail screen now render
  `product.imageUrl` via `Image.network` with `errorBuilder` fallback to the same placeholder
  used when there's no image at all, so a broken URL never breaks the grid.
- **Retry on failed product load** — the home screen's error state now has an actual Retry
  button instead of just an error message.
- **Payment redirect fallback** — the payment WebView now has an "I've completed payment"
  button in the app bar alongside the automatic URL-based redirect detection. The automatic
  path is unchanged; this is a safety net if it ever misses (a bank's 3D-Secure page adding an
  extra redirect hop, Paystack changing behavior, etc.) — it always fetches the REAL order
  status from the backend, never fabricates a paid state.
- **Tests** (`test/`) — unit tests for currency formatting and `CartService`, a widget test for
  `ProductCard`. `.github/workflows/ci.yml` runs `flutter create .` (to generate the native
  scaffolding fresh in CI), `flutter analyze`, and `flutter test` on every push.
- **Fastlane templates** (`ci/fastlane-templates/`) — not wired up, since Fastlane needs to live
  inside `android/`/`ios/` which don't exist in this package, and real lanes need real Play
  Console / App Store Connect credentials this repo obviously can't include. See that folder's
  README for the actual steps once you have those.

## Still not here

No offline request queuing (a dropped connection during checkout still just errors — the retry
button added above is manual, not automatic background retry), no analytics/crash reporting
SDK, and the order-history "last known phone" convenience is on-device only — it doesn't sync
across a customer's devices.

## Added in this pass

- **Order cancellation** on the order status screen — phone-gated (prefilled from the same
  on-device "last used phone" as order history), only shown while the backend still considers
  the order cancellable, with an explicit note once it's past that point.

No MFA UI was added to the mobile app — MFA is an admin/owner account concept, and this app has
no admin screens by design (that stays on web). API keys and delivery zones are similarly
backend/admin concerns with no mobile-side relevance.
