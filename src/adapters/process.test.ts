import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { command, runCommand } from './process.ts'

test('native commands retain literal arguments and Unicode paths with spaces', async () => {
  const parent = path.resolve('weeks/.verification')
  await fs.mkdir(parent, { recursive: true })
  const cwd = await fs.mkdtemp(path.join(parent, 'process space ñ-'))
  const args = ['a b', 'ñ', '& echo injected', '%PATH%', 'a"b', 'a\\b', '(test)', '']
  const result = await runCommand(process.execPath, ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', '--', ...args], { cwd })
  expect(JSON.parse(result.stdout)).toEqual(args)
})

test('npm launcher executes on the host platform', async () => {
  expect((await runCommand('npm', ['--version'])).stdout.trim()).toMatch(/^\d+\./)
})

test.skipIf(process.platform !== 'win32')('Windows npm cmd shims preserve shell-sensitive arguments', async () => {
  const parent = path.resolve('weeks/.verification')
  await fs.mkdir(parent, { recursive: true })
  const cwd = await fs.mkdtemp(path.join(parent, 'shim space ñ-'))
  const script = path.join(cwd, 'echo.cjs')
  await fs.writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)))')
  const bin = path.join(cwd, 'node_modules', '.bin')
  await fs.mkdir(bin, { recursive: true })
  const shim = path.join(bin, 'echo args.cmd')
  await fs.writeFile(shim, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`)
  const args = ['a b', 'ñ', '& echo injected', '%PATH%', 'a"b', '(test)']
  expect(JSON.parse((await runCommand(shim, args)).stdout)).toEqual(args)
})

test('missing commands and nonzero exits are reported as errors', async () => {
  expect(await command({ executable: 'weektrace-nonexistent-command', args: [] })).toBeInstanceOf(Error)
  await expect(runCommand(process.execPath, ['-e', 'process.exit(3)'])).rejects.toMatchObject({ code: 3 })
})

test('file-backed stdout preserves large responses even when a CLI exits immediately', async () => {
  const parent = path.resolve('weeks/.verification')
  await fs.mkdir(parent, { recursive: true })
  const cwd = await fs.mkdtemp(path.join(parent, 'file stdout ñ-'))
  const file = path.join(cwd, 'response.json')
  const output = await fs.open(file, 'w')
  try {
    const result = await runCommand(process.execPath, ['-e',
      'process.stdout.write(JSON.stringify({ data: "x".repeat(8 * 1024 * 1024), args: process.argv.slice(1) })); process.exit(0)',
      '--', '/api/session?directory=a b&cursor=%literal%'], {}, output.fd)
    expect(result.stdout).toBe('')
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(parsed.data.length).toBe(8 * 1024 * 1024)
    expect(parsed.args).toEqual(['/api/session?directory=a b&cursor=%literal%'])
  } finally { await output.close() }
})
