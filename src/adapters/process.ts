import childProcess from 'node:child_process'
import util from 'node:util'
import { CalendarError } from '../errors.ts'

const execFile = util.promisify(childProcess.execFile)
export async function command({ executable, args }: { executable: string; args: string[] }) {
  return execFile(executable, args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 })
    .catch(cause => new CalendarError({ reason: `${executable} failed. Check that it is installed and the source is accessible; rerun the command.`, cause }))
}
