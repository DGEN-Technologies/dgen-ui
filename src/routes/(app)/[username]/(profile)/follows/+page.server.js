import { g } from "$lib/utils";

export async function load({ depends, parent, fetch }) {
  depends("app:user");
  const { subject } = await parent();
  const follows = await g(`/${subject.pubkey}/follows`, fetch, {});

  return { follows };
}
