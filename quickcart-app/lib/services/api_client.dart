import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/product.dart';
import '../models/order.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// Every network call in this app goes through here, hitting the backend —
/// quickcart-backend (lean) or quickcart-backend-enterprise (multi-tenant),
/// depending on which one AppConfig.apiBaseUrl points at. No direct database
/// or Paystack access happens on-device, matching the rule in the backend:
/// prices and payment state are only ever trusted from the server.
class ApiClient {
  static Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBaseUrl}/api/v1$path').replace(queryParameters: query);

  /// Sent on every request. Harmless against the lean single-tenant
  /// backend (it simply ignores unknown headers); required against
  /// quickcart-backend-enterprise's public routes. Leave
  /// AppConfig.organizationSlug empty when targeting the lean backend.
  static Map<String, String> get _tenantHeaders =>
      AppConfig.organizationSlug.isEmpty ? {} : {'X-Organization-Slug': AppConfig.organizationSlug};

  static Map<String, dynamic> _decode(http.Response res) {
    final body = res.body.isEmpty ? {} : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(body['error'] as String? ?? 'Request failed (${res.statusCode})');
    }
    return body;
  }

  static Future<List<Product>> fetchProducts({String? category, String? search}) async {
    final query = <String, String>{};
    if (category != null && category.isNotEmpty) query['category'] = category;
    if (search != null && search.isNotEmpty) query['search'] = search;

    final res = await http.get(_uri('/products', query.isEmpty ? null : query), headers: _tenantHeaders);
    final data = _decode(res);
    return (data['products'] as List).map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
  }

  static Future<Product> fetchProduct(String id) async {
    final res = await http.get(_uri('/products/$id'), headers: _tenantHeaders);
    final data = _decode(res);
    return Product.fromJson(data['product'] as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> createOrder({
    required String customerPhone,
    required String customerName,
    required String address,
    required List<Map<String, dynamic>> items,
  }) async {
    final res = await http.post(
      _uri('/orders'),
      headers: {'Content-Type': 'application/json', ..._tenantHeaders},
      body: jsonEncode({
        'customerPhone': customerPhone,
        'customerName': customerName,
        'address': address,
        'items': items,
      }),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> initializePayment({
    required String orderId,
    String? email,
  }) async {
    final res = await http.post(
      _uri('/payments/initialize'),
      headers: {'Content-Type': 'application/json', ..._tenantHeaders},
      body: jsonEncode({'orderId': orderId, if (email != null) 'email': email}),
    );
    return _decode(res);
  }

  static Future<OrderSummary> fetchOrder(String orderId) async {
    final res = await http.get(_uri('/orders/$orderId'), headers: _tenantHeaders);
    final data = _decode(res);
    return OrderSummary.fromJson(data['order'] as Map<String, dynamic>);
  }

  static Future<OrderSummary> lookupOrder({required String phone, required String orderNumber}) async {
    final res = await http.get(
      _uri('/orders/lookup', {'phone': phone, 'orderNumber': orderNumber}),
      headers: _tenantHeaders,
    );
    final data = _decode(res);
    return OrderSummary.fromJson(data['order'] as Map<String, dynamic>);
  }

  /// "My orders" — matched by phone number alone, same trust model as
  /// lookupOrder above (no account/password involved). Only works against
  /// quickcart-backend-enterprise, which is the version with this endpoint.
  static Future<List<OrderSummary>> fetchOrderHistory({required String phone}) async {
    final res = await http.get(_uri('/orders/history', {'phone': phone}), headers: _tenantHeaders);
    final data = _decode(res);
    return (data['orders'] as List).map((o) => OrderSummary.fromJson(o as Map<String, dynamic>)).toList();
  }

  /// Registers this device's push token for order notifications — see
  /// services/push_service.dart. Only meaningful against
  /// quickcart-backend-enterprise, which is the version with push support;
  /// silently a 404 against the lean backend, which is fine since
  /// push_service.dart treats any failure here as non-fatal.
  static Future<void> registerDevice({
    required String phone,
    required String pushToken,
    required String platform,
  }) async {
    final res = await http.post(
      _uri('/devices/register'),
      headers: {'Content-Type': 'application/json', ..._tenantHeaders},
      body: jsonEncode({'phone': phone, 'pushToken': pushToken, 'platform': platform}),
    );
    _decode(res);
  }

  /// Customer-initiated cancellation — phone must match the one used at
  /// checkout (same trust model as lookupOrder/fetchOrderHistory, no
  /// account/password). Only works while the backend still considers the
  /// order cancellable (before it reaches a rider) — a rejection here is a
  /// normal, expected outcome, not a bug.
  static Future<void> cancelOrder({required String orderId, required String phone}) async {
    final res = await http.post(
      _uri('/orders/$orderId/cancel'),
      headers: {'Content-Type': 'application/json', ..._tenantHeaders},
      body: jsonEncode({'phone': phone}),
    );
    _decode(res);
  }
}
