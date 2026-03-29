const { app, BrowserWindow, shell } = require('electron');

const GAME_URL = 'https://arrowstorm.io';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ArrowStorm',
    backgroundColor: '#0a0a12',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow audio capture APIs used by the game
      webSecurity: true,
    }
  });

  // Handle getDisplayMedia for screen/tab audio capture.
  // Automatically grants loopback audio so the game can hear system audio
  // without a secondary browser tab prompt.
  win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    callback({ video: 'screen', audio: 'loopback' });
  });

  win.loadURL(GAME_URL);

  // Open external links (e.g. social, GitHub) in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(GAME_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
