import * as errore from 'errore'

export class CalendarError extends errore.createTaggedError({
  name: 'CalendarError',
  message: '$reason',
}) {}

export function boundary<T>(fn: () => T, reason: string): T | CalendarError {
  return errore.try({ try: fn, catch: cause => new CalendarError({ reason, cause }) })
}
