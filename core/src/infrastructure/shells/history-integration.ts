import { randomBytes } from 'node:crypto'

// Only opt-in PowerShell sessions install this hook. Frames are parsed in the
// utility host and never reach xterm or the generic renderer event stream.
export function historyIntegration(
  command: (value: string) => void,
  ready: () => void,
  privateSession = false
) {
  const nonce = randomBytes(24).toString('hex')
  const prefix = `\x1b]777;T1;${nonce};`
  let pending = ''
  const script = `try {
Import-Module PSReadLine -ErrorAction Stop
Set-PSReadLineOption -HistorySaveStyle SaveNothing
Set-PSReadLineOption -AddToHistoryHandler {
 param($line)
 if ($line.Length -le 4096) {
  $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line))
  [Console]::Write(([char]27) + ']777;T1;${nonce};C;' + $payload + [char]7)
 }
 return $true
}
[Console]::Write(([char]27) + ']777;T1;${nonce};R;' + [char]7)
} catch { ${privateSession ? "Write-Warning 'Private history policy could not be installed. Session closed.'; exit 1" : "Write-Warning 'Terminal One history integration is unavailable; native shell input remains available.'"} }`
  return {
    encoded: Buffer.from(script, 'utf16le').toString('base64'),
    feed(data: string) {
      pending += data
      let output = ''
      while (pending) {
        const start = pending.indexOf(prefix)
        if (start < 0) {
          let keep = Math.min(pending.length, prefix.length - 1)
          while (keep && !prefix.startsWith(pending.slice(-keep))) keep--
          output += pending.slice(0, pending.length - keep)
          pending = pending.slice(pending.length - keep)
          break
        }
        output += pending.slice(0, start)
        pending = pending.slice(start)
        const end = pending.indexOf('\x07', prefix.length)
        if (end < 0) {
          if (pending.length > 32768)
            throw new Error('History integration frame too large')
          break
        }
        const frame = pending.slice(prefix.length, end)
        pending = pending.slice(end + 1)
        if (frame === 'R;') ready()
        else if (frame.startsWith('C;')) {
          const payload = frame.slice(2)
          if (
            payload.length <= 21848 &&
            /^[A-Za-z0-9+/]*={0,2}$/.test(payload)
          ) {
            const value = Buffer.from(payload, 'base64').toString('utf8')
            if (
              value.length <= 4096 &&
              Buffer.from(value, 'utf8').toString('base64') === payload
            )
              command(value)
          }
        }
      }
      return output
    }
  }
}
