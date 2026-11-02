export type ParsedOrderEvent = { eventId: string; type: string } | { reasons: string[] };

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

const fieldReason = (name: string, value: unknown) =>
  value === undefined ? `${name} is missing` : `${name} must be a non-empty string`;

/** The fields processing relies on, or every reason the body is not an order event. */
export function parseOrderEvent(rawBody: string): ParsedOrderEvent {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { reasons: ['body is not valid JSON'] };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { reasons: ['body is not a JSON object'] };
  }

  const { event_id: eventId, type } = body as Record<string, unknown>;
  if (isText(eventId) && isText(type)) return { eventId, type };
  const reasons: string[] = [];
  if (!isText(eventId)) reasons.push(fieldReason('event_id', eventId));
  if (!isText(type)) reasons.push(fieldReason('type', type));
  return { reasons };
}
