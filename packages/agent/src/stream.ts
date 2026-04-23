import type * as http from "node:http";
import type { StreamEvent, ChunkEvent, DoneEvent, ErrorEvent } from "./types.js";

/**
 * ExecutionStream wraps an SSE HTTP response and yields typed StreamEvent objects.
 * Use `for await (const event of stream)` to iterate, or `stream.collect()` to
 * consume the entire stream and return the final DoneEvent.
 */
export class ExecutionStream {
  private readonly response: http.IncomingMessage;
  private consumed = false;
  /** Payment-Receipt header value from MPP paid execution, if present. */
  readonly paymentReceipt?: string;

  constructor(response: http.IncomingMessage, paymentReceipt?: string) {
    this.response = response;
    this.paymentReceipt = paymentReceipt;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<StreamEvent> {
    if (this.consumed) {
      throw new Error("Stream already consumed");
    }
    this.consumed = true;

    let currentEvent = "";
    let dataLine = "";
    let buffer = "";

    for await (const chunk of this.response) {
      buffer += chunk.toString();

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
        buffer = buffer.slice(newlineIdx + 1);

        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
          continue;
        }

        if (line.startsWith("data: ")) {
          dataLine = line.slice(6);
          continue;
        }

        // Empty line = end of event
        if (line === "" && currentEvent && dataLine) {
          const event = parseEvent(currentEvent, dataLine);
          if (event) {
            yield event;
            if (event.type === "done" || event.type === "error") {
              return;
            }
          }
          currentEvent = "";
          dataLine = "";
        }
      }
    }

    // Stream ended without done/error event
    throw new Error("Stream ended unexpectedly without a done event");
  }

  /**
   * Consume the entire stream and return the final DoneEvent.
   * Throws if an ErrorEvent is received or the stream ends without a done event.
   */
  async collect(): Promise<DoneEvent> {
    for await (const event of this) {
      if (event.type === "done") {
        return event;
      }
      if (event.type === "error") {
        throw new Error(`Stream error: ${event.error}`);
      }
      // chunk events are consumed silently
    }
    throw new Error("Stream ended without a done event");
  }
}

function parseEvent(eventType: string, data: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(data);
    switch (eventType) {
      case "chunk":
        return {
          type: "chunk",
          output: parsed.output,
          units_used: parsed.units_used,
          cumulative_cost: parsed.cumulative_cost,
        } satisfies ChunkEvent;
      case "done":
        return {
          type: "done",
          execution_id: parsed.execution_id,
          status: parsed.status,
          output: parsed.output,
          units_used: parsed.units_used,
          total_cost: parsed.total_cost,
          platform_fee: parsed.platform_fee,
          provider_payout: parsed.provider_payout,
        } satisfies DoneEvent;
      case "error":
        return {
          type: "error",
          error: parsed.error,
          units_used: parsed.units_used,
        } satisfies ErrorEvent;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
