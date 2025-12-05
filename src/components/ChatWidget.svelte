<script lang="ts">
  import { onMount } from 'svelte';

  type ChatRole = "user" | "assistant";

  interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: number;
  }

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
  let isSending = $state(false);
  let error = $state<string | null>(null);
  let bottomRef: HTMLDivElement;
  let textareaRef: HTMLTextAreaElement;

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
    return Array.from(array, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  // Initialize session and messages
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
      try {
        const parsed: ChatMessage[] = JSON.parse(savedMessages);
        messages = parsed;
      } catch (e) {
        console.warn("[DGENChat] Failed to parse stored messages", e);
      }
    }

    window.addEventListener("keydown", handleGlobalKeydown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  });

  // Persist messages to sessionStorage whenever they change
  $effect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) return;

    const mKey = messagesKeyFor(orgId, userId);
    window.sessionStorage.setItem(mKey, JSON.stringify(messages));
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

  function toggleOpen() {
    isOpen = !isOpen;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      isOpen = false;
    }
  }

  async function sendMessage() {
    // Cooldown
    const now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) {
      return;
    }
    lastSendTime = now;

    const text = input.trim();
    if (!text || !sessionId || isSending) return;

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

    try {
      const res = await fetch(`${apiBase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const data = await res.json();

      if (data.session_id) {
        const newSid = data.session_id;
        sessionId = newSid;
        if (typeof window !== "undefined") {
          const sKey = sessionKeyFor(orgId, userId);
          window.sessionStorage.setItem(sKey, newSid);
        }
      }

      const answer: string = data.answer ?? "";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        createdAt: Date.now(),
      };
      messages = [...messages, assistantMessage];
    } catch (err) {
      console.error(err);

      if (err instanceof TypeError) {
        error = "Network error - please check your connection and try again.";
      } else if (err instanceof Error && err.message.startsWith("HTTP_5")) {
        error =
          "Our server had a problem processing your request. Please try again in a moment.";
      } else if (err instanceof Error && err.message.startsWith("HTTP_4")) {
        error =
          "There was a problem with this request. Please double-check and try again.";
      } else {
        error = "Something unexpected went wrong. Please try again.";
      }
    } finally {
      isSending = false;
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
</script>

<!-- Floating button -->
<button
  class="floating-button"
  onclick={toggleOpen}
  aria-label={isOpen ? "Close DGEN chat" : "Open DGEN chat"}
  aria-haspopup="dialog"
  aria-expanded={isOpen}
  aria-controls="dgen-chat-widget"
>
  💬
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
        <div style="font-weight: 600;">DGEN Chat</div>
        <div style="font-size: 12px; opacity: 0.8;">Ask me anything</div>
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
        <div class="empty-state">
          👋 Hi! I'm your AI assistant.<br />
          Ask me a question to get started.
        </div>
      {/if}

      {#each messages as m (m.id)}
        <div
          class="message-row"
          style="justify-content: {m.role === 'user' ? 'flex-end' : 'flex-start'};"
        >
          <div class="bubble {m.role}">
            {m.content}
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
        placeholder="Type your message..."
        rows="1"
        class="textarea"
      ></textarea>
      <button
        onclick={sendMessage}
        disabled={isSending || !input.trim()}
        class="send-button"
        style="opacity: {isSending || !input.trim() ? 0.5 : 1};"
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
    --widget-floating-size: 52px;

    --widget-container-width: 320px;
    --widget-container-height: 500px;

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
    background: var(--widget-bg);
    color: var(--widget-text-color);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
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
    font-family: -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text",
      sans-serif;
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

  .messages-container {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  @media (max-width: 480px) {
    .widget-container {
      right: 12px;
      left: 12px;
      width: auto;
      max-width: 100%;
      height: 60vh;
    }

    .floating-button {
      bottom: 16px;
      right: 16px;
    }
  }
</style>
