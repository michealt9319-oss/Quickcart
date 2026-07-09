"use client";

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, fontSize: 13 }}>
      <button className="btn secondary" style={{ width: "auto", padding: "4px 10px" }} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ← Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        className="btn secondary"
        style={{ width: "auto", padding: "4px 10px" }}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
