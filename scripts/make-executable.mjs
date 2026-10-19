import fs from 'node:fs/promises'

if (process.platform !== 'win32') {
  await fs.chmod(new URL('../dist/cli.js', import.meta.url), 0o755)
}
