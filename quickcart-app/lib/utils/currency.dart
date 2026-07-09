import 'package:intl/intl.dart';

/// Mirrors quickcart-backend/src/lib/pricing.ts, used here only to show a
/// live total before checkout. The backend recalculates from scratch
/// server-side and is the only source that determines what's actually
/// charged. Same duplication trade-off as the web app — fine at this
/// volume, worth consolidating if it ever drifts from the backend.
const double deliveryFee = 700;
const double convenienceFee = 300;

final _nairaFormat = NumberFormat.currency(locale: 'en_NG', symbol: '\u20a6', decimalDigits: 0);

String formatNaira(num amount) => _nairaFormat.format(amount);
