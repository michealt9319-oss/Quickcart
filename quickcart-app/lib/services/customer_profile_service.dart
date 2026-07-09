import 'package:shared_preferences/shared_preferences.dart';

const _phoneKey = 'quickcart_last_phone_v1';

/// Not a login — just a convenience so the customer doesn't retype their
/// phone number on the order-history and order-lookup screens every visit.
/// There is still no password or account behind this; anyone who has the
/// phone number can see its orders, exactly like the web app's lookup flow.
class CustomerProfileService {
  static Future<String?> getLastPhone() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_phoneKey);
  }

  static Future<void> saveLastPhone(String phone) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_phoneKey, phone);
  }
}
