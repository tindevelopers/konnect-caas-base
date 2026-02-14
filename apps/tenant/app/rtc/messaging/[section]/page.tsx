import { notFound } from "next/navigation";

const MESSAGING_SECTIONS: Record<string, { title: string; notes: string[] }> = {
  "programmable-messaging": {
    title: "Programmable Messaging",
    notes: ["Messages API (send/list/retrieve)", "Scheduling, number pools, delivery events"],
  },
  // compliance has its own dedicated page at /rtc/messaging/compliance
  settings: {
    title: "Settings",
    notes: ["Messaging profiles", "Webhook configuration"],
  },
  debug: {
    title: "Debug",
    notes: ["Webhook event inspection", "Delivery troubleshooting"],
  },
  reports: {
    title: "Reports",
    notes: ["Messaging volume and delivery metrics (future)"],
  },
};

export default async function RtcMessagingSectionPage(props: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await props.params;
  const meta = MESSAGING_SECTIONS[section];
  if (!meta) notFound();

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Messaging · {meta.title}</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Stub page. We’ll wire this to Telnyx APIs later.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
        {meta.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </main>
  );
}

