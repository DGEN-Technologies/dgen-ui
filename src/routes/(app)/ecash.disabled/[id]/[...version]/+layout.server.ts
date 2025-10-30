import getRates from "$lib/rates";
import { g } from "$lib/utils";

export async function load({ params, parent, fetch }) {
  const { user } = await parent();
  const rates = await getRates(fetch);
  let { id, version } = params;
  version ||= 4;
  version = parseInt(version);

  const { token, status } = await g(`/cash/${id}/${version}`, fetch, {});
  const { spent, total, mint, external } = status;
  return {
    id,
    token,
    spent,
    total,
    mint,
    external,
    version,
    rate: rates[user?.currency || "USD"],
  };
}
