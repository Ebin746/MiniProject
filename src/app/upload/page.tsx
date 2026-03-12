// src/components/PolicyUpload.tsx
"use client";
import { useState } from "react";

export default function PolicyUpload() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus("Uploading and indexing...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/policy/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setLoading(false);
    setStatus(
      res.ok
        ? `✓ ${data.message}`
        : `✗ ${data.error}`
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold mb-2">Upload Policy Document (PDF)</h3>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleUpload}
        disabled={loading}
        className="block w-full text-sm"
      />
      {status && (
        <p className="mt-2 text-sm text-gray-600">{status}</p>
      )}
    </div>
  );
}