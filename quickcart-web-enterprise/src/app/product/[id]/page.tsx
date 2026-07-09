"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types";
import { formatNaira } from "@/lib/pricing";
import { addToCart } from "@/lib/cart";
import { api } from "@/lib/api";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();

  useEffect(() => {
    api
      .get(`/products/${params.id}`)
      .then((data) => setProduct(data.product ?? null))
      .catch(() => setProduct(null));
  }, [params.id]);

  if (!product) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container">
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, marginBottom: 16 }}
        />
      ) : (
        <div className="thumb" style={{ height: 180, marginBottom: 16 }} />
      )}
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>{product.name}</h1>
      <p className="muted">{product.category}</p>
      <p style={{ fontSize: 20, fontWeight: 700, margin: "12px 0" }}>
        {formatNaira(Number(product.price))}
        {product.unit ? ` / ${product.unit}` : ""}
      </p>

      <div className="field">
        <label>Quantity</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn secondary" style={{ width: 40 }} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span>{quantity}</span>
          <button className="btn secondary" style={{ width: 40 }} onClick={() => setQuantity((q) => q + 1)}>
            +
          </button>
        </div>
      </div>

      <button
        className="btn"
        onClick={() => {
          addToCart({ productId: product.id, name: product.name, price: Number(product.price) }, quantity);
          router.push("/cart");
        }}
      >
        Add to cart
      </button>
    </div>
  );
}
