import { CalendarProvider, CalendarProviderConfig } from './calendar-interface';

export async function createCalendarProvider(config: CalendarProviderConfig): Promise<CalendarProvider> {
  switch (config.provider) {
    case 'calendaring:calcom':
      throw new Error('Cal.com provider not yet implemented.');
    default:
      throw new Error(`Unknown calendar provider: ${config.provider}`);
  }
}
