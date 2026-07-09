import 'package:flutter/material.dart';
import '../models/order.dart';
import '../services/api_client.dart';
import '../utils/currency.dart';

class OrderLookupScreen extends StatefulWidget {
  const OrderLookupScreen({super.key});

  @override
  State<OrderLookupScreen> createState() => _OrderLookupScreenState();
}

class _OrderLookupScreenState extends State<OrderLookupScreen> {
  final _phoneController = TextEditingController();
  final _orderNumberController = TextEditingController();

  bool _loading = false;
  String? _error;
  OrderSummary? _order;

  Future<void> _lookup() async {
    setState(() {
      _loading = true;
      _error = null;
      _order = null;
    });
    try {
      final order = await ApiClient.lookupOrder(
        phone: _phoneController.text.trim(),
        orderNumber: _orderNumberController.text.trim(),
      );
      setState(() => _order = order);
    } catch (err) {
      setState(() => _error = '$err');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Track your order')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Phone number used at checkout',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _orderNumberController,
              decoration: const InputDecoration(labelText: 'Order number', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _loading ? null : _lookup,
                child: Text(_loading ? 'Checking…' : 'Check status'),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            if (_order != null) ...[
              const SizedBox(height: 20),
              _row('Status', orderStatusLabels[_order!.status] ?? _order!.status),
              _row('Total', formatNaira(_order!.total)),
            ],
          ],
        ),
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
