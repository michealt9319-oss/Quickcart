import 'package:flutter_test/flutter_test.dart';
import 'package:quickcart_app/utils/currency.dart';

void main() {
  group('formatNaira', () {
    test('formats a whole number amount with the naira symbol', () {
      expect(formatNaira(10750), contains('10,750'));
      expect(formatNaira(10750), contains('\u20a6'));
    });

    test('formats zero correctly', () {
      expect(formatNaira(0), contains('0'));
    });

    test('formats large amounts with thousands separators', () {
      expect(formatNaira(1500000), contains('1,500,000'));
    });
  });
}
