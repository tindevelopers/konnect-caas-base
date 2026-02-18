"use client";

import AdminLayout from "@/layout/AdminLayout";
import React from "react";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
