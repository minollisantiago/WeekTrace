// Local tarball verification. All generated files stay under ignored weeks/.
import fs from 'node:fs/promises'
import path from 'node:path'
import childProcess from 'node:child_process'
import util from 'node:util'
import { fixture } from '../dist/fixtures.js'

const execFile = util.promisify(childProcess.execFile)
const root = path.resolve(import.meta.dirname, '..')
const parent = path.join(root, 'weeks', '.verification')
await fs.mkdir(parent, { recursive: true })
const tmp = await fs.mkdtemp(path.join(parent, 'package-'))
// Stop npm's ancestor project discovery at this isolated consumer directory.
await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'calendar-package-consumer', private: true, type: 'module' }))
const originalManifest = await fs.readFile(path.join(root, 'package.json'), 'utf8')
const packed = await execFile('npm', ['pack', '--json', '--pack-destination', tmp], { cwd: root })
const info = JSON.parse(packed.stdout)[0]
const files = info.files.map(f => f.path)
const forbidden = files.filter(f => /^(evidence\/|weeks\/|preferences\.json$|local-profile\.json$|config\.json$|\.env)/.test(f))
if (forbidden.length) throw new Error(`Runtime files in tarball: ${forbidden.join(', ')}`)
for (const asset of ['helpers/template.html', 'fonts/JetBrainsMono-Regular.woff2', 'fonts/OFL.txt', 'dist/cli.js']) {
  if (!files.includes(asset)) throw new Error(`Missing asset: ${asset}`)
}
const tarball = path.join(tmp, info.filename)
await execFile('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', tarball], { cwd: tmp })
const dataDir = path.join(tmp, 'runtime')
await fs.mkdir(path.join(dataDir, 'evidence'), { recursive: true })
const evidence = fixture()
await fs.writeFile(path.join(dataDir, 'evidence', `${evidence.week}.json`), JSON.stringify(evidence))
await fs.access(path.join(tmp, 'node_modules', 'work-calendar-local', 'dist', 'cli.js'))
const result = await execFile('npx', ['--no-install', '--offline', '--', 'work-calendar-local', 'render', '--week', evidence.week, '--data-dir', dataDir], { cwd: tmp })
if (await fs.readFile(path.join(root, 'package.json'), 'utf8') !== originalManifest) throw new Error('Consumer installation modified source package metadata')
const output = JSON.parse(result.stdout)
const html = await fs.readFile(output.html, 'utf8')
if (!html.includes('data:font/woff2;base64,') || !html.includes('ses_one')) throw new Error('Installed CLI report missing data/font')
console.log(JSON.stringify({ files: files.length, runtimeFiles: forbidden.length, installedOutsideSourceRoot: true,
  npxExecution: 'npx --no-install --offline -- work-calendar-local render', sessions: output.sessions, report: output.html }, null, 2))
