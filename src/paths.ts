import path from 'node:path'

// Compare native Windows paths without rewriting stored evidence or POSIX paths.
// Windows case-sensitive directories are not supported by this comparison policy.
export function pathKey(directory: string) {
  return /^(?:[a-z]:[\\/]|\\\\)/i.test(directory)
    ? path.win32.normalize(directory).replace(/[\\/]+$/, '').toLowerCase()
    : directory
}

export const samePath = (a: string, b: string) => pathKey(a) === pathKey(b)
