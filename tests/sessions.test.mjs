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

test('complete-command metadata reaches only the opt-in non-private history sink', async () => {
  let emit
  let sequence = 0
  const captured = [],
    events = []
  const sessions = new Sessions(
    {
      start: async (_id, _shell, _cwd, _grid, callback) => {
        emit = callback
        return { pid: 42, close: async () => {}, write: async () => {} }
      },
      onFailure: () => () => {},
      dispose: async () => {}
    },
    () => `metadata-${++sequence}`,
    (_owner, event) => events.push(event),
    (...entry) => captured.push(entry)
  )
  for (const policy of [
    { historyIntegration: false },
    { historyIntegration: true, privateHistory: true },
    { historyIntegration: true, privateHistory: false }
  ]) {
    const session = await sessions.create(
      'owner',
      { ...shell, id: 'pwsh', ...policy },
      'cwd',
      grid
    )
    if (policy.privateHistory) {
      await assert.rejects(
        sessions.write('owner', session.id, 'private command'),
        /policy is not ready/
      )
      emit({ type: 'integration', ready: true })
      await sessions.write('owner', session.id, 'private command')
    }
    emit({ type: 'command', command: 'Get-Location' })
    await sessions.close('owner', session.id)
    emit({ type: 'command', command: 'late' })
  }
  assert.deepEqual(captured, [['pwsh', 'Get-Location']])
  assert(!events.some((event) => event.type === 'command'))
  await sessions.dispose()
})

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

test('close during spawn waits for the handle, and disposal forbids new sessions', async () => {
  let resolveStart
  let closes = 0
  const delayed = fixture(
    () =>
      new Promise((resolve) => {
        resolveStart = resolve
      })
  )
  const creating = delayed.sessions.create('owner', shell, 'cwd', grid)
  const closing = delayed.sessions.close('owner', 'id-1')
  resolveStart({
    pid: 123,
    close: async () => {
      closes++
    }
  })
  assert.equal((await creating).state, 'closed')
  await closing
  assert.equal(closes, 1)
  await delayed.sessions.dispose()
  await assert.rejects(
    delayed.sessions.create('owner', shell, 'cwd', grid),
    /closed/
  )
})

test('owner cleanup closes only its sessions and bounds concurrent allocation', async () => {
  const { sessions, calls } = fixture()
  for (let index = 0; index < 4; index++)
    await sessions.create('owner', shell, 'cwd', grid)
  const other = await sessions.create('other', shell, 'cwd', grid)
  await assert.rejects(sessions.create('owner', shell, 'cwd', grid), /limit/)
  await sessions.closeOwner('owner')
  assert.equal(calls.filter(([type]) => type === 'close').length, 4)
  await sessions.write('other', other.id, 'still-owned')
  await sessions.dispose()
})

test('completed sessions can be reused beyond the record bound without losing ownership checks', async () => {
  const { sessions, calls } = fixture()
  const sibling = await sessions.create('other', shell, 'cwd', grid)
  for (let index = 0; index < 300; index++) {
    const session = await sessions.create('owner', shell, 'cwd', grid)
    await sessions.close('owner', session.id)
    await sessions.close('owner', session.id)
    await assert.rejects(sessions.close('other', session.id), /unowned/)
  }
  assert.equal(calls.filter(([type]) => type === 'close').length, 300)
  await sessions.write('other', sibling.id, 'still running')
  await sessions.dispose()
})

test('failed starts with no returned ID do not exhaust retained records', async () => {
  const { sessions } = fixture(async () => {
    throw new Error('Synthetic spawn failure')
  })
  for (let index = 0; index < 300; index++)
    await assert.rejects(
      sessions.create('owner', shell, 'cwd', grid),
      /Could not start/
    )
  await sessions.dispose()
})

test('pending closes stay bounded and cannot be evicted before host retirement', async () => {
  const retiring = []
  let sequence = 0
  const sessions = new Sessions(
    {
      start: async () => ({
        pid: 42,
        close: () => new Promise((resolve) => retiring.push(resolve))
      }),
      onFailure: () => () => {},
      dispose: async () => {}
    },
    () => `pending-${++sequence}`,
    () => {}
  )
  const closing = []
  for (let index = 0; index < 256; index++) {
    const session = await sessions.create('owner', shell, 'cwd', grid)
    closing.push(sessions.close('owner', session.id))
  }
  await assert.rejects(sessions.create('owner', shell, 'cwd', grid), /limit/)
  retiring[0]()
  await closing[0]
  const next = await sessions.create('owner', shell, 'cwd', grid)
  closing.push(sessions.close('owner', next.id))
  for (const finish of retiring) finish()
  await Promise.all(closing)
  await sessions.dispose()
})
