import { CalendarEvent, CalendarAvailability, CalendarProviderConfig } from './calendar-types';

export interface CalendarProvider {
  readonly name: string;
  readonly type: string;

  initialize(config: CalendarProviderConfig): Promise<void>;

  listEvents?(query?: Record<string, any>): Promise<CalendarEvent[]>;
  createEvent?(event: CalendarEvent): Promise<CalendarEvent>;
  updateEvent?(event: CalendarEvent): Promise<CalendarEvent>;
  deleteEvent?(id: string): Promise<boolean>;

  getAvailability?(query?: Record<string, any>): Promise<CalendarAvailability[]>;
  createAvailability?(availability: CalendarAvailability): Promise<CalendarAvailability>;
}
