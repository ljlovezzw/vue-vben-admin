export async function fetchHalloweenOverview() {
  const response = await fetch('/qa-data');
  return response.json();
}
export async function confirmHalloweenAction() {
  throw new Error('Read-only verification preview');
}
