<script lang="ts">
  import { onMount } from "svelte";
  import { renderSafeMarkdown } from "$lib/safeMarkdown";

  // Types
  type ChatRole = "user" | "assistant";

  interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: number;
    html?: string;
  }

  // Props
  interface Props {
    apiBase: string;
    userId?: string;
  }

  let { apiBase, userId }: Props = $props();

  // Config
  const MAX_MESSAGE_LENGTH = 1000;
  const SEND_COOLDOWN_MS = 300;
  const REQUEST_TIMEOUT_MS = 15000;
  const MAX_MESSAGES_STORED = 200;
  let lastSendTime = 0;

  // State
  let isOpen = $state(false);
  let sessionToken = $state("");
  let sessionUserId = $state<string | undefined>(userId);
  let messages = $state<ChatMessage[]>([]);
  let input = $state("");
  let isReady = $state(false);
  let isSending = $state(false);
  let error = $state<string | null>(null);
  let showPrompt = $state(true);
  let showDisclaimer = $state(false);
  let disclaimerAgreed = $state(false);

  // Refs
  let bottomRef: HTMLDivElement;
  let textareaRef: HTMLTextAreaElement;
  let disclaimerWindowRef: HTMLDivElement;
  let disclaimerCloseRef: HTMLButtonElement;
  let abortController: AbortController | null = null;

  // Helpers for storage keys
  const buildKey = (suffix: string, userId?: string) =>
    `dgen_${suffix}_${userId ?? "anon"}`;
  const messagesKeyFor = (userId?: string) => buildKey("messages", userId);
  const userKeyFor = (userId?: string) => buildKey("user", userId);
  const tokenKeyFor = (userId?: string) => buildKey("token", userId);

  // UI helpers
  function toggleOpen() {
    isOpen = !isOpen;
    if (isOpen && !disclaimerAgreed) {
      showDisclaimer = true;
    } else if (!isOpen) {
      showDisclaimer = false;
    }
  }

  function appendMessage(message: ChatMessage) {
    messages = [...messages, message].slice(-MAX_MESSAGES_STORED);
  }

  function closeDisclaimer() {
    if (!disclaimerAgreed) {
      error = "Please confirm the disclaimer before using the chat.";
      return;
    }
    error = null;
    showDisclaimer = false;
  }

  function declineDisclaimer() {
    disclaimerAgreed = false;
    showDisclaimer = false;
    isOpen = false;
    error = null;
  }

  function trapDisclaimerFocus(event: KeyboardEvent) {
    if (event.key !== "Tab" || !disclaimerWindowRef) return;

    const focusables = disclaimerWindowRef.querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >(
      "button, input, [href], select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        (last as HTMLElement).focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      (first as HTMLElement).focus();
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (showDisclaimer) {
      declineDisclaimer();
      return;
    }
    if (isOpen) {
      isOpen = false;
    }
  }

  async function sendMessage() {
    if (!isReady) return;
    if (!disclaimerAgreed) {
      error = "Please agree to the disclaimer before using the chat.";
      showDisclaimer = true;
      return;
    }

    // Enforce a cooldown period to prevent message spamming
    const now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) {
      return;
    }
    lastSendTime = now;

    const text = input.trim();
    if (!text || isSending) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      error = `Messages are limited to ${MAX_MESSAGE_LENGTH} characters. Please shorten your message.`;
      return;
    }

    // Require https (allow localhost for dev)
    try {
      const target = new URL(apiBase);
      if (target.protocol !== "https:" && target.hostname !== "localhost") {
        throw new Error("INSECURE_PROTOCOL");
      }
    } catch {
      error = "Chat is not configured correctly. Please try again later.";
      return;
    }

    error = null;
    isSending = true;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    appendMessage(userMessage);
    input = "";
    abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController?.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (sessionToken) {
        headers["X-Session-Token"] = sessionToken;
      }

      const res = await fetch(`${apiBase}`, {
        method: "POST",
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          message: text,
        }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          sessionToken = "";
          sessionUserId = undefined;
          throw new Error("AUTH_EXPIRED");
        }
        throw new Error(`HTTP_${res.status}`);
      }

      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error("INVALID_JSON");
      }

      if (data.user_id) {
        sessionUserId = data.user_id;
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            userKeyFor(sessionUserId),
            sessionUserId,
          );
        }
      }
      if (data.session_token) {
        sessionToken = data.session_token;
        if (typeof window !== "undefined") {
          const tokenKey = tokenKeyFor(sessionUserId);
          window.sessionStorage.setItem(tokenKey, data.session_token);
        }
      }

      const answer: string =
        data.answer ??
        "I did not receive a response. Please try again in a moment.";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        createdAt: Date.now(),
        html: await renderSafeMarkdown(answer),
      };
      appendMessage(assistantMessage);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      let message = "Something unexpected went wrong. Please try again later.";

      if (err instanceof Error && err.message === "INVALID_JSON") {
        message =
          "Unexpected response from the server. Please try again later.";
      } else if (err instanceof Error && err.message === "INSECURE_PROTOCOL") {
        message = "Secure connection required. Please use HTTPS to continue.";
      } else if (err instanceof Error && err.message === "AUTH_EXPIRED") {
        if (typeof window !== "undefined") {
          const storage = window.sessionStorage;
          storage.removeItem(userKeyFor(sessionUserId));
          storage.removeItem(tokenKeyFor(sessionUserId));
        }
        sessionToken = "";
        sessionUserId = undefined;
        message = "Session expired. Please send your message again.";
      } else if (err instanceof TypeError) {
        message = "Network error - please check your connection and try again.";
      } else if (err instanceof Error && err.message.startsWith("HTTP_5")) {
        message =
          "Our server had a problem processing your request. Please try again in a moment.";
      } else if (err instanceof Error && err.message.startsWith("HTTP_4")) {
        message =
          "There was a problem with this request. Please double-check and try again.";
      }

      error = message;
    } finally {
      isSending = false;
      abortController = null;
      window.clearTimeout(timeoutId);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) sendMessage();
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    let value = target.value;

    if (value.length > MAX_MESSAGE_LENGTH) {
      value = value.slice(0, MAX_MESSAGE_LENGTH);
    }

    input = value;
    target.value = value;

    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  }

  // Lifecycle - Initialize session and messages
  onMount(() => {
    if (typeof window === "undefined") return;

    const storage = window.sessionStorage;

    const storedUserId =
      storage.getItem(userKeyFor(sessionUserId)) ?? storage.getItem(userKeyFor());
    if (storedUserId) {
      sessionUserId = storedUserId;
    } else if (sessionUserId) {
      storage.setItem(userKeyFor(sessionUserId), sessionUserId);
    }

    const storedToken =
      storage.getItem(tokenKeyFor(sessionUserId)) ?? storage.getItem(tokenKeyFor());
    if (storedToken) {
      sessionToken = storedToken;
    }

    const mKey = messagesKeyFor(sessionUserId);
    storage.removeItem(mKey);

    const intro =
      "Hello! I'm DGEN AI Assistant, your guide to this DGEN app. How can I help you today?";

    (async () => {
      messages = [
        {
          id: "assistant-intro",
          role: "assistant",
          content: intro,
          createdAt: Date.now(),
          html: await renderSafeMarkdown(intro),
        },
      ];
    })();

    isReady = true;
    const promptTimer = window.setTimeout(() => {
      showPrompt = false;
    }, 3000);
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);

      // Abort any in-flight requests on unmount
      if (abortController) {
        abortController.abort();
      }
      window.clearTimeout(promptTimer);
    };
  });

  // Auto-scroll to bottom
  $effect(() => {
    if (messages.length > 0 || isOpen) {
      bottomRef?.scrollIntoView({ behavior: "smooth" });
    }
  });

  // Focus Handling
  $effect(() => {
    if (isOpen && textareaRef) {
      textareaRef.focus();
    }
  });

  $effect(() => {
    if (showDisclaimer) {
      if (disclaimerAgreed) {
        disclaimerCloseRef?.focus();
      } else {
        disclaimerWindowRef?.focus();
      }
    }
  });
