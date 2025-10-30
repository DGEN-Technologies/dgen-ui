import { json } from "@sveltejs/kit";

export async function POST({ cookies, request }) {
  return json(
    {
      error: "Seed phrase viewing disabled for security",
      message:
        "For your security, seed phrases cannot be retrieved via API. Please use your written backup from wallet setup.",
    },
    { status: 403 },
  );
}
