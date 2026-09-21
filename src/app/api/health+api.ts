/** Liveness probe for the hosted deployment. */
export function GET(): Response {
  return Response.json({ ok: true });
}