</script>

<!-- Floating button -->
{#if showPrompt}
  <div class="prompt-bubble" role="status" aria-live="polite">
    Ask me anything
  </div>
{/if}
<button
  class="floating-button"
  onclick={() => {
    toggleOpen();
    showPrompt = false;
  }}
  aria-label={isOpen ? "Close DGEN chat" : "Open DGEN chat"}
  aria-haspopup="dialog"
  aria-expanded={isOpen}
  aria-controls="dgen-chat-widget"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    width="48"
    height="48"
    aria-hidden="true"
    focusable="false"
  >
    <!-- White circular button -->
    <circle cx="32" cy="32" r="32" fill="#FFFFFF" />

    <!-- Blue chat bubble -->
    <rect x="16" y="16" width="32" height="32" rx="4" ry="4" fill="#1E6AE1" />
    <path d="M32 48 L44 56 L44 48 Z" fill="#1E6AE1" />
    <path
      d="M22 36 C28 44 36 44 42 36"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>

<!-- Chat window -->
{#if isOpen}
  <div
    class="widget-container"
    id="dgen-chat-widget"
    role="dialog"
    aria-modal="true"
    aria-label="DGEN support chat"
  >
    <!-- Header -->
    <div class="header">
      <div class="header-text">
        <div style="font-weight: 600;">DGEN Chatbot</div>
        <button
          type="button"
          class="disclaimer-link"
          onclick={() => {
            showDisclaimer = true;
            disclaimerAgreed = false;
          }}
        >
          Disclaimer: Read First Before Using This DGEN Chatbot
        </button>
      </div>
      <div>
        <button
          onclick={toggleOpen}
          class="close-button"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div class="messages-container">
      {#if messages.length === 0}
        <div class="empty-state" class:ready={isReady}>
          👋 Hi! I'm your AI assistant.<br />
          Ask me a question to get started.
        </div>
      {/if}

      {#each messages as m (m.id)}
        <div
          class="message-row"
          style="justify-content: {m.role === 'user'
            ? 'flex-end'
            : 'flex-start'};"
        >
          <div class="bubble {m.role}">
            {#if m.role === "assistant" && m.html}
              {@html m.html}
            {:else}
              {m.content} <!-- user -->
            {/if}
          </div>
        </div>
      {/each}

      {#if isSending}
        <div class="message-row" style="justify-content: flex-start;">
          <div class="bubble assistant">
            <span style="opacity: 0.7;">Thinking…</span>
          </div>
        </div>
      {/if}

      <div bind:this={bottomRef}></div>
    </div>

    <!-- Error -->
    {#if error}
      <div class="error">{error}</div>
    {/if}

    <!-- Input -->
    <div class="input-container">
      <textarea
        bind:this={textareaRef}
        bind:value={input}
        onkeydown={handleKeyDown}
        oninput={handleInput}
        placeholder={isReady ? "Type your message..." : "Initializing..."}
        rows="1"
        class="textarea"
        disabled={!isReady || !disclaimerAgreed}
      ></textarea>
      <button
        onclick={sendMessage}
        disabled={!isReady || isSending || !input.trim() || !disclaimerAgreed}
        class="send-button"
        style="opacity: {!isReady ||
        isSending ||
        !input.trim() ||
        !disclaimerAgreed
          ? 0.5
          : 1};"
      >
        ➤
      </button>
    </div>
  </div>
{/if}

{#if showDisclaimer}
  <div
    class="disclaimer-overlay"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={trapDisclaimerFocus}
  >
    <div
      class="disclaimer-window"
      bind:this={disclaimerWindowRef}
      tabindex="-1"
    >
      <div class="disclaimer-header">
        <div>
          <p class="disclaimer-eyebrow">DGEN A.I. Chatbot Disclaimer</p>
          <h2>Read Before You Use The DGEN Chatbot</h2>
        </div>
      </div>
      <div class="disclaimer-body">
        <p class="important">
          <strong>IMPORTANT DISCLAIMER:</strong> This is not financial, investment,
          or legal advice.
        </p>
        <p>
          You are interacting with an artificial intelligence (the "Chatbot").
          The Chatbot is currently in BETA stage and may generate inaccurate,
          incomplete, outdated, or fabricated information (hallucinations). You
          must independently verify and fact-check every statement, figure, or
          claim made by the Chatbot before relying on it. DGEN cannot and does
          not take responsibility for any misinformation, errors, or omissions
          produced by the A.I.
        </p>
        <p>
          The information provided is for informational and entertainment
          purposes only. DGEN, its affiliates, officers, directors, employees,
          agents, and representatives make no representations or warranties
          regarding accuracy, completeness, or reliability.
        </p>
        <p>
          <strong>No Financial Advice:</strong> Nothing here constitutes financial,
          investment, tax, accounting, legal, or professional advice. Do not use
          the Chatbot for financial decisions.
        </p>
        <p>
          <strong>No Liability:</strong> DGEN shall not be liable for any losses
          or damages arising from your use of or reliance on the Chatbot, including
          misinformation.
        </p>
        <p>
          <strong>Consult Professionals:</strong> Always consult qualified, licensed
          advisors in your jurisdiction for important matters.
        </p>
        <p class="acknowledge">
          By continuing, you acknowledge and agree to this disclaimer. If you do
          not agree, stop using the Chatbot immediately.
        </p>
      </div>
      <div class="disclaimer-actions">
        <button
          type="button"
          class="decline-button"
          onclick={declineDisclaimer}
        >
          I don’t agree, close chat
        </button>
        <label class="disclaimer-agree">
          <input
            type="checkbox"
            bind:checked={disclaimerAgreed}
            aria-label="I agree to the disclaimer"
          />
          <span>I agree</span>
        </label>
        <button
          type="button"
          class="back-button"
          onclick={closeDisclaimer}
          disabled={!disclaimerAgreed}
        >
          Return to chat
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :root {
    --widget-floating-bottom: 60px;
    --widget-floating-right: 27px;
    --widget-floating-size: 78px;

    --widget-container-width: 320px;
    --widget-container-height: 500px;
    --widget-container-mobile-gap: 24px;
    --widget-container-mobile-height: 65vh;

    --widget-bg: #111827;
    --widget-bg-assistant: #1f2937;
    --widget-bg-input: #030712;
    --widget-bg-user: #2563eb;

    --widget-text-color: #f9fafb;
  }

  .floating-button {
    position: fixed;
    bottom: var(--widget-floating-bottom);
    right: var(--widget-floating-right);
    width: var(--widget-floating-size);
    height: var(--widget-floating-size);
    border-radius: 999px;
    border: none;
    background: transparent;
    padding: 0;
    box-shadow: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .prompt-bubble {
    position: fixed;
    bottom: calc(
      var(--widget-floating-bottom) + (var(--widget-floating-size) * 0.4)
    );
    right: calc(
      var(--widget-floating-right) + var(--widget-floating-size) + 6px
    );
    background: #ffffff;
    color: #111827;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    font-family: inherit;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
    z-index: 999999;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .prompt-bubble::after {
    content: "";
    position: absolute;
    right: -6px;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #ffffff;
    transform: translateY(-50%) rotate(45deg);
    border-radius: 2px;
  }

  @media (max-width: 600px) {
    .prompt-bubble {
      right: calc(16px + var(--widget-floating-size) + 8px);
      bottom: calc(16px + (var(--widget-floating-size) / 2) - 12px);
      max-width: 70vw;
      white-space: normal;
    }

    .prompt-bubble::after {
      right: -6px;
    }
  }

  .widget-container {
    position: fixed;
    bottom: calc(
      var(--widget-floating-bottom) + var(--widget-floating-size) + 10px
    );
    right: var(--widget-floating-right);
    width: var(--widget-container-width);
    height: var(--widget-container-height);
    background: var(--widget-bg);
    color: var(--widget-text-color);
    border-radius: 16px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 999998;
    transition: all 0.25s ease;
    font-family:
      -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text", sans-serif;
  }

  .header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(249, 250, 251, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .close-button {
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    font-size: 16px;
  }

  .disclaimer-link {
    display: inline-block;
    margin-top: 4px;
    font-size: 13px;
    color: #facc15;
    text-decoration: underline;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .messages-container {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .message-row {
    display: flex;
  }

  .bubble {
    border-radius: 14px;
    padding: 8px 12px;
    font-size: 14px;
    line-height: 1.4;
    max-width: 80%;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .bubble.user {
    background: var(--widget-bg-user);
    color: var(--widget-text-color);
  }

  .bubble.assistant {
    background: var(--widget-bg-assistant);
    color: #e5e7eb;
  }

  .empty-state {
    font-size: 14px;
    opacity: 0.8;
    text-align: center;
    margin-top: 24px;
  }

  .error {
    padding: 4px 12px;
    color: #fecaca;
    background: rgba(220, 38, 38, 0.2);
    font-size: 12px;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid rgba(249, 250, 251, 0.08);
  }

  .textarea {
    flex: 1;
    border-radius: 12px;
    padding: 8px 12px;
    border: none;
    outline: none;
    font-size: 14px;
    background: var(--widget-bg-input);
    color: var(--widget-text-color);
    resize: none;
    overflow: hidden;
    line-height: 1.4;
    font-family: inherit;
    max-height: 100px;
    overflow-y: auto;
  }

  .send-button {
    border-radius: 999px;
    border: none;
    padding: 8px 12px;
    font-size: 14px;
    background: var(--widget-bg-user);
    color: var(--widget-text-color);
    cursor: pointer;
  }

  .send-button:disabled {
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    .widget-container {
      left: var(--widget-container-mobile-gap);
      right: var(--widget-container-mobile-gap);
      width: calc(100% - (var(--widget-container-mobile-gap) * 2));
      max-width: 100%;
      height: var(--widget-container-mobile-height);
      bottom: calc(16px + var(--widget-floating-size) + 8px);
    }

    .floating-button {
      bottom: 16px;
      right: 16px;
    }
  }

  .empty-state {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .empty-state.ready {
    opacity: 0.8;
    transform: translateY(0);
  }

  .textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .disclaimer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000000;
    padding: 20px;
  }

  .disclaimer-window {
    background: linear-gradient(145deg, #1a1f2d, #0f131d);
    border: 1px solid rgba(140, 169, 255, 0.3);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    max-width: 620px;
    width: min(92vw, 640px);
    max-height: 80vh;
    padding: 20px;
    color: #f9fafb;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .disclaimer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .disclaimer-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    color: #8ca9ff;
    margin: 0 0 4px;
  }

  .disclaimer-window h2 {
    margin: 0;
    font-size: clamp(22px, 3vw, 28px);
    color: #e5e7eb;
  }

  .disclaimer-close {
    border: none;
    background: transparent;
    color: #d1d5db;
    font-size: 18px;
    cursor: pointer;
  }

  .disclaimer-body {
    overflow-y: auto;
    padding-right: 6px;
    line-height: 1.55;
    color: #d1d5db;
  }

  .disclaimer-body p {
    margin: 10px 0;
  }

  .disclaimer-body .important {
    color: #fef3c7;
    background: rgba(255, 255, 255, 0.04);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .disclaimer-body strong {
    color: #fef08a;
  }

  .disclaimer-body .acknowledge {
    font-weight: 600;
    color: #f9fafb;
  }

  .disclaimer-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }

  .disclaimer-actions .back-button {
    margin-top: 0;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(140, 169, 255, 0.4);
    background: linear-gradient(135deg, #1e6ae1, #3b82f6);
    color: #f9fafb;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.1s ease,
      box-shadow 0.2s ease,
      opacity 0.2s ease;
  }

  .disclaimer-actions .back-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  }

  .disclaimer-actions .back-button:active {
    transform: translateY(0);
    opacity: 0.9;
  }

  .disclaimer-actions .back-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .disclaimer-agree {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #e5e7eb;
    cursor: pointer;
  }

  .disclaimer-agree input {
    width: 18px;
    height: 18px;
    accent-color: #1e6ae1;
    cursor: pointer;
  }

  .decline-button {
    margin-right: auto;
    background: transparent;
    color: #d1d5db;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    transition:
      opacity 0.15s ease,
      border-color 0.15s ease;
  }

  .decline-button:hover {
    opacity: 0.85;
    border-color: rgba(255, 255, 255, 0.3);
  }
</style>
