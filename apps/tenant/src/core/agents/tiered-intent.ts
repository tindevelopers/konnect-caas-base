import "server-only";

export type TierEscalationLevel = 2;

export type TieredIntentDecision =
  | { escalate: false; confidence: number }
  | { escalate: true; level: TierEscalationLevel; confidence: number };

const ESCALATION_PHRASES = [
  "book a room",
  "book room",
  "make a reservation",
  "reserve a room",
  "schedule an appointment",
  "book an appointment",
  "buy product",
  "buy this",
  "buy that",
  "purchase product",
  "i want to buy",
  "i want to purchase",
  "place an order",
  "order this",
  // Strategic / enterprise / complex intents
  "compare plans",
  "compare pricing",
  "pricing options",
  "enterprise",
  "implementation roadmap",
  "rollout plan",
  "integration plan",
  "security review",
  "data residency",
  "sla",
  "roi",
  "call center",
  "contact center",
  "50 agents",
];

const L1_ESCALATION_HINTS = [
  "i can't help with booking",
  "i can't help with reservations",
  "connect you to our booking",
  "booking team",
  "i can't help with purchases",
  "i can't process orders",
  "connect you to a specialist",
  "sales specialist",
  "enterprise team",
  "solutions engineer",
  "implementation team",
];

const RESET_PHRASES = [
  "start over",
  "reset",
  "new chat",
  "talk to the first agent",
  "back to the first agent",
];

function normalize(text: string | undefined) {
  return (text ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function isTieredResetCommand(message: string): boolean {
  const normalized = normalize(message);
  return includesAny(normalized, RESET_PHRASES);
}

export function detectTieredIntent(
  message: string,
  l1Response?: string
): TieredIntentDecision {
  const user = normalize(message);
  const l1 = normalize(l1Response);

  let confidence = includesAny(user, ESCALATION_PHRASES) ? 0.9 : 0;

  if (l1 && includesAny(l1, L1_ESCALATION_HINTS)) confidence += 0.1;

  confidence = Math.min(1, confidence);

  const result: TieredIntentDecision =
    confidence === 0
      ? { escalate: false, confidence: 0 }
      : { escalate: true, level: 2, confidence };

  // #region agent log
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "tiered-intent.ts:detectTieredIntent",
        message: "Intent result",
        data: {
          messageLen: message.length,
          userSample: user.slice(0, 80),
          l1Sample: l1?.slice(0, 80) ?? null,
          escalate: result.escalate,
          confidence: result.confidence,
        },
        timestamp: Date.now(),
        hypothesisId: "H3",
      }),
    }).catch(() => {});
  }
  // #endregion

  return result;
}
