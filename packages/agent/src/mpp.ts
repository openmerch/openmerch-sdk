import type { MPPChallenge, PaymentHandler } from "./types.js";

/**
 * Parse WWW-Authenticate headers into structured MPPChallenge objects.
 * Expects the Payment scheme: `Payment method="tempo", intent="charge", id="ch_1", request="50000"`
 *
 * Handles both separate header values (string[]) and Node.js-joined values
 * where multiple headers are combined with ", " (e.g. "Payment ..., Payment ...").
 */
export function parseWWWAuthenticate(
  headerValues: string | string[],
): MPPChallenge[] {
  const values = Array.isArray(headerValues)
    ? headerValues
    : [headerValues];

  // Expand joined headers: Node.js joins multi-value headers with ", "
  // Split on ", Payment " boundary and re-add prefix
  const expanded: string[] = [];
  for (const v of values) {
    const parts = v.split(/, Payment /);
    for (let i = 0; i < parts.length; i++) {
      const part = i === 0 ? parts[i] : `Payment ${parts[i]}`;
      expanded.push(part.trim());
    }
  }

  const challenges: MPPChallenge[] = [];

  for (const raw of expanded) {
    // Must start with "Payment " scheme prefix
    if (!raw.startsWith("Payment ")) continue;

    const paramString = raw.slice("Payment ".length);
    const params = parseAuthParams(paramString);

    const method = params.method;
    const intent = params.intent;
    const id = params.id;
    if (!method || !intent || !id) continue;

    challenges.push({ method, intent, id, params });
  }

  return challenges;
}

/**
 * Select a payment handler for the given challenges.
 * Returns the first challenge whose method matches a registered handler,
 * respecting preferredMethods ordering if provided.
 */
export function selectPaymentHandler(
  challenges: MPPChallenge[],
  handlers: PaymentHandler[],
  preferredMethods?: string[],
): { handler: PaymentHandler; challenge: MPPChallenge } | null {
  if (handlers.length === 0 || challenges.length === 0) return null;

  const handlerMap = new Map<string, PaymentHandler>();
  for (const h of handlers) {
    handlerMap.set(h.method, h);
  }

  // Build ordered list: preferred methods first, then remaining in server order
  let ordered: MPPChallenge[];
  if (preferredMethods && preferredMethods.length > 0) {
    const preferred: MPPChallenge[] = [];
    const rest: MPPChallenge[] = [];
    const prefSet = new Set(preferredMethods);

    for (const c of challenges) {
      if (prefSet.has(c.method)) {
        preferred.push(c);
      } else {
        rest.push(c);
      }
    }

    // Sort preferred by the preference order
    preferred.sort(
      (a, b) =>
        preferredMethods.indexOf(a.method) -
        preferredMethods.indexOf(b.method),
    );

    ordered = [...preferred, ...rest];
  } else {
    ordered = challenges;
  }

  for (const challenge of ordered) {
    const handler = handlerMap.get(challenge.method);
    if (handler) {
      return { handler, challenge };
    }
  }

  return null;
}

/**
 * Parse auth-param list from WWW-Authenticate value.
 * Handles quoted string values: key="value", key=unquoted
 */
function parseAuthParams(input: string): Record<string, string> {
  const params: Record<string, string> = {};
  let remaining = input.trim();

  while (remaining.length > 0) {
    // Match key
    const eqIdx = remaining.indexOf("=");
    if (eqIdx === -1) break;

    const key = remaining.slice(0, eqIdx).trim();
    remaining = remaining.slice(eqIdx + 1).trimStart();

    let value: string;
    if (remaining.startsWith('"')) {
      // Quoted value — find closing quote (handle escaped quotes)
      let end = 1;
      while (end < remaining.length) {
        if (remaining[end] === "\\") {
          end += 2;
          continue;
        }
        if (remaining[end] === '"') break;
        end++;
      }
      value = remaining.slice(1, end).replace(/\\"/g, '"');
      remaining = remaining.slice(end + 1).trimStart();
    } else {
      // Unquoted value — ends at comma or end of string
      const commaIdx = remaining.indexOf(",");
      if (commaIdx === -1) {
        value = remaining.trim();
        remaining = "";
      } else {
        value = remaining.slice(0, commaIdx).trim();
        remaining = remaining.slice(commaIdx).trimStart();
      }
    }

    params[key] = value;

    // Skip comma separator
    if (remaining.startsWith(",")) {
      remaining = remaining.slice(1).trimStart();
    }
  }

  return params;
}

/** Thrown when a 402 is received but no payment handlers are configured. */
export class PaymentRequiredError extends Error {
  readonly name = "PaymentRequiredError";
  readonly statusCode = 402;
  readonly responseBody: string;
  readonly challenges: MPPChallenge[];

  constructor(challenges: MPPChallenge[], responseBody: string) {
    super(
      `Payment required: ${challenges.length} challenge(s) offered, no handlers configured`,
    );
    this.challenges = challenges;
    this.responseBody = responseBody;
  }
}

/** Thrown when a 402 is received but no registered handler matches any offered method. */
export class NoMatchingMethodError extends Error {
  readonly name = "NoMatchingMethodError";
  readonly statusCode = 402;
  readonly responseBody: string;
  readonly challenges: MPPChallenge[];

  constructor(challenges: MPPChallenge[], responseBody: string) {
    const methods = challenges.map((c) => c.method).join(", ");
    super(`No payment handler matches offered methods: ${methods}`);
    this.challenges = challenges;
    this.responseBody = responseBody;
  }
}
