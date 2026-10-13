#!/usr/bin/env node
import module from 'node:module'
import { cli } from './commands.ts'
import { CalendarError } from './errors.ts'

const require = module.createRequire(import.meta.url)
cli.version((require('../package.json') as { version: string }).version)
const result = await cli.parse().catch(cause => new CalendarError({ reason: 'CLI failed. Check arguments with weektrace --help and rerun.', cause }))
if (result instanceof Error) {
  console.error(result.cause instanceof Error ? result.cause.message : result.message)
  process.exitCode = 1
}
