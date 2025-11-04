import { goto, invalidate } from "$app/navigation";
import { navigating, page } from "$app/stores";
import { PUBLIC_SOCKET } from "$env/static/public";
import { event, invoice, last, request } from "$lib/store";
import { s, sleep, success, wait } from "$lib/utils";
import { runtimeConfig, loadRuntimeConfig } from "$lib/config";
import cookies from "js-cookie";
import { get } from "svelte/store";

export let socket;
let token;

export const auth = () => token && send("login", token);

export const send = async (type, data) => {
  try {
    await wait(() => socket?.readyState === 1, 1000, 10);
  } catch (e) {
    const { message } = e as Error;
    if (message === "timeout") reconnectToWebsocket();
  }

  await wait(() => socket?.readyState === 1, 1000, 10);
  socket.send(JSON.stringify({ type, data }));
};

export const messages = (data) => ({
  id() {
    last.set(Date.now());
  },
  invoice() {
    invoice.set(data);
  },
  event() {
    event.set(data);
  },

  request() {
    request.set(data);
    invalidate("app:invoice");
  },

  async payment() {
    const { amount, confirmed, iid } = data;
    invalidate("app:user");
    invalidate("app:invoice");
    invalidate("app:payments");

    const {
      url: { pathname },
    } = get(page);

    const username = cookies.get("username");

    if (amount > 0) {
      if (
        iid && // Only redirect if we have a valid invoice ID
        (pathname.includes(`/${username}`) ||
        pathname.includes("/receive") ||
        pathname.includes("/invoice"))
      ) {
        await wait(() => !get(navigating));
        await goto(`/invoice/${iid}`);
      } else success(`${confirmed ? "Received" : "Detected"} ⚡️${s(amount)}!`);
    }
  },

  // New real-time payment event handlers
  async paymentReceived() {
    const { payment, invoice: invoiceData } = data;

    // Invalidate all payment-related data to refresh
    invalidate("app:user");
    invalidate("app:invoice");
    invalidate("app:payments");

    // Update the invoice store if we're on the relevant invoice page
    const currentInvoice = get(invoice);
    if (currentInvoice && invoiceData && currentInvoice.id === invoiceData.id) {
      invoice.set({ ...currentInvoice, ...invoiceData, confirmed: true });
    }

    // Broadcast to payment events store for green checkmark UI
    const amount = payment?.amountSat || payment?.amount || 0;
    if (amount > 0) {
      const { notifyPaymentReceived } = await import('$lib/stores/paymentEvents');
      notifyPaymentReceived(
        {
          amountSat: amount,
          paymentType: 'receive',
          ...payment
        },
        'confirmed'
      );
    }

    // Navigate to payment received page with green checkmark
    const currentPath = window.location.pathname;
    const username = cookies.get("username");

    // Show green checkmark if on receive-related pages
    if (currentPath.includes('/receive') ||
        currentPath.includes(`/${username}`) ||
        currentPath.includes('/invoice')) {
      await wait(() => !get(navigating));
      setTimeout(() => {
        goto('/payment-received');
      }, 1000);
    }
  },

  async invoicePaid() {
    const { invoiceId, amountSat } = data;

    // Invalidate to refresh data
    invalidate("app:user");
    invalidate("app:invoice");
    invalidate("app:payments");

    // Update the invoice store if viewing this invoice
    const currentInvoice = get(invoice);
    if (currentInvoice && invoiceId && currentInvoice.id === invoiceId) {
      invoice.set({ ...currentInvoice, confirmed: true, paid: true });
    }

    // Broadcast to payment events store for green checkmark UI
    if (amountSat > 0) {
      const { notifyPaymentReceived } = await import('$lib/stores/paymentEvents');
      notifyPaymentReceived(
        {
          amountSat,
          paymentType: 'receive',
          id: invoiceId
        },
        'complete'
      );
    }

    // Navigate to payment received page with green checkmark
    const currentPath = window.location.pathname;
    const username = cookies.get("username");

    // Show green checkmark if on receive-related pages
    if (currentPath.includes('/receive') ||
        currentPath.includes(`/${username}`) ||
        currentPath.includes('/invoice')) {
      await wait(() => !get(navigating));
      setTimeout(() => {
        goto('/payment-received');
      }, 1000);
    }
  },

  async balanceUpdated() {
    const { balanceSat } = data;
    
    // Just invalidate user data to refresh balance
    invalidate("app:user");
    
    // Optional: Could update a balance store directly here
  },
  
  async balance_update() {
    // Handle the new balance_update message from the server
    const { balanceSat, pendingSendSat, pendingReceiveSat } = data;

    // Invalidate user data to refresh balance display
    invalidate("app:user");
    invalidate("app:wallet");

    // Log for debugging
    console.log(`[WebSocket] Balance update received: ${balanceSat} sats (pending send: ${pendingSendSat}, pending receive: ${pendingReceiveSat})`);
  },

  async 'webhook-request'() {
    // Handle webhook request from Breez service for Lightning Address payments
    const { requestId, payload } = data;
    console.log('[WebSocket] Webhook request received:', { requestId, payload });

    try {
      const { template, data: webhookData } = payload;

      // Dynamically import walletService to avoid circular deps
      const { prepareReceivePayment, receivePayment } = await import('$lib/walletService');

      if (template === 'lnurlpay_info') {
        // LNURL-Pay info request - return min/max amounts
        console.log('[Webhook] Handling lnurlpay_info request');

        const { fetchLightningLimits } = await import('$lib/walletService');
        const limits = await fetchLightningLimits();

        const response = {
          callback: webhookData.callback_url,
          maxSendable: limits.receive.maxSat * 1000, // Convert to msat
          minSendable: limits.receive.minSat * 1000,
          metadata: JSON.stringify([["text/plain", "Pay to DGEN user"]]),
          tag: "payRequest"
        };

        await fetch('/api/webhook/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, response })
        });

      } else if (template === 'lnurlpay_invoice') {
        // LNURL-Pay invoice request - generate invoice
        console.log('[Webhook] Handling lnurlpay_invoice request');

        const amount = Math.floor(webhookData.amount / 1000); // Convert msat to sat

        const prepareResponse = await prepareReceivePayment({
          paymentMethod: 'lightning',
          payerAmountSat: amount
        });

        const receiveResponse = await receivePayment({
          prepareResponse,
          description: webhookData.comment || 'Lightning Address payment'
        });

        const verifyUrl = webhookData.verify_url?.replace(
          '{payment_hash}',
          receiveResponse.paymentHash || ''
        );

        const response = {
          pr: receiveResponse.destination,
          routes: [],
          ...(verifyUrl && { verify: verifyUrl })
        };

        await fetch('/api/webhook/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, response })
        });

      } else {
        console.warn('[Webhook] Unknown template:', template);
      }
    } catch (error) {
      console.error('[Webhook] Error handling webhook request:', error);
      // Send error response
      await fetch('/api/webhook/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          response: { status: 'ERROR', reason: error.message }
        })
      });
    }
  },

  connected: auth,
});

