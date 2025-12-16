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
    orgId: string;
    userId?: string;
  }

  let { apiBase, orgId, userId }: Props = $props();

  // Config
  const MAX_MESSAGE_LENGTH = 1000;
  const SEND_COOLDOWN_MS = 300;
  let lastSendTime = 0;

  // State
  let isOpen = $state(false);
  let sessionId = $state("");
  let messages = $state<ChatMessage[]>([]);
  let input = $state("");
  let isReady = $state(false);
  let isSending = $state(false);
  let error = $state<string | null>(null);
  let showPrompt = $state(true);

  // Refs
  let bottomRef: HTMLDivElement;
  let textareaRef: HTMLTextAreaElement;
  let abortController: AbortController | null = null;

  // Helpers for storage keys
  const buildKey = (suffix: string, orgId: string, userId?: string) =>
    `dgen_${suffix}_${orgId}_${userId ?? "anon"}`;

  const sessionKeyFor = (orgId: string, userId?: string) =>
    buildKey("session", orgId, userId);

  const messagesKeyFor = (orgId: string, userId?: string) =>
    buildKey("messages", orgId, userId);

  function generateSessionId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  // UI helpers
  function toggleOpen() {
    isOpen = !isOpen;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      isOpen = false;
    }
  }

  async function sendMessage() {
    if (!isReady) return;

    // Enforce a cooldown period to prevent message spamming
    const now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) {
      return;
    }
    lastSendTime = now;

    const text = input.trim();
    if (!text || !sessionId || isSending) return;
    // Enforce length guard even if UI is bypassed
    if (text.length > MAX_MESSAGE_LENGTH) {
      error = `Messages are limited to ${MAX_MESSAGE_LENGTH} characters. Please shorten your message.`;
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

    messages = [...messages, userMessage];
    input = "";
    abortController = new AbortController();

    try {
      const res = await fetch(`${apiBase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          org_id: orgId,
          user_id: userId || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP_${res.status}: ${body}`);
      }

      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error("INVALID_JSON");
      }

      if (data.session_id) {
        const newSid = data.session_id;
        sessionId = newSid;
        if (typeof window !== "undefined") {
          const sKey = sessionKeyFor(orgId, userId);
          window.sessionStorage.setItem(sKey, newSid);
        }
      }

      const answer: string = (data.answer ?? "").trim();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        createdAt: Date.now(),
        html: await renderSafeMarkdown(answer),
      };
      messages = [...messages, assistantMessage];
    } catch (err) {
      console.error(err);

      if (err instanceof Error && err.name === "AbortError") {
        console.log("[DGENChat] Request aborted");
        return;
      }

      // TODO: To finalize the fallback response
      let message = "Something unexpected went wrong. Please try again later.";

      // Invalid JSON from res.json()
      if (err instanceof Error && err.message === "INVALID_JSON") {
        message =
          "Unexpected response from the server. Please try again later.";
      }
      // Network-level failure (no response)
      else if (err instanceof TypeError) {
        message = "Network error - please check your connection and try again.";
      }
      // 5xx server errors
      else if (err instanceof Error && err.message.startsWith("HTTP_5")) {
        message =
          "Our server had a problem processing your request. Please try again in a moment.";
      }
      // 4xx client errors
      else if (err instanceof Error && err.message.startsWith("HTTP_4")) {
        message =
          "There was a problem with this request. Please double-check and try again.";
      }

      error = message;
    } finally {
      isSending = false;
      abortController = null;
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

    const sKey = sessionKeyFor(orgId, userId);
    const mKey = messagesKeyFor(orgId, userId);

    let sid = window.sessionStorage.getItem(sKey);
    if (!sid) {
      sid = generateSessionId();
      window.sessionStorage.setItem(sKey, sid);
    }
    sessionId = sid;

    const savedMessages = window.sessionStorage.getItem(mKey);
    if (savedMessages) {
      (async () => {
        try {
          const parsed = JSON.parse(savedMessages) as Array<
            ChatMessage & { html?: string }
          >;
          // Regenerate sanitized HTML for assistant messages to avoid storing unsafe markup
          const sanitized = await Promise.all(
            parsed.map(async (m) => {
              if (m.role === "assistant") {
                try {
                  return {
                    ...m,
                    html: await renderSafeMarkdown(m.content),
                  };
                } catch {
                  return { ...m, html: undefined };
                }
              }
              return { ...m, html: undefined };
            }),
          );
          messages = sanitized;
        } catch (e) {
          console.warn("[DGENChat] Failed to parse stored messages", e);
          // Clear corrupted state so future writes succeed and surface the issue to the user
          window.sessionStorage.removeItem(mKey);
          error =
            "We had to reset your chat history because it became unreadable. You can continue chatting normally.";
        }
      })();
    }

    const intro =
      "Hello! I'm DGEN AI Assistant, your guide to this DGEN app. How can I help you today?";
    if (!savedMessages) {
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
    }

    isReady = true;
    const promptTimer = window.setTimeout(() => {
      showPrompt = false;
    }, 5000);
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

  // Persist messages to sessionStorage whenever they change
  $effect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) return;
    const mKey = messagesKeyFor(orgId, userId);
    // Store only safe fields
    const safeMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
    window.sessionStorage.setItem(mKey, JSON.stringify(safeMessages));
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
</script>

<!-- Floating button -->
{#if showPrompt}
  <div class="prompt-bubble" role="status" aria-live="polite">
    Ask my anything
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
      <div>
        <div style="font-weight: 600;">DGEN Chat Bot</div>
        <a
          href="/disclaimer"
          target="_blank"
          rel="noopener noreferrer"
          class="disclaimer-link"
        >
          Disclaimer: Read First Before Using This AI Chatbot
        </a>
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
        disabled={!isReady}
      ></textarea>
      <button
        onclick={sendMessage}
        disabled={!isReady || isSending || !input.trim()}
        class="send-button"
        style="opacity: {!isReady || isSending || !input.trim() ? 0.5 : 1};"
      >
        ➤
      </button>
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
    font-size: 12px;
    color: #9ca3af;
    text-decoration: underline;
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
</style>
