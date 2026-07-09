class OrderSummary {
  final String id;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final double total;
  final DateTime? createdAt;

  OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.total,
    this.createdAt,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    return OrderSummary(
      id: json['id'] as String? ?? '',
      orderNumber: json['order_number'] as String,
      status: json['status'] as String,
      paymentStatus: json['payment_status'] as String,
      total: double.parse(json['total'].toString()),
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
    );
  }
}

const Map<String, String> orderStatusLabels = {
  'pending': 'Awaiting payment',
  'confirmed': 'Confirmed',
  'packing': 'Being packed',
  'with_rider': 'With your rider',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
};
