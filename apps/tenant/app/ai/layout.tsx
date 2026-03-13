"use client";

import React from "react";
import AdminLayout from "@/layout/AdminLayout";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <main className="min-w-0 flex-1">{children}</main>
    </AdminLayout>
  );
}
