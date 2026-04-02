import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog } from 'electron'

let mainWindow: BrowserWindow | null = null

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Налична е нова версия',
      message: `DiktuvAI ${info.version} е налична. Искате ли да я изтеглите?`,
      buttons: ['Да', 'Не']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate()
      }
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available')
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Актуализацията е готова',
      message: 'Актуализацията е изтеглена. Рестартирайте приложението за да я инсталирате.',
      buttons: ['Рестартирай', 'По-късно']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', () => {
    // Silently ignore update errors in dev mode
  })
}

export function checkForUpdates(): void {
  try {
    autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('Failed to check for updates:', err)
  }
}
