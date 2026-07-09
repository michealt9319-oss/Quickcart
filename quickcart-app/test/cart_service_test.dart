import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:quickcart_app/services/cart_service.dart';
import 'package:quickcart_app/models/product.dart';

Product _product({String id = 'p1', String name = 'Rice', double price = 5000}) {
  return Product(
    id: id,
    supermarketId: 'sm1',
    name: name,
    price: price,
    unit: null,
    category: null,
    inStock: true,
    imageUrl: null,
  );
}

void main() {
  // CartService persists via SharedPreferences — mock its backing store so
  // tests don't depend on a real platform channel being available.
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('CartService', () {
    test('starts empty', () {
      final cart = CartService();
      expect(cart.isEmpty, true);
      expect(cart.total, 0);
    });

    test('adding a product increases subtotal and total', () {
      final cart = CartService();
      cart.addProduct(_product(price: 5000), quantity: 2);

      expect(cart.isEmpty, false);
      expect(cart.subtotal, 10000);
      expect(cart.total, 10000 + cart.deliveryFeeTotal + cart.convenienceFeeTotal);
    });

    test('adding the same product twice increases quantity rather than duplicating', () {
      final cart = CartService();
      cart.addProduct(_product(id: 'p1'), quantity: 1);
      cart.addProduct(_product(id: 'p1'), quantity: 2);

      expect(cart.items.length, 1);
      expect(cart.items.first.quantity, 3);
    });

    test('updateQuantity to zero removes the item', () {
      final cart = CartService();
      cart.addProduct(_product(id: 'p1'), quantity: 1);
      cart.updateQuantity('p1', 0);

      expect(cart.isEmpty, true);
    });

    test('clear empties the cart', () {
      final cart = CartService();
      cart.addProduct(_product());
      cart.clear();

      expect(cart.isEmpty, true);
      expect(cart.total, 0);
    });

    test('charges no delivery/convenience fee when empty', () {
      final cart = CartService();
      expect(cart.deliveryFeeTotal, 0);
      expect(cart.convenienceFeeTotal, 0);
    });
  });
}
