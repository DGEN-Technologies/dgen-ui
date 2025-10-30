import { g } from "$lib/utils";
export const load = async () => {
  const users = [
    {
      username: "fustler",
      merchant: "rrdrive",
      type: "Bakery",
      user: null as any,
      merchant_data: null as any,
    },
    {
      username: "laluna",
      merchant: "butchersguild",
      type: "Butcher Shop",
      user: null as any,
      merchant_data: null as any,
    },
    {
      username: "ica547",
      merchant: "vanlove",
      type: "Sushi Restaurant",
      user: null as any,
      merchant_data: null as any,
    },
    {
      username: "reverendhodl",
      merchant: "laughingbean",
      type: "Cafe",
      user: null as any,
      merchant_data: null as any,
    },
  ];

  for (const user of users) {
    const { username, merchant } = user;
    console.log(username, merchant);
    user.user = await g(`/users/${username}`, fetch, {});
    user.merchant_data = await g(`/users/${merchant}`, fetch, {});
  }

  return { users };
};
