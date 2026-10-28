import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionPtyPort } from '../../src/infrastructure/pty/session-port.ts'

const shell = {
  id: 'powershell',
  name: 'PowerShell',
  executable: 'powershell.exe',
  args: []
}
const grid = { cols: 80, rows: 24 }
function fixture() {
  const hosts = []
  const port = new SessionPtyPort(() => {
    const failures = new Set()
    const host = {
      disposed: 0,
      writes: [],
      acks: [],
      grids: [],
      emit: null,
      gate: null,
      onFailure(callback) {
        failures.add(callback)
        return () => failures.delete(callback)
      },
      fail() {
        for (const callback of failures) callback()
      },
      async start(_id, _shell, _cwd, _grid, emit) {
        this.emit = emit
        if (this.gate) await this.gate
        return {
          pid: 100 + hosts.indexOf(this),
          write: async (data) => {
            this.writes.push(data)
          },
          acknowledge: async (sequence) => {
            this.acks.push(sequence)
          },
          resize: async (size) => {
            this.grids.push(size)
          },
          close: async () => {
            throw new Error('Use whole owned-host disposal')
          }
        }
      },
      async dispose() {
        this.disposed++
      }
    }
    hosts.push(host)
    return host
  })
  return {
    port,
    hosts,
    start: (id, emit = () => {}) =>
      port.start(id, shell, 'C:\\work', grid, emit)
  }
}

test('each terminal owns a host and close reclaims it without closing a live sibling', async () => {
  const { port, hosts, start } = fixture()
  const one = await start('one'),
    two = await start('two')
  assert.equal(hosts.length, 2)
  await one.write('synthetic')
  await one.resize({ cols: 100, rows: 30 })
  await one.acknowledge(7)
  assert.deepEqual(hosts[0].writes, ['synthetic'])
  assert.deepEqual(hosts[0].acks, [7])
  assert.deepEqual(hosts[0].grids, [{ cols: 100, rows: 30 }])
  await Promise.all([one.close(), one.close()])
  assert.equal(hosts[0].disposed, 1)
  assert.equal(hosts[1].disposed, 0)
  await assert.rejects(one.write('late'), /closed/)
  await two.write('still live')
  await port.dispose()
  assert.equal(hosts[1].disposed, 1)
  await assert.rejects(start('late'), /unavailable/)
})

test('natural exit retires its host and late ACKs cannot relaunch a process', async () => {
  const { port, hosts, start } = fixture()
  const events = [],
    handle = await start('one', (event) => events.push(event))
  hosts[0].emit({ type: 'exit', exitCode: 7 })
  await handle.close()
  await handle.acknowledge(3)
  assert.equal(hosts[0].disposed, 1)
  assert.deepEqual(events, [{ type: 'exit', exitCode: 7 }])
  assert.deepEqual(hosts[0].acks, [])
  await start('two')
  assert.equal(hosts.length, 2)
  await port.dispose()
})

test('host failure closes the existing allocation and permits a fresh recovery', async () => {
  const { port, hosts, start } = fixture()
  await start('one')
  await start('two')
  let failures = 0
  port.onFailure(() => {
    failures++
  })
  hosts[0].fail()
  await start('recovered')
  assert.equal(failures, 1)
  assert.equal(hosts[0].disposed, 1)
  assert.equal(hosts[1].disposed, 1)
  await port.dispose()
  assert.equal(hosts[2].disposed, 1)
})

test('startup shutdown and early natural exit cannot strand a host', async () => {
  let resolve
  const gate = new Promise((done) => {
    resolve = done
  })
  let disposed = 0
  const port = new SessionPtyPort(() => ({
    onFailure: () => () => {},
    start: async (_id, _shell, _cwd, _grid, emit) => {
      emit({ type: 'exit', exitCode: 0 })
      await gate
      return {
        pid: 123,
        write: async () => {},
        resize: async () => {},
        acknowledge: async () => {},
        close: async () => {}
      }
    },
    dispose: async () => {
      disposed++
    }
  }))
  const starting = port.start('early', shell, 'C:\\work', grid, () => {})
  await port.dispose()
  resolve()
  await assert.rejects(starting, /closed during startup/)
  assert.equal(disposed, 1)
})

test('allocation remains bounded while hosts are live or still retiring', async () => {
  const { port, hosts, start } = fixture()
  const handles = await Promise.all(
    Array.from({ length: 16 }, (_, i) => start(String(i)))
  )
  await assert.rejects(start('overflow'), /unavailable/)
  let release
  hosts[0].dispose = () =>
    new Promise((done) => {
      release = done
    })
  const closing = handles[0].close()
  await assert.rejects(start('still bounded'), /unavailable/)
  release()
  await closing
  await start('replacement')
  await port.dispose()
})

test('failed resource disposal blocks further allocation and cannot be reported as a clean shutdown', async () => {
  const { port, hosts, start } = fixture()
  const handle = await start('one')
  await start('sibling')
  hosts[0].dispose = async () => {
    throw new Error('Synthetic host termination failure')
  }
  await assert.rejects(handle.close(), /termination failure/)
  await assert.rejects(start('unsafe replacement'), /unavailable/)
  await assert.rejects(port.dispose(), /did not shut down/)
  assert.equal(hosts[1].disposed, 1)
})
