import { notFound } from "next/navigation";

const VOICE_SECTIONS: Record<string, { title: string; notes: string[] }> = {
  "programmable-voice": {
    title: "Programmable Voice",
    notes: ["Call Control (calls + action commands)", "Call control applications", "Call events/webhooks"],
  },
  "sip-trunking": {
    title: "SIP Trunking",
    notes: ["SIP connections", "Inbound routing and authentication settings"],
  },
  "microsoft-teams": {
    title: "Microsoft Teams",
    notes: ["Teams integration configuration surface (details TBD during implementation)"],
  },
  settings: {
    title: "Settings",
    notes: ["Outbound voice profiles", "Limits, recording, destination controls"],
  },
  "external-voice-integrations": {
    title: "External Voice Integrations",
    notes: ["Integration hooks for external systems (future)"],
  },
  debug: {
    title: "Debug",
    notes: ["Call event viewer and webhook diagnostics"],
  },
  reports: {
    title: "Reports",
    notes: ["Call volume/duration summaries (future)"],
  },
};

export default async function RtcVoiceSectionPage(props: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await props.params;
  const meta = VOICE_SECTIONS[section];
  if (!meta) notFound();

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Voice · {meta.title}</h1>
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

