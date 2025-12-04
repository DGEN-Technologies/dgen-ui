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

  // State
  let isOpen = $state(false);
  let sessionId = $state("");
  let messages = $state<ChatMessage[]>([]);
  let input = $state("");
  let isSending = $state(false);
  let error = $state<string | null>(null);
  let bottomRef: HTMLDivElement;
  let textareaRef: HTMLTextAreaElement;

  // Helpers
  const buildKey = (suffix: string, orgId: string, userId?: string) =>
    `dgen_${suffix}_${orgId}_${userId ?? "anon"}`;

  const sessionKeyFor = (orgId: string, userId?: string) =>
    buildKey("session", orgId, userId);

  const messagesKeyFor = (orgId: string, userId?: string) =>
    buildKey("messages", orgId, userId);

  function generateSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
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

  function toggleOpen() {
    isOpen = !isOpen;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId) return;

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
          metadata: {
            url: window.location.href,
            user_agent: navigator.userAgent,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
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

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        createdAt: Date.now(),
      };
      messages = [...messages, assistantMessage];
    } catch (err) {
      console.error(err);
      error = "Something went wrong. Please try again.";
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
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  }
</script>

<!-- Floating button -->
<button
  onclick={toggleOpen}
  class="floating-button"
  aria-label="Open chat"
>
  💬
</button>

<!-- Chat window -->
{#if isOpen}
  <div class="widget-container">
    <div class="header">
      <div>
        <div style="font-weight: 600;">DGEN Chat</div>
        <div style="font-size: 12px; opacity: 0.8;">Ask me anything</div>
      </div>
      <div>
        <button onclick={toggleOpen} class="close-button">✕</button>
      </div>
    </div>

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

    {#if error}
      <div class="error">{error}</div>
    {/if}

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
  .floating-button {
    position: fixed;
    bottom: 60px;
    right: 27px;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    border: none;
    background: #111827;
    color: #f9fafb;
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
    bottom: 90px;
    right: 24px;
    width: 320px;
    height: 500px;
    background: #111827;
    color: #f9fafb;
    border-radius: 16px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 999998;
    transition: all 0.25s ease;
    font-family: -apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text", sans-serif;
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
    background: #2563eb;
    color: #f9fafb;
  }

  .bubble.assistant {
    background: #1f2937;
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
    background: #030712;
    color: #f9fafb;
    resize: none;
    overflow: hidden;
    line-height: 1.4;
    font-family: inherit;
  }

  .send-button {
    border-radius: 999px;
    border: none;
    padding: 8px 12px;
    font-size: 14px;
    background: #2563eb;
    color: #f9fafb;
    cursor: pointer;
  }

  .send-button:disabled {
    cursor: not-allowed;
  }
</style>
