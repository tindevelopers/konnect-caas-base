"use client";

import React, { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";

const TELNYX_WIDGET_SCRIPT_URL = "https://unpkg.com/@telnyx/ai-agent-widget@next";

interface TelnyxWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string;
}

const LAUNCHER_BUTTON_LABEL = "Start a Conversation";

/** Finds the launcher CTA button inside the widget's shadow root (by original or our label). */
function findLauncherButton(widgetEl: HTMLElement): HTMLButtonElement | null {
  const root = widgetEl.shadowRoot;
  if (!root) return null;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  return (
    buttons.find((btn) => {
      const t = (btn.textContent || "").toLowerCase().trim();
      return (
        t.includes("start call") ||
        t.includes("start a conversation") ||
        t.includes("conversation") ||
        t.includes("let's chat") ||
        t.includes("chat")
      );
    }) ?? null
  );
}

/** Replaces "Start Call" (and variants) with new label in text nodes only; keeps DOM structure. */
function replaceLabelInTextNodes(root: Node, newLabel: string): void {
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root.textContent || "";
    if (/start call|let's chat/i.test(t)) {
      root.textContent = t.replace(/\s*start call\s*/gi, " " + newLabel + " ").replace(/\s*let's chat\s*/gi, " " + newLabel + " ").trim();
    }
    return;
  }
  root.childNodes.forEach((child) => replaceLabelInTextNodes(child, newLabel));
}

/**
 * Refactors the launcher CTA: hide icon, replace label in place, center. Does not wipe button DOM.
 */
function stripStartButtonIconAndCenterLabel(widgetEl: HTMLElement): void {
  const btn = findLauncherButton(widgetEl);
  if (!btn) return;
  btn.classList.add("telnyx-start-call-cta");
  btn.querySelectorAll("svg, img").forEach((el) => {
    (el as HTMLElement).style.setProperty("display", "none", "important");
  });
  Array.from(btn.children).forEach((child) => {
    const el = child as HTMLElement;
    const text = (el.textContent || "").trim();
    const hasIcon = el.querySelector("svg, img") || el.tagName === "SVG" || el.tagName === "IMG";
    const isLabel =
      /start call|start a conversation|conversation|let's chat|chat/i.test(text) && text.length > 2;
    if (hasIcon && !isLabel) el.style.setProperty("display", "none", "important");
  });
  replaceLabelInTextNodes(btn, LAUNCHER_BUTTON_LABEL);
  btn.style.display = "flex";
  btn.style.justifyContent = "center";
  btn.style.alignItems = "center";
  btn.style.minWidth = "220px";
  btn.style.paddingLeft = "1.25rem";
  btn.style.paddingRight = "1.25rem";
}

/**
 * Injects minimal CSS into the widget's shadow root to center the launcher CTA.
 * The default widget anchors it top-left; we center it in the modal.
 */
function centerWidgetLauncher(widgetEl: HTMLElement): void {
  const root = widgetEl.shadowRoot;
  if (!root) return;
  if (root.querySelector("#telnyx-widget-center-launcher")) return;

  const style = document.createElement("style");
  style.id = "telnyx-widget-center-launcher";
  style.textContent = `
    :host {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
    }
    /* Hide Telnyx logo/icon in the launcher CTA only (text-only "Start a Conversation") */
    button.telnyx-start-call-cta svg,
    button.telnyx-start-call-cta img,
    button.telnyx-start-call-cta > svg,
    button.telnyx-start-call-cta > img,
    button.telnyx-start-call-cta > [class*="icon"] {
      display: none !important;
    }
  `;
  root.appendChild(style);
}

/**
 * Loads the official Telnyx AI Agent widget script once.
 */
