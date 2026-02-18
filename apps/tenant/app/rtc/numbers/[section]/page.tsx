import { notFound } from "next/navigation";

const NUMBERS_SECTIONS: Record<string, { title: string; notes: string[] }> = {
  "buy-numbers": {
    title: "Buy Numbers",
    notes: ["Search available numbers", "Reservations and orders", "Advanced orders"],
  },
  "manage-numbers": {
    title: "Manage Numbers",
    notes: ["Inventory and features", "Assign messaging/voice settings (future)"],
  },
  "port-numbers": {
    title: "Port Numbers",
    notes: ["Port-in/port-out lifecycle", "Porting events and notifications"],
  },
  compliance: {
    title: "Compliance",
    notes: ["Requirement groups", "Regulatory requirements and documents"],
  },
  reports: {
    title: "Reports",
    notes: ["Order status and porting timelines (future)"],
  },
};

export default async function RtcNumbersSectionPage(props: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await props.params;
  const meta = NUMBERS_SECTIONS[section];
  if (!meta) notFound();

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Numbers · {meta.title}</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Stub page. We’ll wire this to provider APIs later.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
        {meta.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </main>
  );
}

