import { auth, g } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export async function load({ params, parent, fetch }) {
  const { user } = await parent();
  const { address, amount } = params;

  // Check if this is an internal invoice that should redirect to internal payment
  let invoice;
  try {
    invoice = await g(`/invoice/${address}`, fetch, {});
  } catch (e) {
    // invoice not found - normal external address
  }

  if (invoice) {
    const recipient = await g(`/users/${invoice.uid}`, fetch, {});
    let r = `/pay/${recipient.username}`;
    if (amount) r += `/${amount}`;
    if (recipient?.id !== user.id) redirect(307, r);
  }

  // Balance comes from SDK in browser
  // Return parent data so child components have access to user
  const parentData = await parent();
  return parentData;
}