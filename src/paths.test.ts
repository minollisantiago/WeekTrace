import { expect, test } from 'vitest'
import { samePath } from './paths.ts'

test('Windows paths match across drive casing, separators and trailing separators', () => {
  expect(samePath('C:\\Users\\Name\\My Repo\\', 'c:/users/name/my repo')).toBe(true)
  expect(samePath('\\\\HOST\\Share\\Repo', '\\\\host\\share\\repo\\')).toBe(true)
  expect(samePath('C:\\repo', 'D:\\repo')).toBe(false)
  expect(samePath('/home/Name/repo', '/home/name/repo')).toBe(false)
  expect(samePath('C:\\repo', '/mnt/c/repo')).toBe(false)
})
