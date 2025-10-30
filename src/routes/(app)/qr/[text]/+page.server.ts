export async function load({ params, fetch }) {
  const { text } = params;
  return { text };
}
