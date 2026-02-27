import "server-only";

export type TierEscalationLevel = 2 | 3;

export type TieredIntentDecision =
  | { escalate: false; confidence: number }
  | { escalate: true; level: TierEscalationLevel; confidence: number };

const LEVEL2_PHRASES = [
  "book a room",
  "book room",
  "make a reservation",
  "reserve a room",
  "schedule an appointment",
  "book an appointment",
];

const LEVEL3_PHRASES = [
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

const LEVEL2_L1_HINTS = [
  "i can't help with booking",
  "i can't help with reservations",
  "connect you to our booking",
  "booking team",
];

const LEVEL3_L1_HINTS = [
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

  let l2Confidence = includesAny(user, LEVEL2_PHRASES) ? 0.9 : 0;
  let l3Confidence = includesAny(user, LEVEL3_PHRASES) ? 0.9 : 0;

  if (l1 && includesAny(l1, LEVEL2_L1_HINTS)) l2Confidence += 0.1;
  if (l1 && includesAny(l1, LEVEL3_L1_HINTS)) l3Confidence += 0.1;

  l2Confidence = Math.min(1, l2Confidence);
  l3Confidence = Math.min(1, l3Confidence);

  if (l2Confidence === 0 && l3Confidence === 0) {
    return { escalate: false, confidence: 0 };
  }

  if (l3Confidence > l2Confidence) {
    return { escalate: true, level: 3, confidence: l3Confidence };
  }

  return { escalate: true, level: 2, confidence: l2Confidence };
}
