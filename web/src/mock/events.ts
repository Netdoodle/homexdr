// Mock telemetry: a fixed set of processes (forming believable trees) plus background
// noise, generated deterministically. External addresses use RFC 5737 documentation
// ranges and reserved .example names.

import type { Event, Host } from '../api/types'
import { DAY, FW_ID, HOUR, LAPTOP_ID, LINUX_ID, MIN, NOW, PI_ID, SEC, WIN_ID, hostById } from './hosts'
import { hex, int, makeId, mulberry32, pick } from './rng'

export interface MockProcess {
  entity_id: string
  host_id: string
  pid: number
  name: string
  executable: string
  command_line: string
  user: string
  start: number // ms
  end?: number
  exit_code?: number
  parent?: string // entity_id
  sha256?: string
  signed?: boolean
  integrity?: string
}

const r = mulberry32(0xc0ffee)

export const processes: MockProcess[] = []

function proc(p: Omit<MockProcess, 'entity_id' | 'sha256'> & { sha256?: string }): MockProcess {
  const mp: MockProcess = { ...p, entity_id: hex(32, r), sha256: p.sha256 ?? hex(64, r) }
  processes.push(mp)
  return mp
}

// --- Windows desktop: the scenario behind most of the alerts --------------------------

const T0 = NOW - 95 * MIN // when the script was started
const winBoot = NOW - 2 * DAY - 3 * HOUR
const wUser = 'DESKTOP-7QK2M4\\alex'

