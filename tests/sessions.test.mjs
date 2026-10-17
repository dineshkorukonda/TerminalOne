import assert from 'node:assert/strict'
import test from 'node:test'
import { Sessions } from '../src/application/terminal/sessions.ts'
import { validateGrid, validateInput } from '../src/domain/terminal/pty.ts'

function fixture(start) {
  let counter = 0
  let failed
  const events = []
  const calls = []
  const handle = {
    pid: 42,
    write: async (data) => calls.push(['write', data]),
    resize: async (grid) => calls.push(['resize', grid]),
    acknowledge: async () => {},
    close: async () => calls.push(['close'])
  }
  const port = {
    start: start ?? (async () => handle),
    onFailure: (fn) => {
      failed = fn
      return () => {}
    },
    dispose: async () => {}
  }
  const sessions = new Sessions(
    port,
    () => `id-${++counter}`,
    (owner, event) => events.push({ owner, ...event })
  )
  return { sessions, events, calls, fail: () => failed() }
}
const shell = {
  id: 'cmd',
  name: 'CMD',
  executable: 'C:\\Windows\\System32\\cmd.exe',
  args: ['/d']
}
const grid = { cols: 80, rows: 24 }

test('sessions validate ownership, preserve raw input, resize, and close idempotently', async () => {
  const { sessions, calls } = fixture()
  const session = await sessions.create('owner', shell, 'C:\\Users\\Test', grid)
  assert.equal(session.state, 'running')
  await sessions.write(
    'owner',
    session.id,
    '\u0003echo C:\\space path\\日本語\r'
  )
  assert.equal(calls[0][1], '\u0003echo C:\\space path\\日本語\r')
  await sessions.resize('owner', session.id, { cols: 120, rows: 40 })
  await assert.rejects(sessions.write('other', session.id, 'x'), /unowned/)
  await assert.rejects(sessions.close('owner', 'unknown'), /unowned/)
  await sessions.close('owner', session.id)
  await sessions.close('owner', session.id)
  assert.equal(calls.filter(([type]) => type === 'close').length, 1)
  await assert.rejects(sessions.write('owner', session.id, 'x'), /not running/)
  await sessions.closeOwner('owner')
  await sessions.dispose()
})

test('spawn failure and utility crash produce safe, actionable failures', async () => {
  const broken = fixture(async () => {
    throw new Error('secret private path')
  })
  await assert.rejects(
    broken.sessions.create('owner', shell, 'cwd', grid),
    /native Windows components/
  )
  assert(!JSON.stringify(broken.events).includes('secret private path'))
  const live = fixture()
  await live.sessions.create('owner', shell, 'cwd', grid)
  live.fail()
  assert(
    live.events.some(
      (event) => event.type === 'state' && event.state === 'failed'
    )
  )
  await live.sessions.dispose()
})

test('zero, fractional, oversized dimensions and large/non-string input fail', () => {
  for (const dimensions of [
    { cols: 0, rows: 1 },
    { cols: 80.5, rows: 24 },
    { cols: 501, rows: 24 },
    { cols: 80, rows: 301 },
    null
  ])
    assert.throws(() => validateGrid(dimensions))
  assert.throws(() => validateInput('x'.repeat(16385)))
  assert.throws(() => validateInput({}))
  assert.equal(validateInput('\u0000\u001b[A\u0003'), '\u0000\u001b[A\u0003')
})
