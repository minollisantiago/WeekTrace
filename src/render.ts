import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { CalendarError } from './errors.ts'
import type { Report } from './report.ts'
import { localDate } from './time.ts'

export function safeJson(data: object) {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[c]!)
export async function renderHtml(data: Report) {
  const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
  const results = await Promise.all([
    fs.readFile(path.join(root, 'helpers/template.html'), 'utf8'),
    fs.readFile(path.join(root, 'fonts/JetBrainsMono-Regular.woff2')),
    fs.readFile(path.join(root, 'fonts/OFL.txt'), 'utf8'),
  ]).catch(cause => new CalendarError({ reason: 'Package assets unavailable. Reinstall the local tarball or restore helpers/template.html and fonts.', cause }))
  if (results instanceof Error) return results
  const [template, font, license] = results
  const lastDate = localDate(data.dates.at(-1)!, data.timezone).toString()
  const substitutions: Record<string, string> = { __DATA__: safeJson(data), __WEEK__: escapeHtml(`${data.week} to ${lastDate}`),
    __FONT__: font.toString('base64'), __FONT_LICENSE__: escapeHtml(license) }
  // One substitution pass prevents log-derived placeholder strings from being interpreted.
  return template.replace(/__DATA__|__WEEK__|__FONT__|__FONT_LICENSE__/g, key => substitutions[key]!)
}
