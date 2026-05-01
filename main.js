const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require("electron-updater");

app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});
ipcMain.handle('get-app-version', () => {
    return app.getVersion(); // Tự động lấy từ package.json
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        icon: path.join(__dirname, 'icon.ico'), // Thêm icon
        webPreferences: {
            nodeIntegration: true,      // Cho phép dùng 'require' trong file JS
            contextIsolation: false,   // Bắt buộc phải có để nodeIntegration hoạt động
            enableRemoteModule: true
        }
    });

    // 1. Tắt thanh Menu mặc định (tùy chọn)
    win.setMenu(null); 

    // 2. Tải file HTML
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('app-version', app.getVersion());
    });

    // 3. Mở DevTools
    // win.webContents.openDevTools();
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

ipcMain.on('get-path-user-data', (event) => {
    event.returnValue = app.getPath('userData');
});


