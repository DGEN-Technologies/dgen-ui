import { get } from "$lib/utils";

export async function load({ params, parent }) {
  const { user } = await parent();
  
  // Get the payment details
  const payment = await get(`/payment/${params.id}`);
  
  return {
    user,
    payment
  };
}