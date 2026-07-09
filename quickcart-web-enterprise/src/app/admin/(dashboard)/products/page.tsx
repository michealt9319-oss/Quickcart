"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import { formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

interface AdminProduct extends Product {
  cost_price?: string | null;
}

export default function AdminProductsPage() {
  const { token } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState("");

  // New-product form state
  const [supermarketId, setSupermarketId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!token) return;
    try {
      // Reuses the public products list endpoint — it's already
      // organization-scoped via the tenant header baked into api.ts, and
      // returning only in-stock items here is a reasonable default for an
      // admin view too.
      const data = await api.get("/products");
      setProducts(data.products ?? []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Uploads directly to storage using a presigned URL — the image bytes
  // never pass through our own API. See backend's lib/s3.ts for why.
  async function uploadImageIfPresent(): Promise<string | undefined> {
    if (!imageFile || !token) return undefined;
    setUploadingImage(true);
    try {
      const { uploadUrl, publicUrl } = await api.post(
        "/uploads/presign",
        { contentType: imageFile.type },
        { authToken: token }
      );
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": imageFile.type },
        body: imageFile,
      });
      if (!uploadRes.ok) throw new Error("Image upload to storage failed");
      return publicUrl;
    } finally {
      setUploadingImage(false);
    }
  }

  async function createProduct() {
    if (!token || !supermarketId || !name || !price) {
      setError("Supermarket ID, name, and price are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const imageUrl = await uploadImageIfPresent();
      await api.post(
        "/products",
        {
          supermarketId,
          name,
          price: Number(price),
          costPrice: costPrice ? Number(costPrice) : undefined,
          unit: unit || undefined,
          category: category || undefined,
          imageUrl,
        },
        { authToken: token }
      );
      setName("");
      setPrice("");
      setCostPrice("");
      setUnit("");
      setCategory("");
      setImageFile(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStock(product: AdminProduct) {
    if (!token) return;
    await api.put(`/products/${product.id}`, { inStock: !product.in_stock }, { authToken: token });
    load();
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 18 }}>Products</h1>

      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Add a product</h2>
        <div className="field">
          <label>Supermarket ID</label>
          <input className="text-input" value={supermarketId} onChange={(e) => setSupermarketId(e.target.value)} placeholder="uuid — see the Supermarkets tab" />
        </div>
        <div className="field">
          <label>Name</label>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Price (₦)</label>
            <input className="text-input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Cost price (₦, optional)</label>
            <input className="text-input" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Unit (optional)</label>
            <input className="text-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pack..." />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Category (optional)</label>
            <input className="text-input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Photo (optional — requires S3 configured on the backend)</label>
          <input
            className="text-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
        <button className="btn" onClick={createProduct} disabled={submitting || uploadingImage}>
          {uploadingImage ? "Uploading photo…" : submitting ? "Adding…" : "Add product"}
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Photo</th>
            <th>Name</th>
            <th>Price</th>
            <th>In stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 32, height: 32, background: "#f2f5f3", borderRadius: 4 }} />
                )}
              </td>
              <td>{p.name}</td>
              <td>{formatNaira(Number(p.price))}</td>
              <td>{p.in_stock ? "Yes" : "No"}</td>
              <td>
                <button className="btn secondary" style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} onClick={() => toggleStock(p)}>
                  {p.in_stock ? "Mark out of stock" : "Mark in stock"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && <p className="muted">No products yet.</p>}
    </div>
  );
}
