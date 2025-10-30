import { g } from "$lib/utils";

export const load = async ({ fetch }) => {
  let data = { locations: [] };

  try {
    data = await g("/locations", fetch, {});
  } catch (e) {}

  return data;
};
