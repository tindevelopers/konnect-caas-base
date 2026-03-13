import { CalendarProvider } from "../calendar-interface";
import {
  CalendarEvent,
  CalendarProviderConfig,
  CalendarAvailability,
} from "../calendar-types";

interface CalComCredentials {
  apiKey: string;
  baseUrl: string;
}

type CalComRecord = Record<string, unknown>;

export class CalComProvider implements CalendarProvider {
  readonly name = "Cal.com";
  readonly type = "calendaring:calcom";

  private credentials?: CalComCredentials;

  async initialize(config: CalendarProviderConfig): Promise<void> {
    this.credentials = this.parseCredentials(config.credentials);
  }

  async listEvents(query?: Record<string, unknown>): Promise<CalendarEvent[]> {
    const start = this.optionalString(query?.start);
    const end = this.optionalString(query?.end);
    const limit = this.optionalString(query?.limit) ?? "100";

    const params: Record<string, string> = { take: limit };
    if (start) params.start = start;
    if (end) params.end = end;

    const response = await this.request("/v2/bookings", params);
    const rows = this.extractRows(response);
    return rows.map((row) => this.mapBookingToEvent(row));
  }

  async getAvailability(
    query?: Record<string, unknown>
  ): Promise<CalendarAvailability[]> {
    const start = this.optionalString(query?.start);
    const end = this.optionalString(query?.end);
    if (!start || !end) {
      return [];
    }

    const response = await this.request("/v2/slots", {
      start,
      end,
      eventTypeSlug: this.optionalString(query?.eventTypeSlug) ?? "",
    });
    const rows = this.extractRows(response);

    return rows
      .map((row) => {
        const slotStart = this.optionalString(row.start) ?? this.optionalString(row.time);
        const slotEnd = this.optionalString(row.end);
        if (!slotStart || !slotEnd) return null;
        return {
          start: slotStart,
          end: slotEnd,
          timezone: this.optionalString(row.timezone),
        };
      })
      .filter(Boolean) as CalendarAvailability[];
  }

  private parseCredentials(credentials: Record<string, unknown>): CalComCredentials {
    const apiKey = this.optionalString(credentials.apiKey);
    if (!apiKey) {
      throw new Error("Cal.com credentials require apiKey.");
    }

    const baseUrl =
      this.optionalString(credentials.baseUrl) ??
      this.optionalString(credentials.apiUrl) ??
      "https://api.cal.com";

    return {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ""),
    };
  }

  private async request(
    path: string,
    query?: Record<string, string>
  ): Promise<unknown> {
    if (!this.credentials) {
      throw new Error("Cal.com provider is not initialized.");
    }

    const url = new URL(path, this.credentials.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cal.com request failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  private extractRows(payload: unknown): CalComRecord[] {
    if (!payload || typeof payload !== "object") return [];
    const record = payload as CalComRecord;
    const data = record.data;
    if (Array.isArray(data)) return data as CalComRecord[];
    if (data && typeof data === "object") {
      const bookings = (data as CalComRecord).bookings;
      if (Array.isArray(bookings)) return bookings as CalComRecord[];
      const slots = (data as CalComRecord).slots;
      if (Array.isArray(slots)) return slots as CalComRecord[];
    }
    const rows = record.rows;
    if (Array.isArray(rows)) return rows as CalComRecord[];
    return [];
  }

  private mapBookingToEvent(item: CalComRecord): CalendarEvent {
    const title =
      this.optionalString(item.title) ??
      this.optionalString((item.eventType as CalComRecord | undefined)?.title) ??
      "Cal.com booking";
    const start =
      this.optionalString(item.start) ??
      this.optionalString(item.startTime) ??
      this.optionalString(item.startsAt) ??
      "";
    const end =
      this.optionalString(item.end) ??
      this.optionalString(item.endTime) ??
      this.optionalString(item.endsAt) ??
      start;
    const attendees = Array.isArray(item.attendees)
      ? (item.attendees as Array<Record<string, unknown>>)
          .map((entry) => this.optionalString(entry.email) ?? this.optionalString(entry.name))
          .filter(Boolean) as string[]
      : undefined;

    return {
      id: String(item.id ?? `${title}-${start}`),
      title,
      start,
      end,
      location: this.optionalString(item.location),
      description: this.optionalString(item.description),
      attendees,
      metadata: {
        raw: item,
      },
    };
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0
      ? value
      : undefined;
  }
}
