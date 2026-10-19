import spawn from 'cross-spawn'
import type { SpawnOptions } from 'node:child_process'
import { CalendarError } from '../errors.ts'

// cross-spawn resolves Windows npm .cmd shims and escapes their arguments.
// Do not enable a shell globally: native binaries must receive literal arguments.
export function runCommand(executable: string, args: string[], options: SpawnOptions = {}, stdoutFile?: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, args, { ...options, stdio: ['ignore', stdoutFile ?? 'pipe', 'pipe'], windowsHide: true })
    const stdout: Buffer[] = [], stderr: Buffer[] = []
    let bytes = 0
    const timer = setTimeout(() => fail(new Error(`${executable} timed out`)), 180_000)
    function fail(error: Error) {
      clearTimeout(timer)
      child.kill()
      reject(error)
    }
    const capture = (chunks: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > 64 * 1024 * 1024) return fail(new Error(`${executable} output exceeded limit`))
      chunks.push(chunk)
    }
    child.stdout?.on('data', capture(stdout))
    child.stderr!.on('data', capture(stderr))
    child.on('error', fail)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const output = { stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }
      if (code === 0) resolve(output)
      else reject(Object.assign(new Error(`${executable} exited with ${signal ?? code}`), output, { code, signal }))
    })
  })
}
export async function command({ executable, args, stdoutFile }: { executable: string; args: string[]; stdoutFile?: number }) {
  return runCommand(executable, args, {}, stdoutFile)
    .catch(cause => new CalendarError({ reason: `${executable} failed. Check that it is installed and the source is accessible; rerun the command.`, cause }))
}
