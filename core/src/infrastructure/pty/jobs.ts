import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

export async function createJobOwner() {
  const executable = join(__dirname, '../../native/pty-job-host.exe')
    .replace('app.asar/', 'app.asar.unpacked/')
    .replace('app.asar\\', 'app.asar.unpacked\\')
  const helper = spawn(
    executable,
    [
      process.env['TERMINAL_MAIN_PID'] ?? String(process.ppid),
      String(process.pid)
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }
  )
  const pending = new Map<
    string,
    {
      resolve: () => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  let alive = true
  let readyResolve: () => void
  let readyReject: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  const timer = setTimeout(
    () => readyReject(new Error('Windows process owner did not start')),
    5000
  )
  const lines = createInterface({ input: helper.stdout })
  lines.on('line', (line) => {
    if (line === 'READY') {
      clearTimeout(timer)
      readyResolve()
      return
    }
    const [status, id] = line.split(' ')
    if (!id) return
    const request = pending.get(id)
    if (!request) return
    pending.delete(id)
    clearTimeout(request.timer)
    if (status === 'OK') request.resolve()
    else request.reject(new Error('Windows process ownership failed'))
  })
  const failed = () => {
    alive = false
    clearTimeout(timer)
    readyReject(new Error('Windows process owner stopped'))
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('Windows process owner stopped'))
    }
    pending.clear()
    // Fail closed: exiting this utility also closes all owned jobs in the helper.
    process.exit(1)
  }
  helper.once('error', failed)
  helper.once('exit', failed)
  await ready
  function command(id: string, operation: string): Promise<void> {
    if (!alive || pending.has(id))
      return Promise.reject(new Error('Windows process owner unavailable'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        helper.kill()
        reject(new Error('Windows process ownership timed out'))
      }, 5000)
      pending.set(id, { resolve, reject, timer })
      helper.stdin.write(operation + '\n')
    })
  }
  const closing = new Map<string, Promise<void>>()
  return {
    add: (id: string, pid: number) => command(id, `ADD ${id} ${pid}`),
    close: (id: string) => {
      const previous = closing.get(id)
      if (previous) return previous
      const operation = command(id, `KILL ${id}`).finally(() =>
        closing.delete(id)
      )
      closing.set(id, operation)
      return operation
    },
    dispose: () => {
      helper.removeListener('exit', failed)
      helper.removeListener('error', failed)
      helper.stdin.end()
      lines.close()
    }
  }
}
