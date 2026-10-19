import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { resolveConfig } from './config.ts'

test('timezone uses system default, then local config, then CLI overrides', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const dataDir = await fs.mkdtemp(path.join(root, 'timezone-'))
  const options = { dataDir, week: '2026-10-05' }
  expect(await resolveConfig({ cwd: root, options })).toMatchObject({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, projects: [],
  })
  await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify({ timezone: 'Europe/London' }))
  expect(await resolveConfig({ cwd: root, options })).toMatchObject({ timezone: 'Europe/London' })
  expect(await resolveConfig({ cwd: root, options: { ...options, timezone: 'Asia/Tokyo' } }))
    .toMatchObject({ timezone: 'Asia/Tokyo' })
})
