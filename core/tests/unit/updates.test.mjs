import assert from 'node:assert/strict'
import test from 'node:test'
import { UpdateService } from '../../src/infrastructure/updates/service.ts'

function fixture() {
  const calls = []
  let errorListener
  const backend = {
    async check() {
      calls.push('check')
      return '0.2.0-alpha.2'
    },
    async download(progress) {
      calls.push('download')
      for (const value of [NaN, -1, 50.4, Infinity, 101]) progress(value)
    },
    install() {
      calls.push('install')
    },
    onError(listener) {
      errorListener = listener
      return () => {
        errorListener = null
      }
    }
  }
  return { backend, calls, error: () => errorListener?.() }
}

test('updates coalesce requests, bound progress and require confirmation before session shutdown and install', async () => {
  const f = fixture()
  const service = new UpdateService(f.backend, '0.2.0-alpha.1', async () => {
    f.calls.push('shutdown')
  })
  const snapshots = []
  const detach = service.subscribe((status) => snapshots.push(status))
  await assert.rejects(
    service.install(async () => true),
    /No verified/
  )
  await assert.rejects(service.download(), /No update/)
  const first = service.check()
  assert.equal(service.check(), first)
  assert.equal((await first).phase, 'available')
  await service.download()
  assert.equal(service.current().phase, 'downloaded')
  assert(
    snapshots.every((status) => status.progress >= 0 && status.progress <= 100)
  )
  assert.equal((await service.check()).phase, 'downloaded')
  await service.install(async () => false)
  assert.deepEqual(f.calls, ['check', 'download'])
  await service.install(async () => true)
  assert.deepEqual(f.calls, ['check', 'download', 'shutdown', 'install'])
  const copy = service.current()
  copy.phase = 'idle'
  assert.equal(service.current().phase, 'installing')
  detach()
  detach()
  service.dispose()
})

test('failed downloads and shutdown never reach the installer and can be retried', async () => {
  const f = fixture()
  f.backend.download = async () => {
    throw new Error('private path and network details')
  }
  const service = new UpdateService(f.backend, '0.2.0-alpha.1', async () => {
    throw new Error('cleanup failed')
  })
  await service.check()
  await service.download()
  assert.equal(service.current().phase, 'error')
  assert(!service.current().message.includes('private'))
  f.backend.download = async () => {}
  await service.check()
  await service.download()
  await service.install(async () => true)
  assert.equal(service.current().phase, 'error')
  assert(!f.calls.includes('install'))
  service.dispose()
})

test('unsupported builds remain offline and external engine errors become bounded status messages', async () => {
  const disabled = new UpdateService(null, '0.2.0-alpha.1', async () => {
    assert.fail('No shutdown in development')
  })
  assert.equal((await disabled.check()).phase, 'unavailable')
  await assert.rejects(disabled.download(), /No update/)
  await assert.rejects(
    disabled.install(async () => true),
    /No verified/
  )
  const f = fixture()
  const service = new UpdateService(f.backend, '0.2.0-alpha.1', async () => {})
  f.error()
  assert.equal(service.current().phase, 'error')
  f.backend.check = async () => null
  assert.equal((await service.check()).phase, 'current')
  f.backend.check = async () => 'x'.repeat(100)
  assert.equal((await service.check()).phase, 'error')
  service.dispose()
  disabled.dispose()
})
