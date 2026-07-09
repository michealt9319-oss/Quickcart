"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";
import { downloadCsv } from "@/lib/csv";

interface ReportSummary {
  periodDays: number;
  orders: { total: number; totalRevenue: number; averageOrderValue: number };
  customers: { total: number; repeat: number; repeatRate: number };
  margin: {
    estimatedProductMargin: number;
    estimatedFeeContribution: number;
    estimatedTotalMargin: number;
    estimatedMarginPerOrder: number;
    lineItemsMissingCostPrice: number;
    note: string;
  };
}

const PERIOD_OPTIONS = [7, 30, 90];

export default function AdminReportsPage() {
  const { token } = useAdminAuth();
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState("");

  async function loadReport(periodDays: number) {
    if (!token) return;
    setLoading(true);
    setAccessError("");
    try {
      const data = await api.get(`/admin/reports/summary?days=${periodDays}`, { authToken: token });
      setReport(data);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("requires one of")) {
        setAccessError("Your account role does not have access to financial reports.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function exportCsv() {
    if (!report) return;
    downloadCsv(
      "performance-summary.csv",
      ["Metric", "Value"],
      [
        ["Period (days)", report.periodDays],
        ["Paid orders", report.orders.total],
        ["Total revenue", report.orders.totalRevenue],
        ["Average order value", report.orders.averageOrderValue],
        ["Customers who ordered", report.customers.total],
        ["Repeat rate", `${(report.customers.repeatRate * 100).toFixed(1)}%`],
        ["Estimated product margin", report.margin.estimatedProductMargin],
        ["Estimated fee contribution", report.margin.estimatedFeeContribution],
        ["Estimated total margin", report.margin.estimatedTotalMargin],
        ["Estimated margin per order", report.margin.estimatedMarginPerOrder],
        ["Line items missing cost_price", report.margin.lineItemsMissingCostPrice],
      ]
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 18 }}>Performance</h1>
        {report && (
          <button className="btn secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }} onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>

      {accessError && <p style={{ color: "#a32d2d", fontSize: 13, marginTop: 12 }}>{accessError}</p>}

      {!accessError && (
        <>
          <div className="chip-row">
            {PERIOD_OPTIONS.map((d) => (
              <div
                key={d}
                className={`chip ${days === d ? "active" : ""}`}
                onClick={() => {
                  setDays(d);
                  loadReport(d);
                }}
              >
                Last {d} days
              </div>
            ))}
          </div>

          {loading && <p className="muted">Loading…</p>}

          {report && !loading && (
            <>
              <h2 style={{ fontSize: 14, color: "#5b6670", marginTop: 20 }}>Orders</h2>
              <div className="row">
                <span className="muted">Paid orders</span>
                <span>{report.orders.total}</span>
              </div>
              <div className="row">
                <span className="muted">Total revenue</span>
                <span>{formatNaira(report.orders.totalRevenue)}</span>
              </div>
              <div className="row" style={{ borderBottom: "none" }}>
                <span className="muted">Average order value</span>
                <span>{formatNaira(report.orders.averageOrderValue)}</span>
              </div>

              <h2 style={{ fontSize: 14, color: "#5b6670", marginTop: 20 }}>Customers</h2>
              <div className="row">
                <span className="muted">Customers who ordered</span>
                <span>{report.customers.total}</span>
              </div>
              <div className="row" style={{ borderBottom: "none" }}>
                <span className="muted">Repeat rate</span>
                <span>{(report.customers.repeatRate * 100).toFixed(0)}%</span>
              </div>

              <h2 style={{ fontSize: 14, color: "#5b6670", marginTop: 20 }}>Estimated margin</h2>
              <div className="row">
                <span className="muted">Product markup</span>
                <span>{formatNaira(report.margin.estimatedProductMargin)}</span>
              </div>
              <div className="row">
                <span className="muted">Fee contribution</span>
                <span>{formatNaira(report.margin.estimatedFeeContribution)}</span>
              </div>
              <div className="row" style={{ fontWeight: 700 }}>
                <span>Estimated total margin</span>
                <span>{formatNaira(report.margin.estimatedTotalMargin)}</span>
              </div>
              <div className="row" style={{ borderBottom: "none" }}>
                <span className="muted">Per order</span>
                <span>{formatNaira(report.margin.estimatedMarginPerOrder)}</span>
              </div>

              <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
                {report.margin.note}
                {report.margin.lineItemsMissingCostPrice > 0 &&
                  ` ${report.margin.lineItemsMissingCostPrice} order line item(s) are missing a product cost_price and are excluded from the margin estimate above.`}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
