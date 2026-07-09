import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import '../services/cart_service.dart';
import '../utils/currency.dart';
import 'cart_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  late Future<Product> _productFuture;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _productFuture = ApiClient.fetchProduct(widget.productId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Product')),
      body: FutureBuilder<Product>(
        future: _productFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(child: Text('Product not found.'));
          }
          final product = snapshot.data!;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(
                  aspectRatio: 1.6,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: product.imageUrl != null
                        ? Image.network(
                            product.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF2F5F3)),
                          )
                        : Container(color: const Color(0xFFF2F5F3)),
                  ),
                ),
                const SizedBox(height: 16),
                Text(product.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                if (product.category != null)
                  Text(product.category!, style: TextStyle(color: Colors.grey.shade600)),
                const SizedBox(height: 12),
                Text(
                  '${formatNaira(product.price)}${product.unit != null ? " / ${product.unit}" : ""}',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    const Text('Quantity'),
                    const SizedBox(width: 16),
                    IconButton(
                      onPressed: () => setState(() => _quantity = (_quantity - 1).clamp(1, 99)),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Text('$_quantity', style: const TextStyle(fontSize: 16)),
                    IconButton(
                      onPressed: () => setState(() => _quantity = (_quantity + 1).clamp(1, 99)),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      context.read<CartService>().addProduct(product, quantity: _quantity);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen()));
                    },
                    child: const Text('Add to cart'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
