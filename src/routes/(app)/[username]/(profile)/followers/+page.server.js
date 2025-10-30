import { g } from "$lib/utils";

export async function load({ depends, parent, fetch }) {
  depends("app:user");
  const { subject } = await parent();
  const followers = await g(`/${subject.pubkey}/followers`, fetch, {});
  return { followers };
}
