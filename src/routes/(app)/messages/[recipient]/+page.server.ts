import { g } from "$lib/utils";
import type { Message } from "$lib/types";

export async function load({ params, parent, fetch }) {
  const { user } = await parent();
  const { since = 0 } = params;

  let messages: Message[] = [];
  const recipient = await g(`/users/${params.recipient}`, fetch, {});

  try {
    messages = await g(`/${user.pubkey}/${since}/messages`, fetch, {});

    messages = messages
      .filter(
        (m: Message) =>
          m.recipient?.id === recipient.id || m.author?.id === recipient.id,
      )
      .sort((a, b) => a.created_at - b.created_at);
  } catch (e) {
    console.log("failed to fetch nostr messages", e);
  }

  return { messages, recipient, user };
}
