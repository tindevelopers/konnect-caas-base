"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import {
  listNumberOrdersAction,
  listOwnedPhoneNumbersAction,
  listPortingOrdersAction,
  type TelnyxNumberOrder,
  type TelnyxPhoneNumber,
  type TelnyxPortingOrder,
} from "@/app/actions/telnyx/numbers";

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)))
  );

  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const header = keys.join(",");
  const lines = rows.map((r) => keys.map((k) => escape(r[k])).join(","));
  const csv = [header, ...lines].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function NumbersReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([]);
  const [orders, setOrders] = useState<TelnyxNumberOrder[]>([]);
  const [portingOrders, setPortingOrders] = useState<TelnyxPortingOrder[]>([]);

  const ownedByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of phoneNumbers) {
      const key = n.status ?? "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [phoneNumbers]);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const [owned, ord, ports] = await Promise.all([
        listOwnedPhoneNumbersAction({ pageNumber: 1, pageSize: 50, handleMessagingProfileError: true }),
        listNumberOrdersAction({ pageNumber: 1, pageSize: 25 }),
        listPortingOrdersAction({ pageNumber: 1, pageSize: 25 }),
      ]);
      setPhoneNumbers(owned.data ?? []);
      setOrders(ord.data ?? []);
      setPortingOrders(ports.data ?? []);
      setInfo("Loaded latest report data.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div>
      <PageBreadcrumb pageTitle="Reports" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Operational reporting from live Telnyx data (no database required).
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert variant="success" title="Info" message={info} />
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button onClick={loadAll} disabled={isLoading}>
          {isLoading ? "Loading…" : "Refresh all"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Owned phone numbers</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Snapshot of first 50 numbers (paginate in Manage Numbers for full list).
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `owned_phone_numbers_${new Date().toISOString().slice(0, 10)}.csv`,
                  phoneNumbers.map((n) => ({
                    id: n.id,
                    phone_number: n.phone_number,
                    status: n.status,
                    country: n.country_iso_alpha2,
                    type: n.phone_number_type,
                    connection_id: n.connection_id,
                    connection_name: n.connection_name,
                    messaging_profile_id: n.messaging_profile_id,
                    messaging_profile_name: n.messaging_profile_name,
                    tags: (n.tags ?? []).join("|"),
                  }))
                )
              }
              disabled={phoneNumbers.length === 0}
            >
              Export CSV
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total (page)</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{phoneNumbers.length}</p>
            </div>
            <div className="md:col-span-2 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white/90">By status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ownedByStatus.length === 0 ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                ) : (
                  ownedByStatus.map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-white/[0.06] dark:text-gray-200"
                    >
                      {k}: {v}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {phoneNumbers.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">Number</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Country</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Connection</th>
                    <th className="py-3 pr-4">Messaging profile</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-white/90">
                  {phoneNumbers.map((n) => (
                    <tr key={n.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-3 pr-4 font-medium">{n.phone_number}</td>
                      <td className="py-3 pr-4">{n.status ?? "-"}</td>
                      <td className="py-3 pr-4">{n.country_iso_alpha2 ?? "-"}</td>
                      <td className="py-3 pr-4">{n.phone_number_type ?? "-"}</td>
                      <td className="py-3 pr-4">{n.connection_name ?? n.connection_id ?? "-"}</td>
                      <td className="py-3 pr-4">{n.messaging_profile_name ?? n.messaging_profile_id ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Number orders</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest 25 orders.</p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `number_orders_${new Date().toISOString().slice(0, 10)}.csv`,
                  orders.map((o) => ({
                    id: o.id,
                    status: o.status,
                    requirements_met: o.requirements_met,
                    phone_numbers_count: o.phone_numbers_count,
                    connection_id: o.connection_id,
                    messaging_profile_id: o.messaging_profile_id,
                    billing_group_id: o.billing_group_id,
                    customer_reference: o.customer_reference,
                    created_at: o.created_at,
                  }))
                )
              }
              disabled={orders.length === 0}
            >
              Export CSV
            </Button>
          </div>

          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No orders found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Count</th>
                    <th className="py-3 pr-4">Requirements</th>
                    <th className="py-3 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-white/90">
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{o.id}</span>
                      </td>
                      <td className="py-3 pr-4">{o.status ?? "-"}</td>
                      <td className="py-3 pr-4">{o.phone_numbers_count ?? o.phone_numbers?.length ?? "-"}</td>
                      <td className="py-3 pr-4">{String(Boolean(o.requirements_met))}</td>
                      <td className="py-3 pr-4">{o.created_at ? new Date(o.created_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Porting orders</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest 25 porting orders.</p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `porting_orders_${new Date().toISOString().slice(0, 10)}.csv`,
                  portingOrders.map((p) => ({
                    id: p.id,
                    status: p.status?.value,
                    count: p.porting_phone_numbers_count,
                    customer_reference: p.customer_reference,
                    support_key: p.support_key,
                    created_at: p.created_at,
                  }))
                )
              }
              disabled={portingOrders.length === 0}
            >
              Export CSV
            </Button>
          </div>

          {portingOrders.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No porting orders found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Count</th>
                    <th className="py-3 pr-4">Customer ref</th>
                    <th className="py-3 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-white/90">
                  {portingOrders.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{p.id}</span>
                      </td>
                      <td className="py-3 pr-4">{p.status?.value ?? "-"}</td>
                      <td className="py-3 pr-4">{p.porting_phone_numbers_count ?? "-"}</td>
                      <td className="py-3 pr-4">{p.customer_reference ?? "-"}</td>
                      <td className="py-3 pr-4">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