const initialReconnectDelay = 1000;
const maxReconnectDelay = 16000;

let currentReconnectDelay = initialReconnectDelay;

let connecting;
export async function connect(t) {
  if (connecting) return;
  connecting = true;
  setTimeout(() => {
    connecting = false;
  }, 5000);

  token = t;

  if (socket) return auth();

  // WebSocket URL resolution with proper fallback chain
  let wsUrl = PUBLIC_SOCKET;
  
  // Logging utility for debugging (only in development)
  const log = (message: string, data?: any) => {
    if (import.meta.env.DEV || window.location.hostname === 'localhost') {
      console.log(`[WebSocket] ${message}`, data || '');
    }
  };
  
  // Handle Netlify's environment variable masking (occurs in netlify serve and production)
  if (!wsUrl || wsUrl.includes('*')) {
    log('Environment variable is masked or empty, fetching runtime config', wsUrl);
    
    // Fetch runtime config from server (this bypasses Netlify's masking)
    try {
      await loadRuntimeConfig();
      const config = get(runtimeConfig);
      
      if (config.PUBLIC_SOCKET && !config.PUBLIC_SOCKET.includes('*')) {
        wsUrl = config.PUBLIC_SOCKET;
        log('Using runtime config from server', wsUrl);
      }
    } catch (error) {
      console.error('Failed to load runtime config:', error);
    }
    
    // Fallback chain if runtime config fails
    if (!wsUrl || wsUrl.includes('*')) {
      if (typeof window !== 'undefined' && window.location) {
        // Try window-based configs (for backwards compatibility)
        const fallbackUrl = (window as any).__PUBLIC_SOCKET__ || 
                           (window as any).__ENV__?.PUBLIC_SOCKET ||
                           (window as any).__RUNTIME_CONFIG__?.PUBLIC_SOCKET;
        
        if (fallbackUrl && !fallbackUrl.includes('*')) {
          wsUrl = fallbackUrl;
          log('Using window fallback URL', wsUrl);
        } else {
          // Use localhost fallback for development
          wsUrl = 'ws://localhost:3119/ws';
          
          // Only warn in development
          if (import.meta.env.DEV) {
            console.warn('WebSocket using localhost fallback. Set PUBLIC_SOCKET in .env for production.');
          }
          log('Using localhost fallback', wsUrl);
        }
      }
    }
  }

  // Handle relative WebSocket URLs (e.g., /ws)
  if (wsUrl.startsWith('/')) {
    // Construct full URL based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    wsUrl = `${protocol}//${host}${wsUrl}`;
    log('Constructed WebSocket URL from relative path', wsUrl);
  }

  // Validate WebSocket URL format
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    console.error(`Invalid WebSocket URL format: ${wsUrl}`);
    throw new Error(`Invalid WebSocket URL format. Expected ws:// or wss:// but got: ${wsUrl}`);
  }

  log('Connecting to WebSocket', wsUrl);
  
  try {
    socket = new WebSocket(wsUrl);
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    throw error;
  }
  socket.addEventListener("open", onWebsocketOpen);
  socket.addEventListener("close", onWebsocketClose);
  socket.addEventListener("message", onWebsocketMessage);
}

export function close() {
  if (socket) socket.close();
}

async function onWebsocketMessage(msg) {
  const { type, data } = JSON.parse(msg.data);
  if (get(navigating)) await sleep(2000);

  if (messages(data)[type]) messages(data)[type]();
}

function onWebsocketOpen() {
  currentReconnectDelay = initialReconnectDelay;
  send("heartbeat", token);
}

function onWebsocketClose() {
  socket = null;
  setTimeout(
    () => {
      reconnectToWebsocket();
    },
    currentReconnectDelay + Math.floor(Math.random() * 3000),
  );
}

function reconnectToWebsocket() {
  if (currentReconnectDelay < maxReconnectDelay) {
    currentReconnectDelay *= 2;
  }
  connect(token);
}
