import { CalendarProvider } from './calendar-interface';
import { CalendarProviderConfig } from './calendar-types';
import { CalComProvider } from './providers/calcom-provider';

export async function createCalendarProvider(config: CalendarProviderConfig): Promise<CalendarProvider> {
  let provider: CalendarProvider;

  switch (config.provider) {
    case 'calendaring:calcom':
      provider = new CalComProvider();
      break;
    default:
      throw new Error(`Unknown calendar provider: ${config.provider}`);
  }

  await provider.initialize(config);
  return provider;
}
