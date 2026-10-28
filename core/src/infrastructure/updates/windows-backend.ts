import updater from 'electron-updater'
import type { UpdateBackend } from './service'

export function createWindowsUpdateBackend(): UpdateBackend {
  const engine = updater.autoUpdater
  engine.autoDownload = false
  engine.autoInstallOnAppQuit = false
  engine.allowPrerelease = true
  engine.allowDowngrade = false
  engine.disableDifferentialDownload = true
  engine.logger = null
  return {
    async check() {
      const result = await engine.checkForUpdates()
      return result?.isUpdateAvailable ? result.updateInfo.version : null
    },
    async download(progress) {
      const receive = (info: { percent: number }) => progress(info.percent)
      engine.on('download-progress', receive)
      try {
        await engine.downloadUpdate()
      } finally {
        engine.removeListener('download-progress', receive)
      }
    },
    install: () => engine.quitAndInstall(false, true),
    onError(listener) {
      engine.on('error', listener)
      return () => {
        engine.removeListener('error', listener)
      }
    }
  }
}
