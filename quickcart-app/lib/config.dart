/// Points at the standalone quickcart-backend service — the same API the
/// web storefront and admin queue call.
///
/// Override per environment at build/run time instead of editing this file:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000   (Android emulator)
///   flutter run --dart-define=API_BASE_URL=http://localhost:4000  (iOS simulator)
///   flutter build apk --dart-define=API_BASE_URL=https://api.quickcart.ng
///
/// Note for Android emulator users specifically: "localhost" from inside the
/// emulator refers to the emulator itself, not your host machine — use
/// 10.0.2.2 to reach a backend running on your laptop during development.
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  /// Which tenant this app build belongs to, when pointed at
  /// quickcart-backend-enterprise. Sent as X-Organization-Slug on every
  /// request — see lib/services/api_client.dart. Irrelevant (and harmless
  /// to leave set) if you're pointing this app at the lean, single-tenant
  /// quickcart-backend instead.
  ///
  ///   flutter run --dart-define=API_BASE_URL=... --dart-define=ORG_SLUG=quickcart-lagos
  static const String organizationSlug = String.fromEnvironment(
    'ORG_SLUG',
    defaultValue: '',
  );
}

