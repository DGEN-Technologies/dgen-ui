/**
 * DOM Security Monitor
 * Detects suspicious patterns that could indicate malicious JavaScript
 * Similar patterns were used in the MyAlgo wallet exploit
 */

import { lockWallet } from "$lib/walletService";

interface SecurityEvent {
  type: string;
  timestamp: number;
  details?: string;
}

class DOMSecurityMonitor {
  private static instance: DOMSecurityMonitor;
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 100;
  private readonly SUSPICIOUS_THRESHOLD = 10; // suspicious events in short time
  private readonly TIME_WINDOW = 5000; // 5 seconds
  private observer: MutationObserver | null = null;
  private isMonitoring = false;

  private constructor() {}

  static getInstance(): DOMSecurityMonitor {
    if (!DOMSecurityMonitor.instance) {
      DOMSecurityMonitor.instance = new DOMSecurityMonitor();
    }
    return DOMSecurityMonitor.instance;
  }

  /**
   * Start monitoring for suspicious activity
   */
  startMonitoring(): void {
    if (this.isMonitoring || typeof window === "undefined") return;
    this.isMonitoring = true;

    // Monitor DOM mutations for suspicious patterns
    this.observer = new MutationObserver((mutations) => {
      this.checkMutations(mutations);
    });

    // Monitor the body for any changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // Monitor storage access patterns
    this.monitorStorageAccess();

    // Monitor clipboard access
    this.monitorClipboardAccess();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Check mutations for suspicious patterns
   */
  private checkMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      // DISABLED — script/iframe injection detection. TO BE REPLACED, NOT
      // FORGOTTEN: see the note on `suspiciousTypes` below for what a correct
      // version has to do.
      //
      // It counted every <script> or <iframe> added to the DOM as an attack.
      // This app is a code-splitting SvelteKit SPA: each route navigation and
      // each lazy import() injects a <script>, as do the chat widget, the
      // SwapSpace iframe, and any browser extension the user has installed.
      // Ten within five seconds is ordinary hydration, and ten was the
      // threshold — so it fired `lockWallet()` and a blocking alert() during
      // normal use. Confirmed firing on the public landing page, where no
      // wallet exists at all.
      //
      // The defence it was reaching for is already in place and is the one
      // that actually works: CSP `script-src 'self' wasm-unsafe-eval` refuses
      // injected third-party scripts outright. Node type cannot distinguish
      // an app chunk from an attack.

      // Check for style changes that might be used to hide malicious activity
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "style"
      ) {
        const element = mutation.target as HTMLElement;
        if (
          element.style.visibility === "hidden" ||
          element.style.display === "none"
        ) {
          // Only suspicious if it contains sensitive data
          if (
            element.textContent?.includes(" ") &&
            element.textContent.split(" ").length === 12
          ) {
            this.recordEvent("seed_hiding", "Element with seed phrase hidden");
          }
        }
      }
    }
  }

  /**
   * Monitor storage access patterns
   */
  private monitorStorageAccess(): void {
    // Wrap sessionStorage.getItem to detect rapid access
    const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
    const self = this;

    sessionStorage.getItem = function (key: string): string | null {
      if (key.includes("wallet") || key.includes("mnemonic")) {
        self.recordEvent("storage_access", `Accessing: ${key}`);
      }
      return originalGetItem(key);
    };
  }

  /**
   * Monitor clipboard access
   */
  private monitorClipboardAccess(): void {
    let clipboardAccessCount = 0;
    const resetInterval = 1000;

    document.addEventListener("copy", () => {
      clipboardAccessCount++;
      this.recordEvent("clipboard_copy", "Copy event detected");

      setTimeout(() => {
        clipboardAccessCount = 0;
      }, resetInterval);

      // Suspicious if many copies in short time
      if (clipboardAccessCount > 3) {
        this.recordEvent(
          "rapid_clipboard_access",
          "Multiple rapid copy events",
        );
      }
    });
  }

  /**
   * Record a security event
   */
  private recordEvent(type: string, details?: string): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      details,
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Check if we've exceeded threshold
    this.checkThreshold();

    // Log for debugging (in production, send to monitoring service)
    if (import.meta.env.DEV) {
      console.warn("[Security Monitor]", type, details);
    }
  }

  /**
   * Check if suspicious threshold exceeded
   */
  private checkThreshold(): void {
    const now = Date.now();
    const recentEvents = this.events.filter(
      (e) => now - e.timestamp < this.TIME_WINDOW,
    );

    // Count suspicious event types.
    //
    // "suspicious_injection" is deliberately absent — nothing records it any
    // more (see checkMutations). When injection detection is reinstated it
    // needs three things this version lacked: a signal that separates the
    // app's own chunks from injected ones (same-origin src, or a nonce match
    // against the CSP nonce) rather than node type; a threshold measured
    // against real hydration traffic rather than a guessed 10-in-5s; and a
    // response short of a blocking alert(), which freezes the page on a
    // false positive and is itself the worst part of the old behaviour.
    const suspiciousTypes = ["seed_hiding", "rapid_clipboard_access"];

    const suspiciousCount = recentEvents.filter((e) =>
      suspiciousTypes.includes(e.type),
    ).length;

    if (suspiciousCount >= this.SUSPICIOUS_THRESHOLD) {
      this.handleSuspiciousActivity();
    }
  }

  /**
   * Handle detected suspicious activity
   */
  private async handleSuspiciousActivity(): Promise<void> {
    console.error(
      "[Security Monitor] SUSPICIOUS ACTIVITY DETECTED - Locking wallet",
    );

    // Clear events to prevent multiple triggers
    this.events = [];

    // Lock wallet immediately
    try {
      await lockWallet();
    } catch (error) {
      console.error("[Security Monitor] Failed to lock wallet:", error);
    }

    // Alert user
    if (typeof window !== "undefined") {
      alert(
        "Suspicious activity detected. Your wallet has been locked for security. " +
          "Please verify your browser has not been compromised.",
      );
    }
  }

  /**
   * Get recent events (for debugging/monitoring)
   */
  getRecentEvents(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }
}

export const domSecurityMonitor = DOMSecurityMonitor.getInstance();
