class Product {
  final String id;
  final String supermarketId;
  final String name;
  final double price;
  final String? unit;
  final String? category;
  final bool inStock;
  final String? imageUrl;

  Product({
    required this.id,
    required this.supermarketId,
    required this.name,
    required this.price,
    this.unit,
    this.category,
    required this.inStock,
    this.imageUrl,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      supermarketId: json['supermarket_id'] as String,
      name: json['name'] as String,
      // Postgres numeric columns arrive as strings over JSON — always parse.
      price: double.parse(json['price'].toString()),
      unit: json['unit'] as String?,
      category: json['category'] as String?,
      inStock: json['in_stock'] as bool? ?? true,
      imageUrl: json['image_url'] as String?,
    );
  }
}
