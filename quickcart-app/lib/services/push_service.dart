import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_client.dart';

/// Wires Firebase Cloud Messaging to the backend's device registration
/// endpoint. Requires Firebase to actually be set up for this app (see
/// README's "Push notifications" section) — this assumes
/// Firebase.initializeApp() has already been called in main.dart.
///
/// This only registers the token; it does NOT decide what to notify about
/// or when — that's entirely the backend's job (src/lib/push.ts in
/// quickcart-backend-enterprise), triggered when an order's status
/// changes. This file's only responsibility is "here is a device, here is
/// its token, here is the phone number to associate it with."
class PushService {
  static Future<void> requestPermissionAndRegister({required String phone}) async {
    final messaging = FirebaseMessaging.instance;

    final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return; // Customer declined — respect it, don't nag on every screen.
    }

    final token = await messaging.getToken();
    if (token == null) return;

    final platform = _currentPlatform();
    if (platform == null) return; // e.g. running on web/desktop during dev — no-op there.

    try {
      await ApiClient.registerDevice(phone: phone, pushToken: token, platform: platform);
    } catch (_) {
      // Non-fatal by design — same principle as the backend's WhatsApp and
      // push integrations: a notification-registration failure should
      // never block the app's core ordering flow.
    }

    // Re-register if the token rotates (FCM does this occasionally).
    messaging.onTokenRefresh.listen((newToken) {
      ApiClient.registerDevice(phone: phone, pushToken: newToken, platform: platform).catchError((_) {});
    });
  }

  static String? _currentPlatform() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.android:
        return 'android';
      default:
        return null;
    }
  }
}
