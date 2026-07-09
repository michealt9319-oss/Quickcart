"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const orgSlug = searchParams.get("org") || "";
  const [status, setStatus] = useState<"verifying" | "done" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !orgSlug) {
      setStatus("error");
      setError("This verification link is missing required information.");
      return;
    }
    api
      .post("/organizations/verify-email", { organizationSlug: orgSlug, token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1 style={{ fontSize: 18 }}>Email verification</h1>
      {status === "verifying" && <p className="muted">Verifying…</p>}
      {status === "done" && (
        <>
          <p style={{ color: "#0f6e56" }}>Your email has been verified.</p>
          <a href="/admin/orders" className="btn" style={{ display: "inline-block", marginTop: 12 }}>
            Go to login
          </a>
        </>
      )}
      {status === "error" && <p style={{ color: "#a32d2d" }}>{error}</p>}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="container">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <VerifyEmailStatus />
      </Suspense>
    </div>
  );
}
