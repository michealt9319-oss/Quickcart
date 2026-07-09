"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";

const CATEGORIES = ["All", "Groceries", "Toiletries", "Baby", "Drinks", "Cleaning"];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (search) params.set("search", search);

    setLoading(true);
    setError("");
    api
      .get(`/products?${params.toString()}`)
      .then((data) => setProducts(data.products ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <div className="container">
      <input
        className="search-input"
        placeholder="Search essentials"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <div
            key={c}
            className={`chip ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </div>
        ))}
      </div>

      {loading && <p className="muted">Loading products…</p>}
      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="muted">No products found. Seed the backend database using its schema.sql.</p>
      )}

      <div className="product-grid">
        {products.map((p) => (
          <Link key={p.id} href={`/product/${p.id}`} className="product-card">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="thumb" style={{ objectFit: "cover", width: "100%" }} />
            ) : (
              <div className="thumb" />
            )}
            <p className="name">{p.name}</p>
            <p className="price">{formatNaira(Number(p.price))}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
