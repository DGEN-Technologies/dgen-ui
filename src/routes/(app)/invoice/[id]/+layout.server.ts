import { g } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, depends, params, url, parent, fetch }) {
  depends("app:invoice");

  const token = cookies.get("token");
  let { subject, user } = await parent();
  const { id } = params;
  let invoice;

  if (id) {
    invoice = await g(`/invoice/${id}`, fetch);
    const options = !!url.searchParams.get("options");
    let { amount, pending, received } = invoice;
    amount = parseInt(amount);

    const paid =
      (!amount && (pending || received)) ||
      (amount > 0 && (pending >= amount || received >= amount));
    if (paid && !url.pathname.endsWith("paid")) {
      if (invoice.uid === user.id)
        redirect(307, `/invoice/${id}/paid` + (options ? "?options=true" : ""));
      else redirect(307, `/pay/${subject.username}/${invoice.amount}`);
    }

    subject = invoice.user;

    if (
      user &&
      invoice.uid !== user.id &&
      !(url.pathname.includes("tip") || url.pathname.includes("memo")) &&
      !options
    ) {
      if (invoice.prompt && invoice.tip === null)
        redirect(307, `/invoice/${id}/tip`);
      else redirect(307, `/send/invoice/${id}`);
    }
  }

  // Force dark mode only for now - light mode needs more work
  const theme = "dark"; // cookies.get("theme") || "light";
  return { id, invoice, subject, user, token, theme };
}
