import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_client.dart';
import '../services/cart_service.dart';
import '../services/customer_profile_service.dart';
import '../services/push_service.dart';
import '../utils/currency.dart';
import 'payment_webview_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    final cart = context.read<CartService>();

    if (_phoneController.text.trim().isEmpty || _addressController.text.trim().isEmpty || cart.isEmpty) {
      setState(() => _error = 'Please fill in your phone number and delivery address.');
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      final orderData = await ApiClient.createOrder(
        customerPhone: _phoneController.text.trim(),
        customerName: _nameController.text.trim(),
        address: _addressController.text.trim(),
        items: cart.items
            .map((item) => {'productId': item.productId, 'quantity': item.quantity})
            .toList(),
      );

      final paymentData = await ApiClient.initializePayment(
        orderId: orderData['orderId'] as String,
        email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
      );

      cart.clear();

      // Best-effort, fire-and-forget — this is the first point in the app
      // we actually have a phone number to register against. Not awaited:
      // a slow or failed push registration should never delay getting the
      // customer to the payment screen.
      PushService.requestPermissionAndRegister(phone: _phoneController.text.trim()).catchError((_) {});
      CustomerProfileService.saveLastPhone(_phoneController.text.trim());

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => PaymentWebviewScreen(
            checkoutUrl: paymentData['authorizationUrl'] as String,
            orderId: orderData['orderId'] as String,
          ),
        ),
      );
    } catch (err) {
      setState(() {
        _error = 'Something went wrong: $err';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone number', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email (for payment receipt)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(labelText: 'Delivery address', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            Text(
              "You'll be taken to Paystack's secure checkout page to complete payment. "
              "Your order is only confirmed once payment succeeds.",
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _placeOrder,
                child: Text(_submitting ? 'Placing order…' : 'Place order — ${formatNaira(cart.total)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