function ensureTelnyxWidgetScript(): Promise<void> {
  const existing = document.querySelector(`script[src="${TELNYX_WIDGET_SCRIPT_URL}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TELNYX_WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Telnyx AI Agent widget script."));
    document.head.appendChild(script);
  });
}

/** AI-themed decorative background: gradient, icons, and neural-style lines. Purely decorative, non-interactive. */
function ModalDecoration() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none"
      aria-hidden
    >
      {/* Soft gradient */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background:
            "linear-gradient(165deg, #f0f9ff 0%, #e0f2fe 25%, #f0f9ff 50%, #e0f2fe 75%, #f8fafc 100%)",
        }}
      />
      {/* Subtle neural / wave lines (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full rounded-xl opacity-[0.35]"
        viewBox="0 0 520 440"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M0,40 Q25,20 80,35 T160,30 T240,45 T320,25 T400,40 T520,35 V440 H0 Z"
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="0.5"
          filter="url(#glow)"
        />
        <path
          d="M0,120 Q60,100 120,115 T240,105 T360,125 T480,110 T520,115 V440 H0 Z"
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="0.4"
          opacity="0.7"
        />
        <path
          d="M0,200 Q80,180 200,195 T400,185 T520,200 V440 H0 Z"
          fill="none"
          stroke="#bae6fd"
          strokeWidth="0.3"
          opacity="0.5"
        />
        <path
          d="M0,280 Q100,260 260,275 T520,265 V440 H0 Z"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="0.35"
          opacity="0.4"
        />
        {/* Dots along lines */}
        <circle cx="80" cy="35" r="1.5" fill="#7dd3fc" opacity="0.6" />
        <circle cx="240" cy="45" r="1" fill="#0ea5e9" opacity="0.5" />
        <circle cx="400" cy="40" r="1.5" fill="#7dd3fc" opacity="0.5" />
        <circle cx="120" cy="115" r="1" fill="#bae6fd" opacity="0.6" />
        <circle cx="260" cy="275" r="1" fill="#7dd3fc" opacity="0.4" />
      </svg>
      {/* Floating AI icons - minimal SVG, low opacity */}
      {/* Robot (top-left) */}
      <svg
        className="absolute w-12 h-12 text-sky-200 opacity-60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{ left: "8%", top: "10%" }}
      >
        <circle cx="12" cy="10" r="4" />
        <path d="M6 16v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
        <circle cx="9" cy="8" r="0.8" fill="currentColor" />
        <circle cx="15" cy="8" r="0.8" fill="currentColor" />
      </svg>
      {/* Chat bubbles (near robot) */}
      <svg
        className="absolute w-8 h-8 text-sky-300 opacity-50"
        viewBox="0 0 24 24"
        style={{ left: "18%", top: "8%" }}
      >
        <ellipse cx="10" cy="10" rx="6" ry="5" fill="currentColor" />
        <path d="M6 14 L10 11 L14 14" fill="currentColor" opacity="0.8" />
      </svg>
      <svg
        className="absolute w-6 h-6 text-sky-300 opacity-40"
        viewBox="0 0 24 24"
        style={{ left: "22%", top: "14%" }}
      >
        <ellipse cx="10" cy="10" rx="5" ry="4" fill="currentColor" />
        <circle cx="8" cy="9" r="0.6" fill="white" opacity="0.9" />
        <circle cx="11" cy="9" r="0.6" fill="white" opacity="0.9" />
        <circle cx="14" cy="9" r="0.6" fill="white" opacity="0.9" />
      </svg>
      {/* Lightbulb (top-right) */}
      <svg
        className="absolute w-11 h-11 text-amber-200 opacity-50"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ right: "12%", top: "8%" }}
      >
        <path d="M9 21h6M12 3a6 6 0 014 10.5V16a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.5A6 6 0 0112 3z" />
        <path d="M12 11v2" stroke="currentColor" strokeWidth="0.8" fill="none" />
      </svg>
      {/* Gears (scattered) */}
      <svg
        className="absolute w-10 h-10 text-sky-200/60 opacity-50"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{ left: "6%", bottom: "28%" }}
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12M7.05 16.95l-2.12 2.12M19.07 4.93l-2.12 2.12" />
      </svg>
      <svg
        className="absolute w-8 h-8 text-sky-200/50 opacity-40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{ right: "18%", bottom: "22%" }}
      >
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.22 4.22l1.41 1.41M18.36 18.36l1.41 1.41M4.22 19.78l1.41-1.41M18.36 5.64l1.41-1.41M5.64 18.36l-1.41 1.41M19.78 4.22l-1.41 1.41" />
      </svg>
      <svg
        className="absolute w-7 h-7 text-sky-200/40 opacity-30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{ right: "8%", bottom: "35%" }}
      >
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.4 1.4M17.07 17.07l1.4 1.4M4.93 19.07l1.4-1.4M17.07 6.93l1.4-1.4M6.93 17.07l-1.4 1.4M19.07 4.93l-1.4 1.4" />
      </svg>
      {/* Brain / chip (bottom-left) */}
      <svg
        className="absolute w-11 h-11 text-sky-300/60 opacity-50"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        style={{ left: "10%", bottom: "12%" }}
      >
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <path d="M9 10h6M9 13h6M9 16h4" strokeWidth="0.8" />
        <circle cx="12" cy="14" r="1.5" fill="currentColor" opacity="0.5" />
      </svg>
    </div>
  );
}

/**
 * Modal that renders the default Telnyx AI Agent widget (chat + voice).
 * No custom branding — same design and functionality as the official embed snippet.
 */
export default function TelnyxWidgetModal({
  isOpen,
  onClose,
  assistantId,
}: TelnyxWidgetModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLElement | null>(null);
  const setShowFallbackCtaRef = useRef<(v: boolean) => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFallbackCta, setShowFallbackCta] = useState(false);
  setShowFallbackCtaRef.current = setShowFallbackCta;

  const handleFallbackCtaClick = () => {
    const el = widgetRef.current;
    if (!el) return;
    const btn = findLauncherButton(el);
    if (btn) {
      btn.click();
      setShowFallbackCta(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !assistantId) return;
    let centerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let mutationObserver: MutationObserver | null = null;

    setError(null);
    setLoading(true);
    setShowFallbackCta(false);

    ensureTelnyxWidgetScript()
      .then(() => {
        if (typeof customElements !== "undefined" && !customElements.get("telnyx-ai-agent")) {
          return Promise.race([
            customElements.whenDefined("telnyx-ai-agent"),
            new Promise<void>((r) => setTimeout(r, 3000)),
          ]);
        }
      })
      .then(() => {
        setLoading(false);
        const container = containerRef.current;
        if (!container) return;

        if (widgetRef.current?.parentNode) {
          widgetRef.current.remove();
          widgetRef.current = null;
        }

        const el = document.createElement("telnyx-ai-agent");
        el.setAttribute("agent-id", assistantId);
        el.setAttribute("environment", "production");
        el.setAttribute("position", "embedded");
        container.appendChild(el);
        widgetRef.current = el;

        const applyLauncherStyles = () => {
          centerWidgetLauncher(el);
          stripStartButtonIconAndCenterLabel(el);
          if (findLauncherButton(el)) setShowFallbackCtaRef.current(false);
        };
        applyLauncherStyles();
        centerTimeoutId = setTimeout(applyLauncherStyles, 500);

        const root = el.shadowRoot;
        if (root) {
          mutationObserver = new MutationObserver(() => applyLauncherStyles());
          mutationObserver.observe(root, { childList: true, subtree: true });
        }

        // If widget never shows a launcher button, show our own CTA after a short delay
        fallbackTimeoutId = setTimeout(() => {
          if (!findLauncherButton(el)) setShowFallbackCta(true);
        }, 1800);
      })
      .catch((err) => {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to load widget.");
      });

    return () => {
      if (centerTimeoutId != null) clearTimeout(centerTimeoutId);
      if (fallbackTimeoutId != null) clearTimeout(fallbackTimeoutId);
      mutationObserver?.disconnect();
      if (widgetRef.current?.parentNode) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [isOpen, assistantId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="relative m-5 sm:m-0 w-[min(100vw-2rem,520px)] min-w-[320px] min-h-[560px] rounded-2xl overflow-hidden"
      isFullscreen={false}
    >
      <div className="flex flex-col h-full min-h-[520px]">
        <div className="flex-1 relative min-h-[480px] p-3">
          {/* AI-themed decorative background (behind widget, non-interactive) */}
          <ModalDecoration />
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading widget…</p>
              </div>
            </div>
          )}
          {error && (
            <div className="relative z-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {error}
            </div>
          )}
          <div
            ref={containerRef}
            className="relative z-10 h-full w-full min-w-[280px] min-h-[440px] rounded-xl overflow-hidden [&_telnyx-ai-agent]:h-full [&_telnyx-ai-agent]:w-full [&_telnyx-ai-agent]:min-w-[280px] [&_telnyx-ai-agent]:min-h-[440px]"
          />
          {showFallbackCta && !loading && !error && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={handleFallbackCtaClick}
                className="pointer-events-auto min-w-[220px] px-5 py-3 rounded-full bg-white/95 text-gray-900 font-medium shadow-md border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
              >
                {LAUNCHER_BUTTON_LABEL}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
