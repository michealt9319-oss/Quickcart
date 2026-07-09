import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quickcart_app/models/product.dart';
import 'package:quickcart_app/widgets/product_card.dart';

void main() {
  testWidgets('ProductCard shows product name and price, and responds to tap', (tester) async {
    final product = Product(
      id: 'p1',
      supermarketId: 'sm1',
      name: 'Rice, 5kg',
      price: 7500,
      unit: null,
      category: null,
      inStock: true,
      imageUrl: null,
    );

    var tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProductCard(product: product, onTap: () => tapped = true),
        ),
      ),
    );

    expect(find.text('Rice, 5kg'), findsOneWidget);
    expect(find.textContaining('7,500'), findsOneWidget);

    await tester.tap(find.byType(InkWell));
    expect(tapped, true);
  });
}
