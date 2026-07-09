import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../utils/currency.dart';

const _prefsKey = 'quickcart_cart_v1';

/// Cart persisted to on-device storage (SharedPreferences — plist/XML on
/// iOS, SharedPreferences file on Android), so it survives the app being
/// killed and reopened. This is real native device storage, not a browser
/// API — unlike a web artifact sandbox, a shipped mobile app has normal
/// access to on-device persistence, so there's no reason to keep the cart
/// in memory only once losing it on app kill turned out to matter.
class CartService extends ChangeNotifier {
  final List<CartItem> _items = [];
  bool _loaded = false;

  List<CartItem> get items => List.unmodifiable(_items);
  bool get isEmpty => _items.isEmpty;
  double get subtotal => _items.fold(0, (sum, item) => sum + item.lineTotal);
  double get deliveryFeeTotal => _items.isEmpty ? 0 : deliveryFee;
  double get convenienceFeeTotal => _items.isEmpty ? 0 : convenienceFee;
  double get total => subtotal + deliveryFeeTotal + convenienceFeeTotal;

  /// Call once at app start (see main.dart) before relying on cart
  /// contents. Cheap and fast — SharedPreferences reads are local disk, no
  /// network — but still async, hence not done in the constructor.
  Future<void> loadFromDisk() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw) as List;
        _items
          ..clear()
          ..addAll(decoded.map((e) => CartItem.fromJson(e as Map<String, dynamic>)));
      } catch (_) {
        // Corrupt or outdated cache — start with an empty cart rather than
        // crash the app over a saved shopping cart.
      }
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(_items.map((i) => i.toJson()).toList()));
  }

  void addProduct(Product product, {int quantity = 1}) {
    final existingIndex = _items.indexWhere((i) => i.productId == product.id);
    if (existingIndex >= 0) {
      _items[existingIndex].quantity += quantity;
    } else {
      _items.add(CartItem(productId: product.id, name: product.name, price: product.price, quantity: quantity));
    }
    notifyListeners();
    _persist();
  }

  void updateQuantity(String productId, int quantity) {
    final index = _items.indexWhere((i) => i.productId == productId);
    if (index < 0) return;
    if (quantity <= 0) {
      _items.removeAt(index);
    } else {
      _items[index].quantity = quantity;
    }
    notifyListeners();
    _persist();
  }

  void clear() {
    _items.clear();
    notifyListeners();
    _persist();
  }
}