export const wWinlogon = proc({
  host_id: WIN_ID,
  pid: 712,
  name: 'winlogon.exe',
  executable: 'C:\\Windows\\System32\\winlogon.exe',
  command_line: 'winlogon.exe',
  user: 'NT AUTHORITY\\SYSTEM',
  start: winBoot + 9 * SEC,
  signed: true,
  integrity: 'system',
})
export const wUserinit = proc({
  host_id: WIN_ID,
  pid: 5980,
  name: 'userinit.exe',
  executable: 'C:\\Windows\\System32\\userinit.exe',
  command_line: 'C:\\Windows\\system32\\userinit.exe',
  user: wUser,
  start: winBoot + 41 * SEC,
  end: winBoot + 44 * SEC,
  exit_code: 0,
  parent: wWinlogon.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wExplorer = proc({
  host_id: WIN_ID,
  pid: 6120,
  name: 'explorer.exe',
  executable: 'C:\\Windows\\explorer.exe',
  command_line: 'C:\\Windows\\Explorer.EXE',
  user: wUser,
  start: winBoot + 43 * SEC,
  parent: wUserinit.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wChrome = proc({
  host_id: WIN_ID,
  pid: 4410,
  name: 'chrome.exe',
  executable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  command_line: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
  user: wUser,
  start: NOW - 6 * HOUR,
  parent: wExplorer.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wPowershell = proc({
  host_id: WIN_ID,
  pid: 8844,
  name: 'powershell.exe',
  executable: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  command_line:
    '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\\Users\\alex\\Downloads\\printer-setup-v2.4.1-x64-unattended-installer-helper.ps1" -Mode Silent -LogPath "C:\\Users\\alex\\AppData\\Local\\Temp\\printer-setup.log"',
  user: wUser,
  start: T0,
  parent: wExplorer.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wConhost = proc({
  host_id: WIN_ID,
  pid: 8852,
  name: 'conhost.exe',
  executable: 'C:\\Windows\\System32\\conhost.exe',
  command_line: '\\??\\C:\\Windows\\system32\\conhost.exe 0xffffffff -ForceV1',
  user: wUser,
  start: T0 + 120,
  parent: wPowershell.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wWhoami = proc({
  host_id: WIN_ID,
  pid: 9012,
  name: 'whoami.exe',
  executable: 'C:\\Windows\\System32\\whoami.exe',
  command_line: '"C:\\Windows\\system32\\whoami.exe" /all',
  user: wUser,
  start: T0 + 4 * SEC,
  end: T0 + 4 * SEC + 310,
  exit_code: 0,
  parent: wPowershell.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wNetUser = proc({
  host_id: WIN_ID,
  pid: 9030,
  name: 'net.exe',
  executable: 'C:\\Windows\\System32\\net.exe',
  command_line: '"C:\\Windows\\system32\\net.exe" user',
  user: wUser,
  start: T0 + 6 * SEC,
  end: T0 + 6 * SEC + 420,
  exit_code: 0,
  parent: wPowershell.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wNet1 = proc({
  host_id: WIN_ID,
  pid: 9034,
  name: 'net1.exe',
  executable: 'C:\\Windows\\System32\\net1.exe',
  command_line: 'C:\\Windows\\system32\\net1 user',
  user: wUser,
  start: T0 + 6 * SEC + 40,
  end: T0 + 6 * SEC + 400,
  exit_code: 0,
  parent: wNetUser.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wNetGroup = proc({
  host_id: WIN_ID,
  pid: 9046,
  name: 'net.exe',
  executable: 'C:\\Windows\\System32\\net.exe',
  command_line: '"C:\\Windows\\system32\\net.exe" localgroup administrators',
  user: wUser,
  start: T0 + 8 * SEC,
  end: T0 + 8 * SEC + 380,
  exit_code: 0,
  parent: wPowershell.entity_id,
  signed: true,
  integrity: 'medium',
})
export const wReg = proc({
  host_id: WIN_ID,
  pid: 9120,
  name: 'reg.exe',
  executable: 'C:\\Windows\\System32\\reg.exe',
  command_line:
    'reg.exe add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v PrinterHelper /t REG_SZ /d "powershell.exe -WindowStyle Hidden -File C:\\Users\\alex\\AppData\\Roaming\\PrinterHelper\\helper.ps1" /f',
  user: wUser,
  start: T0 + 15 * SEC,
  end: T0 + 15 * SEC + 200,
  exit_code: 0,
  parent: wPowershell.entity_id,
  signed: true,
  integrity: 'medium',
})

// Ordinary Windows processes for background noise.
const winApps = [
  ['Code.exe', 'C:\\Users\\alex\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', '"C:\\Users\\alex\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" --type=renderer'],
  ['git.exe', 'C:\\Program Files\\Git\\cmd\\git.exe', 'git.exe fetch --all --prune'],
  ['msedge.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '"msedge.exe" --type=utility --utility-sub-type=network.mojom.NetworkService'],
  ['OneDrive.exe', 'C:\\Users\\alex\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe', '"OneDrive.exe" /background'],
  ['steam.exe', 'C:\\Program Files (x86)\\Steam\\steam.exe', '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent'],
  ['notepad.exe', 'C:\\Windows\\System32\\notepad.exe', '"C:\\Windows\\system32\\notepad.exe" C:\\Users\\alex\\Documents\\todo.txt'],
] as const

// --- Linux server ---------------------------------------------------------------------

const lBoot = NOW - 17 * DAY
export const lSystemd = proc({
  host_id: LINUX_ID,
  pid: 1,
  name: 'systemd',
  executable: '/usr/lib/systemd/systemd',
  command_line: '/sbin/init',
  user: 'root',
  start: lBoot,
  signed: false,
})
export const lSshd = proc({
  host_id: LINUX_ID,
  pid: 1022,
  name: 'sshd',
  executable: '/usr/sbin/sshd',
  command_line: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups',
  user: 'root',
  start: lBoot + 6 * SEC,
  parent: lSystemd.entity_id,
})
export const lSshSession = proc({
  host_id: LINUX_ID,
  pid: 48211,
  name: 'sshd',
  executable: '/usr/sbin/sshd',
  command_line: 'sshd: admin [priv]',
  user: 'root',
  start: NOW - 3 * HOUR,
  parent: lSshd.entity_id,
})
export const lBash = proc({
  host_id: LINUX_ID,
  pid: 48240,
  name: 'bash',
  executable: '/usr/bin/bash',
  command_line: '-bash',
  user: 'admin',
  start: NOW - 3 * HOUR + 2 * SEC,
  parent: lSshSession.entity_id,
})
export const lSudo = proc({
  host_id: LINUX_ID,
  pid: 48302,
  name: 'sudo',
  executable: '/usr/bin/sudo',
  command_line: 'sudo systemctl enable --now prometheus-node-exporter.service',
  user: 'admin',
  start: NOW - 3 * HOUR + 4 * MIN,
  end: NOW - 3 * HOUR + 4 * MIN + 2 * SEC,
  exit_code: 0,
  parent: lBash.entity_id,
})
export const lSystemctl = proc({
  host_id: LINUX_ID,
  pid: 48303,
  name: 'systemctl',
  executable: '/usr/bin/systemctl',
  command_line: 'systemctl enable --now prometheus-node-exporter.service',
  user: 'root',
  start: NOW - 3 * HOUR + 4 * MIN + 100,
  end: NOW - 3 * HOUR + 4 * MIN + 1900,
  exit_code: 0,
  parent: lSudo.entity_id,
})
export const lDocker = proc({
  host_id: LINUX_ID,
  pid: 1290,
  name: 'dockerd',
  executable: '/usr/bin/dockerd',
  command_line: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock',
  user: 'root',
  start: lBoot + 12 * SEC,
  parent: lSystemd.entity_id,
})
export const lDockerPs = proc({
  host_id: LINUX_ID,
  pid: 48410,
  name: 'docker',
  executable: '/usr/bin/docker',
  command_line: 'docker compose -f /opt/stacks/media/compose.yaml pull',
  user: 'admin',
  start: NOW - 2 * HOUR - 40 * MIN,
  end: NOW - 2 * HOUR - 38 * MIN,
  exit_code: 0,
  parent: lBash.entity_id,
})

const linuxApps = [
  ['cron', '/usr/sbin/cron', '/usr/sbin/CRON -f -P'],
  ['apt-get', '/usr/bin/apt-get', 'apt-get -qq update'],
  ['containerd-shim', '/usr/bin/containerd-shim-runc-v2', '/usr/bin/containerd-shim-runc-v2 -namespace moby -id 4f1c2a9b'],
  ['logrotate', '/usr/sbin/logrotate', '/usr/sbin/logrotate /etc/logrotate.conf'],
  ['restic', '/usr/bin/restic', 'restic backup /srv/data --tag nightly'],
] as const

// --- Events ---------------------------------------------------------------------------

export const events: Event[] = []

function baseEvent(host: Host, ts: number, kind = 'event'): Event {
  return {
    id: makeId(ts, r),
    '@timestamp': new Date(ts).toISOString(),
    agent: {
      id: host.id,
      version: host.agent_version ?? '0.1.0',
      type: host.kind === 'network' ? 'syslog' : 'endpoint',
    },
    host: {
      id: host.id,
      name: host.hostname,
      hostname: host.hostname,
      os: { platform: host.os.platform, family: host.os.family, name: host.os.name, version: host.os.version, kernel: host.os.kernel },
      ip: host.ips,
      architecture: host.arch,
    },
    event: { kind, ingested: new Date(ts + 900).toISOString() },
  }
}

function procRef(p: MockProcess, withParent = true): NonNullable<Event['process']> {
  const parent = withParent && p.parent ? processes.find((x) => x.entity_id === p.parent) : undefined
  const [domain, name] = p.user.includes('\\') ? p.user.split('\\') : [undefined, p.user]
  return {
    entity_id: p.entity_id,
    pid: p.pid,
    name: p.name,
    executable: p.executable,
    command_line: p.command_line,
    start: new Date(p.start).toISOString(),
    user: { name, domain },
    hash: p.sha256 ? { sha256: p.sha256 } : undefined,
    code_signature: p.signed !== undefined ? { exists: p.signed, valid: p.signed, trusted: p.signed } : undefined,
    integrity_level: p.integrity,
    parent: parent ? procRef(parent, false) : undefined,
  }
}

const sensorModule = (h: Host) => (h.os.platform === 'windows' ? 'etw' : h.id === PI_ID ? 'procconn' : 'ebpf')

export function processStartEvent(p: MockProcess): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, p.start)
  e.event = { ...e.event, category: ['process'], type: ['start'], action: 'exec', module: sensorModule(h), dataset: `${h.os.platform}.process` }
  e.process = procRef(p)
  e.user = { name: procRef(p).user?.name, domain: procRef(p).user?.domain }
  return e
}

function processEndEvent(p: MockProcess): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, p.end!)
  e.event = { ...e.event, category: ['process'], type: ['end'], action: 'exit', module: sensorModule(h), dataset: `${h.os.platform}.process` }
  e.process = { ...procRef(p), end: new Date(p.end!).toISOString(), exit_code: p.exit_code }
  return e
}

function netEvent(p: MockProcess, ts: number, dst: { ip: string; port: number; domain?: string }, transport = 'tcp'): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, ts)
  const sport = int(49152, 65000, r)
  e.event = { ...e.event, category: ['network'], type: ['connection', 'start'], action: 'connect', module: sensorModule(h), dataset: `${h.os.platform}.network` }
  e.process = procRef(p, false)
  e.source = { ip: h.ips[0], port: sport }
  e.destination = { ip: dst.ip, port: dst.port, domain: dst.domain }
  e.network = {
    transport,
    type: dst.ip.includes(':') ? 'ipv6' : 'ipv4',
    direction: dst.ip.startsWith('192.168.') ? 'internal' : 'outbound',
    community_id: `1:${btoa(hex(20, r)).slice(0, 27)}=`,
    protocol: dst.port === 443 ? 'tls' : dst.port === 53 ? 'dns' : undefined,
  }
  return e
}

function dnsEvent(p: MockProcess, ts: number, name: string, ips: string[], rcode = 'NOERROR'): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, ts)
  e.event = { ...e.event, category: ['network'], type: ['protocol', 'info'], action: 'dns-query', module: sensorModule(h), dataset: `${h.os.platform}.dns` }
  e.process = procRef(p, false)
  e.dns = { type: 'query', question: { name, type: 'A' }, response_code: rcode, resolved_ip: ips }
  e.network = { protocol: 'dns', transport: 'udp' }
  return e
}

function fileEvent(p: MockProcess, ts: number, path: string, action: 'creation' | 'change' | 'deletion'): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, ts)
  const sep = path.includes('\\') ? '\\' : '/'
  const name = path.split(sep).pop() ?? path
  e.event = { ...e.event, category: ['file'], type: [action], action: action === 'creation' ? 'create' : action === 'change' ? 'write' : 'delete', module: sensorModule(h), dataset: `${h.os.platform}.file` }
  e.process = procRef(p, false)
  e.file = {
    path,
    name,
    directory: path.slice(0, path.length - name.length - 1),
    extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : undefined,
    size: int(200, 90000, r),
    hash: action !== 'deletion' ? { sha256: hex(64, r) } : undefined,
  }
  return e
}

function registryEvent(p: MockProcess, ts: number, key: string, value: string, data: string): Event {
  const h = hostById(p.host_id)!
  const e = baseEvent(h, ts)
  e.event = { ...e.event, category: ['registry'], type: ['change'], action: 'set-value', module: 'etw', dataset: 'windows.registry' }
  e.process = procRef(p, false)
  e.registry = { hive: 'HKU', key, path: `HKU\\S-1-5-21-3623811015-3361044348-30300820-1001\\${key}\\${value}`, value, data: { type: 'REG_SZ', strings: [data] } }
  return e
}

function push(e: Event) {
  events.push(e)
  return e
}

// Scenario events (Windows) -------------------------------------------------------------

for (const p of [wPowershell, wConhost, wWhoami, wNetUser, wNet1, wNetGroup, wReg, wChrome]) push(processStartEvent(p))
for (const p of [wWhoami, wNetUser, wNet1, wNetGroup, wReg]) push(processEndEvent(p))

export const scenarioDns = push(dnsEvent(wPowershell, T0 + 1200, 'cdn.printer-drivers.example', ['203.0.113.77']))
export const scenarioConnect = push(netEvent(wPowershell, T0 + 1500, { ip: '203.0.113.77', port: 443, domain: 'cdn.printer-drivers.example' }))
push(netEvent(wPowershell, T0 + 10 * SEC, { ip: '203.0.113.77', port: 443, domain: 'cdn.printer-drivers.example' }))
export const scenarioFile = push(fileEvent(wPowershell, T0 + 3 * SEC, 'C:\\Users\\alex\\AppData\\Roaming\\PrinterHelper\\helper.ps1', 'creation'))
push(fileEvent(wPowershell, T0 + 3 * SEC + 200, 'C:\\Users\\alex\\AppData\\Local\\Temp\\printer-setup.log', 'creation'))
push(fileEvent(wPowershell, T0 + 20 * SEC, 'C:\\Users\\alex\\AppData\\Local\\Temp\\printer-setup.log', 'change'))
export const scenarioRegistry = push(
  registryEvent(
    wReg,
    T0 + 15 * SEC + 120,
    'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    'PrinterHelper',
    'powershell.exe -WindowStyle Hidden -File C:\\Users\\alex\\AppData\\Roaming\\PrinterHelper\\helper.ps1',
  ),
)
// PowerShell script block logging (Event ID 4104) for the script.
{
  const h = hostById(WIN_ID)!
  const e = baseEvent(h, T0 + 900)
  e.event = {
    ...e.event,
    category: ['process'],
    type: ['info'],
    action: 'script-block',
    module: 'eventlog',
    dataset: 'windows.powershell',
    provider: 'Microsoft-Windows-PowerShell',
    code: '4104',
  }
  e.process = procRef(wPowershell, false)
  e.message = 'Creating Scriptblock text (1 of 1)'
  e.data = {
    Channel: 'Microsoft-Windows-PowerShell/Operational',
    ScriptBlockId: 'f0b4a0f1-3c9e-4a8e-9a55-1f2b7f0e6d11',
    Path: 'C:\\Users\\alex\\Downloads\\printer-setup-v2.4.1-x64-unattended-installer-helper.ps1',
    ScriptBlockText: "whoami /all; net user; net localgroup administrators\nNew-Item -ItemType Directory \"$env:APPDATA\\PrinterHelper\" -Force | Out-Null",
  }
  push(e)
}

// Linux scenario events -------------------------------------------------------------------

for (const p of [lSshSession, lBash, lSudo, lSystemctl, lDockerPs]) push(processStartEvent(p))
for (const p of [lSudo, lSystemctl, lDockerPs]) push(processEndEvent(p))
push(fileEvent(lSystemctl, lSystemctl.start + 600, '/etc/systemd/system/multi-user.target.wants/prometheus-node-exporter.service', 'creation'))
{
  const h = hostById(LINUX_ID)!
  const e = baseEvent(h, lSystemctl.start + 1200)
  e.event = { ...e.event, category: ['configuration'], type: ['creation'], action: 'service-installed', module: 'authlog', dataset: 'linux.systemd' }
  e.service = { name: 'prometheus-node-exporter.service', type: 'systemd', start_type: 'auto', path: '/usr/bin/prometheus-node-exporter', account: 'prometheus', state: 'running' }
  e.process = procRef(lSystemctl, false)
  e.message = 'Created symlink /etc/systemd/system/multi-user.target.wants/prometheus-node-exporter.service'
  push(e)
}
for (let i = 0; i < 6; i++) {
  push(netEvent(lDockerPs, lDockerPs.start + 2000 + i * 900, { ip: '198.51.100.' + (20 + i), port: 443, domain: 'registry-1.docker.example' }))
}
push(dnsEvent(lDockerPs, lDockerPs.start + 1500, 'registry-1.docker.example', ['198.51.100.20', '198.51.100.21']))

// SSH authentication failures from a documentation-range address (brute-force pattern).
export const sshFailures: Event[] = []
{
  const h = hostById(LINUX_ID)!
  const start = NOW - 50 * MIN
  const users = ['root', 'admin', 'ubuntu', 'pi', 'test', 'oracle', 'postgres', 'git']
  for (let i = 0; i < 57; i++) {
    const ts = start + i * int(4, 9, r) * SEC
    const e = baseEvent(h, ts)
    const u = users[i % users.length]
    e.event = { ...e.event, category: ['authentication'], type: ['start'], action: 'ssh-login', outcome: 'failure', module: 'authlog', dataset: 'linux.auth' }
    e.user = { name: u }
    e.source = { ip: '198.51.100.23', port: int(30000, 60000, r) }
    e.destination = { ip: '192.168.1.20', port: 22 }
    e.process = procRef(lSshd, false)
    e.message = `Failed password for ${u === 'root' ? 'root' : 'invalid user ' + u} from 198.51.100.23 port ${e.source.port} ssh2`
    e.log = { app_name: 'sshd', facility: 'auth' }
    sshFailures.push(push(e))
  }
  const ok = baseEvent(h, NOW - 3 * HOUR - 1 * SEC)
  ok.event = { ...ok.event, category: ['authentication', 'session'], type: ['start'], action: 'ssh-login', outcome: 'success', module: 'authlog', dataset: 'linux.auth' }
  ok.user = { name: 'admin' }
  ok.source = { ip: '192.168.1.42', port: 51544 }
  ok.message = 'Accepted publickey for admin from 192.168.1.42 port 51544 ssh2: ED25519 SHA256:mVq3hOQ0yQ4c0x6YlU2bY3vO5o1c3HqW3D1h0kXr2pE'
  ok.process = procRef(lSshSession, false)
  push(ok)
}

// Network device (OPNsense filterlog + Suricata) -----------------------------------------

export const suricataAlerts: Event[] = []
{
  const h = hostById(FW_ID)!
  for (let i = 0; i < 260; i++) {
    const ts = NOW - Math.floor(Math.pow(r(), 1.6) * 7 * DAY)
    const e = baseEvent(h, ts)
    const blocked = r() < 0.7
    const src = blocked ? `198.51.100.${int(2, 250, r)}` : `192.168.1.${pick([20, 33, 42, 57], r)}`
    const dst = blocked ? '192.168.1.1' : `203.0.113.${int(2, 250, r)}`
    const dport = blocked ? pick([22, 23, 445, 3389, 8080, 5900, 1433], r) : pick([443, 443, 443, 80, 123, 853], r)
    e.event = {
      ...e.event,
      category: ['network'],
      type: ['connection', blocked ? 'denied' : 'allowed'],
      action: blocked ? 'block' : 'pass',
      module: 'opnsense',
      dataset: 'opnsense.filterlog',
      original: `<134>1 ${new Date(ts).toISOString()} fw-opnsense filterlog 4242 - [meta sequenceId="${i}"] 77,,,02f4bab031b57d1e30553ce08e0ec131,igb0,match,${blocked ? 'block' : 'pass'},in,4,0x0,,64,0,0,DF,6,tcp,60,${src},${dst},${int(30000, 60000, r)},${dport},0,S,${int(1, 4e9, r)},,64240,,mss;sackOK;TS;nop;wscale`,
    }
    e.observer = { name: 'fw-opnsense', type: 'firewall', vendor: 'Deciso', product: 'OPNsense', hostname: 'fw-opnsense', ip: ['192.168.1.1'] }
    e.source = { ip: src, port: int(30000, 60000, r) }
    e.destination = { ip: dst, port: dport }
    e.network = { transport: 'tcp', type: 'ipv4', direction: blocked ? 'inbound' : 'outbound', community_id: `1:${btoa(hex(20, r)).slice(0, 27)}=` }
    e.log = { app_name: 'filterlog', facility: 'local0' }
    e.message = `${blocked ? 'block' : 'pass'} in on igb0: ${src} → ${dst}:${dport}/tcp`
    push(e)
  }
  const sigs = [
    { sid: '2001219', name: 'ET SCAN Potential SSH Scan', cat: 'Attempted Information Leak' },
    { sid: '2002910', name: 'ET SCAN Potential VNC Scan 5900-5920', cat: 'Attempted Information Leak' },
    { sid: '2010937', name: 'ET SCAN Suspicious inbound to mySQL port 3306', cat: 'Potentially Bad Traffic' },
  ]
  for (let i = 0; i < 24; i++) {
    const s = sigs[i % 3]
    const ts = NOW - Math.floor(r() * 3 * DAY)
    const e = baseEvent(h, ts, 'alert')
    e.event = { ...e.event, category: ['intrusion_detection', 'network'], type: ['info', 'indicator'], action: 'alert', module: 'suricata', dataset: 'suricata.eve', severity: 47 }
    e.rule = { id: s.sid, name: s.name, category: s.cat, ruleset: 'ET Open', version: '3' }
    e.source = { ip: '198.51.100.' + int(2, 250, r), port: int(30000, 60000, r) }
    e.destination = { ip: '192.168.1.1', port: s.sid === '2001219' ? 22 : s.sid === '2002910' ? 5901 : 3306 }
    e.network = { transport: 'tcp', type: 'ipv4', direction: 'inbound', community_id: `1:${btoa(hex(20, r)).slice(0, 27)}=` }
    e.observer = { name: 'suricata', type: 'ids', vendor: 'OISF', product: 'Suricata', hostname: 'fw-opnsense' }
    e.threat = { framework: 'MITRE ATT&CK', tactics: [{ id: 'TA0007', name: 'Discovery' }], techniques: [{ id: 'T1046', name: 'Network Service Discovery' }] }
    e.data = { 'suricata.flow_id': int(1e14, 9e14, r), 'suricata.in_iface': 'igb0' }
    suricataAlerts.push(push(e))
  }
}

// Background noise for endpoints -----------------------------------------------------------

function noise(hostId: string, count: number, apps: readonly (readonly [string, string, string])[], parent: MockProcess, user: string) {
  const h = hostById(hostId)!
  const lastSeen = h.last_seen ? Date.parse(h.last_seen) : NOW
  const domains = ['github.com', 'api.github.com', 'update.example.org', 'www.example.com', 'time.cloudflare.com', 'ntp.ubuntu.com', 'cdn.example.net']
  for (let i = 0; i < count; i++) {
    const ts = lastSeen - Math.floor(Math.pow(r(), 1.4) * 7 * DAY)
    const a = pick(apps, r)
    const p: MockProcess = proc({
      host_id: hostId,
      pid: int(1000, 60000, r),
      name: a[0],
      executable: a[1],
      command_line: a[2],
      user,
      start: ts,
      end: r() < 0.6 ? ts + int(200, 600000, r) : undefined,
      exit_code: 0,
      parent: parent.entity_id,
      signed: hostId === WIN_ID || hostId === LAPTOP_ID ? true : undefined,
      integrity: hostId === WIN_ID || hostId === LAPTOP_ID ? 'medium' : undefined,
    })
    push(processStartEvent(p))
    const n = int(0, 3, r)
    for (let k = 0; k < n; k++) {
      const d = pick(domains, r)
      const ip = `203.0.113.${int(2, 250, r)}`
      if (r() < 0.5) push(dnsEvent(p, ts + 100 + k * 50, d, [ip]))
      push(netEvent(p, ts + 200 + k * 80, { ip, port: pick([443, 443, 443, 80], r), domain: d }))
    }
    if (r() < 0.3) {
      const path = hostId === WIN_ID || hostId === LAPTOP_ID ? `C:\\Users\\alex\\AppData\\Local\\Temp\\${hex(8, r)}.tmp` : `/var/tmp/${a[0]}-${hex(6, r)}`
      push(fileEvent(p, ts + 400, path, pick(['creation', 'change', 'deletion'] as const, r)))
    }
  }
}

noise(WIN_ID, 260, winApps, wExplorer, wUser)
noise(LINUX_ID, 220, linuxApps, lSystemd, 'root')

const laptopExplorer = proc({
  host_id: LAPTOP_ID,
  pid: 5512,
  name: 'explorer.exe',
  executable: 'C:\\Windows\\explorer.exe',
  command_line: 'C:\\Windows\\Explorer.EXE',
  user: 'LAPTOP-SAM\\sam',
  start: NOW - 9 * DAY,
  signed: true,
})
noise(LAPTOP_ID, 60, winApps, laptopExplorer, 'LAPTOP-SAM\\sam')

// Defender tamper event on the laptop (for an alert).
export const defenderEvent = (() => {
  const h = hostById(LAPTOP_ID)!
  const e = baseEvent(h, NOW - 2 * DAY - 5 * HOUR)
  e.event = {
    ...e.event,
    category: ['configuration', 'malware'],
    type: ['change'],
    action: 'defender-rtp-disabled',
    module: 'eventlog',
    dataset: 'windows.defender',
    provider: 'Microsoft-Windows-Windows Defender',
    code: '5001',
  }
  e.message = 'Microsoft Defender Antivirus Real-time Protection scanning for malware and other potentially unwanted software was disabled.'
  e.data = { Channel: 'Microsoft-Windows-Windows Defender/Operational', 'Product Name': 'Microsoft Defender Antivirus' }
  return push(e)
})()

const piSystemd = proc({ host_id: PI_ID, pid: 1, name: 'systemd', executable: '/usr/lib/systemd/systemd', command_line: '/sbin/init', user: 'root', start: NOW - 6 * DAY })
noise(PI_ID, 40, [['jellyfin', '/usr/lib/jellyfin/bin/jellyfin', '/usr/lib/jellyfin/bin/jellyfin --webdir=/usr/share/jellyfin/web'], ['cron', '/usr/sbin/cron', '/usr/sbin/CRON -f']] as const, piSystemd, 'jellyfin')

events.sort((a, b) => (a['@timestamp'] < b['@timestamp'] ? 1 : a['@timestamp'] > b['@timestamp'] ? -1 : 0))

export const eventById = (id: string) => events.find((e) => e.id === id)
