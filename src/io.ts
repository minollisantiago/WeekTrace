import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { boundary, CalendarError } from './errors.ts'

export async function readJson<T>({ file, schema, optional = false }: {
  file: string; schema: z.ZodType<T>; optional?: boolean
}): Promise<T | CalendarError | null> {
  const raw = await fs.readFile(file, 'utf8').catch(cause => {
    if (optional && (cause as NodeJS.ErrnoException).code === 'ENOENT') return null
    return new CalendarError({ reason: `Cannot read input. Check the file or rerun collect: ${file}`, cause })
  })
  if (raw instanceof Error || raw === null) return raw
  const parsed = boundary(() => JSON.parse(raw) as object, 'Invalid JSON. Correct the input file and rerun.')
  if (parsed instanceof Error) return parsed
  const validated = schema.safeParse(parsed)
  if (!validated.success) return new CalendarError({ reason: `Invalid input: ${validated.error.message}. Correct the input and rerun.` })
  return validated.data
}
export async function writeFile({ file, contents }: { file: string; contents: string }) {
  const directory = await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
    .catch(cause => new CalendarError({ reason: 'Cannot create runtime directory. Choose a writable --data-dir or --output-dir.', cause }))
  if (directory instanceof Error) return directory
  return fs.writeFile(file, contents, { mode: 0o600 }).catch(cause => new CalendarError({
    reason: 'Cannot write report. Choose a writable --output-dir and rerun.', cause,
  }))
}
