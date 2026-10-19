// Local tarball verification. All generated files stay under ignored weeks/.
import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand as execFile } from '../dist/adapters/process.js'
import { fixture } from '../dist/fixtures.js'

const root = path.resolve(import.meta.dirname, '..')
const parent = path.join(root, 'weeks', '.verification')
await fs.mkdir(parent, { recursive: true })
const tmp = await fs.mkdtemp(path.join(parent, 'package space ñ-'))
// Stop npm's ancestor project discovery at this isolated consumer directory.
await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'calendar-package-consumer', private: true, type: 'module' }))
const originalManifest = await fs.readFile(path.join(root, 'package.json'), 'utf8')
const packed = await execFile('npm', ['pack', '--json', '--pack-destination', tmp], { cwd: root })
const packedInfo = JSON.parse(packed.stdout)
const info = Array.isArray(packedInfo) ? packedInfo[0] : packedInfo[JSON.parse(originalManifest).name]
if (!info?.filename || !Array.isArray(info.files)) throw new Error('Unsupported npm pack JSON response')
const files = info.files.map(f => f.path)
const forbidden = files.filter(f => /^(routines\/|evidence\/|weeks\/|preferences\.json$|local-profile\.json$|config\.json$|\.env)/.test(f))
if (forbidden.length) throw new Error(`Runtime files in tarball: ${forbidden.join(', ')}`)
if (files.some(f => /\.py(?:[co])?$/.test(f))) throw new Error('Retired Python files in tarball')
for (const asset of ['assets/weektrace.svg', 'helpers/template.html', 'fonts/JetBrainsMono-Regular.woff2', 'fonts/OFL.txt', 'dist/cli.js',
  'examples/routines/weekly-work-calendar.md', 'examples/routines/daily-work-calendar.md']) {
  if (!files.includes(asset)) throw new Error(`Missing asset: ${asset}`)
}
const tarball = path.join(tmp, info.filename)
await execFile('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', tarball], { cwd: tmp })
const dataDir = path.join(tmp, 'runtime')
await fs.mkdir(path.join(dataDir, 'evidence'), { recursive: true })
const evidence = fixture()
await fs.writeFile(path.join(dataDir, 'evidence', `${evidence.week}.json`), JSON.stringify(evidence))
await fs.access(path.join(tmp, 'node_modules', 'weektrace', 'dist', 'cli.js'))
const result = await execFile('npx', ['--no-install', '--offline', '--', 'weektrace', 'render', '--week', evidence.week, '--timezone', evidence.timezone, '--data-dir', dataDir], { cwd: tmp })
if (await fs.readFile(path.join(root, 'package.json'), 'utf8') !== originalManifest) throw new Error('Consumer installation modified source package metadata')
const output = JSON.parse(result.stdout)
const html = await fs.readFile(output.html, 'utf8')
if (!html.includes('data:font/woff2;base64,') || !html.includes('ses_one')) throw new Error('Installed CLI report missing data/font')
console.log(JSON.stringify({ files: files.length, runtimeFiles: forbidden.length, installedOutsideSourceRoot: true,
  npxExecution: 'npx --no-install --offline -- weektrace render', sessions: output.sessions, report: output.html }, null, 2))
