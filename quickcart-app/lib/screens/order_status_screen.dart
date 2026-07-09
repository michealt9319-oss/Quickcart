import 'package:flutter/material.dart';
import '../models/order.dart';
import '../services/api_client.dart';
import '../services/customer_profile_service.dart';
import '../utils/currency.dart';
import 'home_screen.dart';

const List<String> _cancellableStatuses = ['pending', 'confirmed', 'packing'];

class OrderStatusScreen extends StatefulWidget {
  final String orderId;
  const OrderStatusScreen({super.key, required this.orderId});

  @override
  State<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends State<OrderStatusScreen> {
  late Future<OrderSummary> _orderFuture;
  bool _showCancelForm = false;
  final _phoneController = TextEditingController();
  bool _cancelling = false;
  String? _cancelError;

  @override
  void initState() {
    super.initState();
    _loadOrder();
    _prefillPhone();
  }

  void _loadOrder() {
    _orderFuture = ApiClient.fetchOrder(widget.orderId);
  }

  Future<void> _prefillPhone() async {
    final saved = await CustomerProfileService.getLastPhone();
    if (saved != null) _phoneController.text = saved;
  }

  Future<void> _cancelOrder() async {
    if (_phoneController.text.trim().isEmpty) {
      setState(() => _cancelError = 'Enter the phone number you used at checkout.');
      return;
    }
    setState(() {
      _cancelling = true;
      _cancelError = null;
    });
    try {
      await ApiClient.cancelOrder(orderId: widget.orderId, phone: _phoneController.text.trim());
      setState(() {
        _showCancelForm = false;
        _loadOrder();
      });
    } catch (err) {
      setState(() => _cancelError = '$err');
    } finally {
      setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order status'), automaticallyImplyLeading: false),
      body: FutureBuilder<OrderSummary>(
        future: _orderFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(child: Text('Could not load this order.'));
          }
          final order = snapshot.data!;
          final canCancel = _cancellableStatuses.contains(order.status);

          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle, color: Colors.green, size: 48),
                const SizedBox(height: 12),
                const Text('Thank you!', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(
                  "Your order has been placed. We've sent a confirmation to your WhatsApp — "
                  "reply there any time with questions about your delivery.",
                  style: TextStyle(color: Colors.grey.shade700),
                ),
                const SizedBox(height: 20),
                _row('Order number', order.orderNumber),
                _row('Status', orderStatusLabels[order.status] ?? order.status),
                _row('Total paid', formatNaira(order.total)),

                if (canCancel && !_showCancelForm) ...[
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () => setState(() => _showCancelForm = true),
                    child: const Text('Cancel this order'),
                  ),
                ],

                if (canCancel && _showCancelForm) ...[
                  const SizedBox(height: 16),
                  const Text('Confirm the phone number you used at checkout:'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
                  ),
                  if (_cancelError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(_cancelError!, style: const TextStyle(color: Colors.red)),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      FilledButton(
                        onPressed: _cancelling ? null : _cancelOrder,
                        child: Text(_cancelling ? 'Cancelling…' : 'Confirm cancellation'),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: () => setState(() => _showCancelForm = false),
                        child: const Text('Never mind'),
                      ),
                    ],
                  ),
                ],

                if (order.status == 'with_rider')
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      'This order is already with a rider and can no longer be cancelled here — '
                      'contact us via WhatsApp if there\'s a problem.',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                    ),
                  ),

                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const HomeScreen()),
                      (route) => false,
                    ),
                    child: const Text('Back to home'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
