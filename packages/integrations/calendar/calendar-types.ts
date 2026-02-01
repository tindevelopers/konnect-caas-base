export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string[];
  metadata?: Record<string, any>;
}

export interface CalendarAvailability {
  start: string;
  end: string;
  timezone?: string;
}

export interface CalendarProviderConfig {
  provider: string;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}
