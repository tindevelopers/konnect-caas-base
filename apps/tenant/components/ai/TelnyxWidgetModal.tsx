"use client";

import React, { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";

const TELNYX_WIDGET_SCRIPT_URL = "https://unpkg.com/@telnyx/ai-agent-widget@next";
const TELNYX_AUTOSTART_TIMEOUT_MS = 10000;
const TELNYX_AUTOSTART_POLL_MS = 350;
const PORTAL_LOGO_PATH = "/images/logo/logo-icon.svg";
const WIDGET_BRAND_STYLE_ID = "telnyx-widget-portal-branding";
const PORTAL_PRIMARY = "#03b6fc";
const PORTAL_PRIMARY_DARK = "#0297d1";
const PORTAL_WHITE = "#ffffff";

function parseRgbColor(colorValue: string): [number, number, number] | null {
  const match = colorValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNearColor(
  color: [number, number, number] | null,
  target: [number, number, number],
  tolerance: number
): boolean {
  if (!color) return false;
  return (
    Math.abs(color[0] - target[0]) <= tolerance &&
    Math.abs(color[1] - target[1]) <= tolerance &&
    Math.abs(color[2] - target[2]) <= tolerance
  );
}

function isGreenAccent(color: [number, number, number] | null): boolean {
  if (!color) return false;
  const [r, g, b] = color;
  return g > r + 18 && g > b + 18;
}

function isRedAccent(color: [number, number, number] | null): boolean {
  if (!color) return false;
  const [r, g, b] = color;
  return r > g + 18 && r > b + 18;
}

interface TelnyxWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string;
}

/**
 * Loads the official Telnyx AI Agent widget script (same as Mission Control Widget tab).
 * Ensures the script is only added once to the document.
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

function findStartButton(widgetEl: HTMLElement): HTMLButtonElement | null {
  const root = widgetEl.shadowRoot;
  if (!root) return null;

  const buttons = Array.from(root.querySelectorAll("button"));
  return (
    buttons.find((button) => {
      const text = (button.textContent || "").toLowerCase().trim();
      return text.includes("start call") || text.includes("let's chat") || text.includes("chat");
    }) || null
  );
}

function findInternalStartButton(widgetEl: HTMLElement): HTMLButtonElement | null {
  const root = widgetEl.shadowRoot;
  if (!root) return null;

  const byText = findStartButton(widgetEl);
  if (byText) return byText;

  // Fallback: collapsed start button usually has text-xl + font-medium in the widget bundle.
  const byClass = root.querySelector<HTMLButtonElement>('button[class*="text-xl"][class*="font-medium"]');
  if (byClass) return byClass;

  // Last resort: button with start/chat in aria-label or title (widget may use icon-only).
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  const byAria = allButtons.find((b) => {
    const aria = (b.getAttribute("aria-label") || "").toLowerCase();
    const title = (b.getAttribute("title") || "").toLowerCase();
    if (aria.includes("close") || aria.includes("collapse") || title.includes("close") || title.includes("collapse"))
      return false;
    return aria.includes("start") || aria.includes("chat") || title.includes("start") || title.includes("chat");
  });
  return byAria ?? null;
}

function autoStartWidget(widgetEl: HTMLElement): () => void {
  let isStopped = false;

  const clickStartButton = () => {
    const button = findInternalStartButton(widgetEl);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  };

  const stop = (observer?: MutationObserver, intervalId?: number, timeoutId?: number) => {
    if (isStopped) return;
    isStopped = true;
    observer?.disconnect();
    if (intervalId) window.clearInterval(intervalId);
    if (timeoutId) window.clearTimeout(timeoutId);
  };

  clickStartButton();

  const observer = new MutationObserver(() => {
    // Keep trying while the collapsed launcher is visible.
    const startButton = findInternalStartButton(widgetEl);
    if (!startButton) {
      stop(observer);
      return;
    }
    clickStartButton();
  });

  if (widgetEl.shadowRoot) {
    observer.observe(widgetEl.shadowRoot, { subtree: true, childList: true });
  } else {
    observer.observe(widgetEl, { subtree: true, childList: true });
  }

  const intervalId = window.setInterval(() => {
    const startButton = findInternalStartButton(widgetEl);
    if (!startButton) {
      stop(observer, intervalId);
      return;
    }
    clickStartButton();
  }, TELNYX_AUTOSTART_POLL_MS);

  const timeoutId = window.setTimeout(
    () => stop(observer, intervalId),
    TELNYX_AUTOSTART_TIMEOUT_MS
  );

  return () => {
    stop(observer, intervalId, timeoutId);
  };
}

function injectWidgetBrandStyles(widgetEl: HTMLElement): void {
  const root = widgetEl.shadowRoot;
  if (!root) return;
  if (root.querySelector(`#${WIDGET_BRAND_STYLE_ID}`)) return;

  const style = document.createElement("style");
  style.id = WIDGET_BRAND_STYLE_ID;
  style.textContent = `
    :host {
      --portal-primary: ${PORTAL_PRIMARY};
      --portal-primary-dark: ${PORTAL_PRIMARY_DARK};
      --portal-surface: ${PORTAL_WHITE};
      --portal-border: #e5e7eb;
      --portal-text: #111827;
    }

    :host, :host * {
      box-sizing: border-box;
    }

    * {
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif !important;
    }

    button {
      border-radius: 9999px !important;
    }

    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--portal-primary) 35%, transparent) !important;
      outline-offset: 1px !important;
    }

    input, textarea {
      border-radius: 12px !important;
      border-color: var(--portal-border) !important;
      color: var(--portal-text) !important;
      background: var(--portal-surface) !important;
    }

    /* Give the widget shell a cleaner portal-like card treatment */
    [class*="shadow-lg"] {
      box-shadow: 0 12px 30px rgba(3, 182, 252, 0.16) !important;
      border: 1px solid #b9ebff !important;
      background: ${PORTAL_WHITE} !important;
    }

    /* White + blue message bubbles */
    div[class*="flex flex-col gap-2"][class*="items-end"] p[class*="text-sm"] {
      background: linear-gradient(135deg, ${PORTAL_PRIMARY} 0%, ${PORTAL_PRIMARY_DARK} 100%) !important;
      color: #ffffff !important;
      padding: 10px 12px !important;
      border-radius: 14px !important;
      box-shadow: 0 8px 18px rgba(3, 182, 252, 0.22) !important;
    }

    div[class*="flex flex-col gap-2"]:not([class*="items-end"]) p[class*="text-sm"] {
      background: ${PORTAL_WHITE} !important;
      color: #111827 !important;
      border: 1px solid #d9e5ef !important;
      padding: 10px 12px !important;
      border-radius: 14px !important;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08) !important;
      max-width: 88% !important;
    }

    /* Chat composer row */
    div[class*="rounded-full"][class*="border"] {
      border: 1px solid #b6e8ff !important;
      background: ${PORTAL_WHITE} !important;
      box-shadow: 0 4px 12px rgba(3, 182, 252, 0.14) !important;
    }

    div[class*="rounded-full"][class*="border"] input,
    div[class*="rounded-full"][class*="border"] textarea {
      border: 0 !important;
      color: #0f172a !important;
    }

    /* Make bottom attach/camera/send controls clearly visible */
    div[class*="rounded-full"][class*="border"] button {
      background: linear-gradient(135deg, ${PORTAL_PRIMARY} 0%, ${PORTAL_PRIMARY_DARK} 100%) !important;
      border: 0 !important;
      box-shadow: 0 6px 14px rgba(3, 182, 252, 0.28) !important;
      opacity: 1 !important;
    }

    div[class*="rounded-full"][class*="border"] button svg,
    div[class*="rounded-full"][class*="border"] button [class*="text-"] {
      color: #ffffff !important;
      stroke: #ffffff !important;
      fill: #ffffff !important;
      opacity: 1 !important;
    }
  `;

  root.appendChild(style);
}

function retintWidgetPalette(widgetEl: HTMLElement): void {
  const root = widgetEl.shadowRoot;
  if (!root) return;

  const startButton = findStartButton(widgetEl);
  const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const element of elements) {
    // Never overwrite the start button — keep its blue gradient and visible "Start Chat" label.
    if (startButton && element === startButton) continue;

    const computed = window.getComputedStyle(element);
    const bg = parseRgbColor(computed.backgroundColor);

    // Convert the widget's default beige surfaces to crisp white surfaces.
    if (
      isNearColor(bg, [254, 253, 245], 12) ||
      isNearColor(bg, [242, 241, 227], 14) ||
      isNearColor(bg, [236, 234, 219], 16)
    ) {
      element.style.backgroundColor = PORTAL_WHITE;
      if (computed.borderStyle !== "none") {
        element.style.borderColor = "#e5e7eb";
      }
    }
  }

  // Re-tint green accents (e.g. waveform) to the portal blue while preserving red hangup controls.
  const vectorElements = Array.from(
    root.querySelectorAll<SVGElement>("svg path, svg circle, svg rect, svg line, svg polyline, svg polygon")
  );

  for (const vector of vectorElements) {
    const vectorStyle = window.getComputedStyle(vector);
    const fill = parseRgbColor(vectorStyle.fill);
    const stroke = parseRgbColor(vectorStyle.stroke);

    if (isGreenAccent(fill) && !isRedAccent(fill)) {
      vector.style.fill = PORTAL_PRIMARY;
    }
    if (isGreenAccent(stroke) && !isRedAccent(stroke)) {
      vector.style.stroke = PORTAL_PRIMARY;
    }
  }
}

function applyStartButtonBranding(widgetEl: HTMLElement): void {
  const button = findInternalStartButton(widgetEl);
  if (!button) return;

  // Style the functional widget button only. Do NOT replace or clear inner content —
  // the widget attaches click handlers to the button or its children; wiping content breaks the call.
  button.style.background = PORTAL_WHITE;
  button.style.color = PORTAL_PRIMARY;
  button.style.border = `2px solid ${PORTAL_PRIMARY}`;
  button.style.boxShadow = "0 4px 12px rgba(3, 182, 252, 0.18)";
  button.style.padding = "10px 18px";
  button.style.minHeight = "42px";
  button.style.minWidth = "160px";
  button.style.fontWeight = "600";
  button.style.fontSize = "14px";
  button.style.lineHeight = "1";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "flex-start";
  button.style.gap = "8px";
  button.style.whiteSpace = "nowrap";
  button.style.opacity = "1";

  // Inherit blue for text/icon only via color (no DOM changes — keeps widget click handler working)
  button.querySelectorAll("svg").forEach((el) => {
    const svg = el as SVGElement;
    svg.style.color = PORTAL_PRIMARY;
    svg.style.fill = PORTAL_PRIMARY;
  });
}

function isWidgetReady(widgetEl: HTMLElement): boolean {
  const root = widgetEl.shadowRoot;
  if (!root) return false;

  // Expanded state contains the composer input.
  return !!root.querySelector('input[placeholder="Type something here"]');
}

function observeWidgetReady(
  widgetEl: HTMLElement,
  onChange: (ready: boolean) => void
): () => void {
  const root = widgetEl.shadowRoot;
  if (!root) return () => {};

  let rafId: number | null = null;
  const sync = () => onChange(isWidgetReady(widgetEl));
  const scheduleSync = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      sync();
    });
  };

  sync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(root, { subtree: true, childList: true, attributes: true });

  return () => {
    observer.disconnect();
    if (rafId !== null) window.cancelAnimationFrame(rafId);
  };
}

function applyPrimaryActionButtonBranding(widgetEl: HTMLElement): void {
  const root = widgetEl.shadowRoot;
  if (!root) return;

  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  for (const button of buttons) {
    const computed = window.getComputedStyle(button);
    const bg = parseRgbColor(computed.backgroundColor);
    const text = (button.textContent || "").toLowerCase();
    const title = (button.getAttribute("title") || "").toLowerCase();
    const aria = (button.getAttribute("aria-label") || "").toLowerCase();
    const hasRedBg = isRedAccent(bg);
    const hasDangerClass =
      button.className.toLowerCase().includes("red") || text.includes("hang") || text.includes("end");

    // Keep the hangup/danger control red.
    if (hasRedBg || hasDangerClass) continue;

    // Keep close/collapse/meta controls neutral.
    if (
      title.includes("collapse") ||
      title.includes("close") ||
      title.includes("more") ||
      aria.includes("collapse") ||
      aria.includes("close")
    ) {
      continue;
    }

    // Make main action/mic/send buttons use portal blue.
    if (
      text.includes("start") ||
      text.includes("chat") ||
      title.includes("send") ||
      title.includes("mute") ||
      title.includes("unmute") ||
      button.querySelector("svg") ||
      button.querySelector("img") ||
      button.getAttribute("aria-label")
    ) {
      button.style.background = `linear-gradient(135deg, ${PORTAL_PRIMARY} 0%, ${PORTAL_PRIMARY_DARK} 100%)`;
      button.style.color = "#ffffff";
      button.style.border = "0";
      button.style.boxShadow = "0 8px 18px rgba(3, 182, 252, 0.24)";
      button.style.opacity = "1";
    }
  }
}

function brandWidget(widgetEl: HTMLElement): () => void {
  injectWidgetBrandStyles(widgetEl);
  retintWidgetPalette(widgetEl);
  applyStartButtonBranding(widgetEl);
  applyPrimaryActionButtonBranding(widgetEl);

  const root = widgetEl.shadowRoot;
  if (!root) return () => {};

  const observer = new MutationObserver(() => {
    injectWidgetBrandStyles(widgetEl);
    retintWidgetPalette(widgetEl);
    applyStartButtonBranding(widgetEl);
    applyPrimaryActionButtonBranding(widgetEl);
  });
  observer.observe(root, { subtree: true, childList: true });

  return () => observer.disconnect();
}

/**
 * Modal that renders the official Telnyx AI Agent widget (same experience as
 * the Telnyx Mission Control Widget tab and "Copy Demo Link" demo).
 * Full chat and voice functionality via the <telnyx-ai-agent> web component.
 */
export default function TelnyxWidgetModal({
  isOpen,
  onClose,
  assistantId,
}: TelnyxWidgetModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFallbackStart, setShowFallbackStart] = useState(false);

  const handleFallbackStartClick = () => {
    const widget = widgetRef.current;
    if (!widget) return;
    const tryClick = (attempt = 0) => {
      const btn = findInternalStartButton(widget);
      if (btn && !btn.disabled) {
        btn.click();
        setShowFallbackStart(false);
        return;
      }
      if (attempt < 5) window.setTimeout(() => tryClick(attempt + 1), 200);
    };
    tryClick();
  };

  useEffect(() => {
    if (!isOpen || !assistantId) return;
    let cleanupAutoStart: (() => void) | null = null;
    let cleanupBranding: (() => void) | null = null;
    let fallbackIntervalId: number | null = null;
    let fallbackTimeoutId: number | null = null;

    setError(null);
    setLoading(true);
    setShowFallbackStart(false);

    ensureTelnyxWidgetScript()
      .then(() => {
        // Allow custom element to register (widget script may define it async)
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

        // Remove any previous widget instance
        if (widgetRef.current && widgetRef.current.parentNode) {
          widgetRef.current.remove();
          widgetRef.current = null;
        }

        const el = document.createElement("telnyx-ai-agent");
        el.setAttribute("agent-id", assistantId);
        el.setAttribute("environment", "production");
        // Force embedded mode inside the modal (avoid floating launcher).
        el.setAttribute("position", "embedded");
        container.appendChild(el);
        widgetRef.current = el;
        cleanupBranding = brandWidget(el);
        cleanupAutoStart = autoStartWidget(el);

        // Show fallback "Start Call" when widget's internal button isn't visible yet (async DOM).
        const checkStartButton = () => {
          const btn = findInternalStartButton(el);
          if (btn) {
            setShowFallbackStart(false);
            return true;
          }
          setShowFallbackStart(true);
          return false;
        };
        checkStartButton();
        fallbackIntervalId = window.setInterval(checkStartButton, 400);
        fallbackTimeoutId = window.setTimeout(() => {
          if (fallbackIntervalId != null) window.clearInterval(fallbackIntervalId);
          fallbackIntervalId = null;
        }, 15000);
      })
      .catch((err) => {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to load widget.");
      });

    return () => {
      cleanupAutoStart?.();
      cleanupBranding?.();
      if (fallbackIntervalId != null) window.clearInterval(fallbackIntervalId);
      if (fallbackTimeoutId != null) window.clearTimeout(fallbackTimeoutId);
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
      className="relative m-5 sm:m-0 w-[min(100vw-2rem,520px)] min-w-[320px] min-h-[560px] rounded-3xl border border-[#b6e8ff] bg-white shadow-[0_20px_45px_rgba(3,182,252,0.2)] overflow-visible"
      isFullscreen={false}
    >
      <div className="flex flex-col h-full min-h-[520px]">
        <div className="flex-1 relative min-h-[480px] p-3">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading Telnyx widget…</p>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {error}
            </div>
          )}
          {showFallbackStart && !loading && !error && (
            <button
              type="button"
              onClick={handleFallbackStartClick}
              className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border-2 bg-white px-5 py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(3,182,252,0.18)]"
              style={{ borderColor: PORTAL_PRIMARY, color: PORTAL_PRIMARY }}
            >
              <img
                src={PORTAL_LOGO_PATH}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
              />
              Start Call
            </button>
          )}
          <div
            ref={containerRef}
            className="h-full w-full min-w-[280px] rounded-xl overflow-hidden [&_telnyx-ai-agent]:h-full [&_telnyx-ai-agent]:w-full [&_telnyx-ai-agent]:min-w-[280px] [&_telnyx-ai-agent]:min-h-[440px]"
            style={{ minHeight: 440 }}
          />
        </div>
      </div>
    </Modal>
  );
}
