"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

export default function DeliveryZonesPage() {
  const { token } = useAdminAuth();
  const [zones, setZones] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [checkLat, setCheckLat] = useState("");
  const [checkLng, setCheckLng] = useState("");
  const [checkResult, setCheckResult] = useState<any | null>(null);

  async function load() {
    if (!token) return;
    try {
      const data = await api.get("/delivery-zones", { authToken: token });
      setZones(data.deliveryZones ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createZone() {
    if (!token) return;
    await api.post(
      "/delivery-zones",
      { name, centerLat: Number(centerLat), centerLng: Number(centerLng), radiusKm: Number(radiusKm) },
      { authToken: token }
    );
    setName("");
    setCenterLat("");
    setCenterLng("");
    setRadiusKm("");
    load();
  }

  async function check() {
    try {
      const data = await api.post("/delivery-zones/check", { lat: Number(checkLat), lng: Number(checkLng) });
      setCheckResult(data);
    } catch (err: any) {
      setCheckResult({ error: err.message });
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 18 }}>Delivery Zones</h1>
      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Create zone</h2>
        <div className="field">
          <label>Name</label>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="text-input" value={centerLat} onChange={(e) => setCenterLat(e.target.value)} placeholder="center lat" />
          <input className="text-input" value={centerLng} onChange={(e) => setCenterLng(e.target.value)} placeholder="center lng" />
          <input className="text-input" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="radius km" />
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={createZone} disabled={!name || !centerLat || !centerLng || !radiusKm}>
            Create
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 14 }}>Existing zones</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Center</th>
            <th>Radius (km)</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id}>
              <td>{z.name}</td>
              <td>{`${z.center_lat}, ${z.center_lng}`}</td>
              <td>{z.radius_km}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 20, border: "1px solid #d8dee3", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Check deliverability</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="text-input" value={checkLat} onChange={(e) => setCheckLat(e.target.value)} placeholder="lat" />
          <input className="text-input" value={checkLng} onChange={(e) => setCheckLng(e.target.value)} placeholder="lng" />
          <button className="btn" onClick={check} disabled={!checkLat || !checkLng}>
            Check
          </button>
        </div>
        {checkResult && (
          <div style={{ marginTop: 12 }}>
            <pre style={{ background: "#f6f8f9", padding: 8 }}>{JSON.stringify(checkResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
