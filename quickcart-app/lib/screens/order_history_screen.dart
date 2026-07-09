import 'package:flutter/material.dart';
import '../models/order.dart';
import '../services/api_client.dart';
import '../services/customer_profile_service.dart';
import '../utils/currency.dart';
import 'order_status_screen.dart';

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  final _phoneController = TextEditingController();
  List<OrderSummary>? _orders;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSavedPhoneAndFetch();
  }

  Future<void> _loadSavedPhoneAndFetch() async {
    final saved = await CustomerProfileService.getLastPhone();
    if (saved != null && saved.isNotEmpty) {
      _phoneController.text = saved;
      _fetch();
    }
  }

  Future<void> _fetch() async {
    if (_phoneController.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orders = await ApiClient.fetchOrderHistory(phone: _phoneController.text.trim());
      setState(() => _orders = orders);
    } catch (err) {
      // Most common cause here is pointing this app at the LEAN backend,
      // which has no /orders/history endpoint (404) — show that plainly
      // rather than a generic error.
      setState(() => _error = 'Could not load order history: $err');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone number', border: OutlineInputBorder()),
                    onSubmitted: (_) => _fetch(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _loading ? null : _fetch, child: const Text('Go')),
              ],
            ),
            const SizedBox(height: 16),
            if (_loading) const Center(child: CircularProgressIndicator()),
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            if (_orders != null && _orders!.isEmpty && !_loading)
              Text('No orders found for this number.', style: TextStyle(color: Colors.grey.shade600)),
            if (_orders != null)
              Expanded(
                child: ListView.separated(
                  itemCount: _orders!.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final order = _orders![index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(order.orderNumber),
                      subtitle: Text(orderStatusLabels[order.status] ?? order.status),
                      trailing: Text(formatNaira(order.total)),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => OrderStatusScreen(orderId: order.id)),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
