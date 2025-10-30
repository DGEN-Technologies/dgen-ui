import getRates from "$lib/rates";
import { g } from "$lib/utils";

export const load = async ({ depends, params: { id }, parent }) => {
  depends("app:payments");
  const data = await g(`/fund/${id}`, fetch, {});
  data.managers = await g(`/fund/${id}/managers`, fetch, {});
  const rates = await getRates(fetch);
  const { user } = await parent();
  data.rate = rates[user?.currency || "USD"];
  return data;
};
