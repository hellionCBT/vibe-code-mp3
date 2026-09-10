const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const ffbinaries = require('ffbinaries');

let mainWindow;

const APPDATA_DIR = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
const APP_DIR = path.resolve(APPDATA_DIR, 'VibeMP3s');
const BIN_DIR = path.join(APP_DIR, 'bin');
const YT_DLP_PATH = path.join(BIN_DIR, 'yt-dlp.exe');
const FFMPEG_PATH = path.join(BIN_DIR, 'ffmpeg.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 720,
    backgroundColor: '#000000',
    title: 'VibeMP3s Terminal',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });

  const textUiHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>VibeMP3s Terminal</title>
    <style>
      :root {
        --bg: #000000;
        --panel-bg: #030303;
        --active-bg: #060606;
        --border: #003300;
        --active-border: #005500;
        --text: #00ff00;
        --active-text: #00ffaa;
        --status: #ffff00;
      }

      html {
        height: 100%;
        box-sizing: border-box;
      }

      body {
        background-color: var(--bg);
        color: var(--text);
        font-family: 'Consolas', 'Courier New', monospace;
        padding: 16px;
        margin: 0;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .console-output {
        flex: 1;
        white-space: pre-wrap;
        overflow-y: auto;
        border: 1px solid var(--border);
        padding: 12px;
        background: var(--panel-bg);
        margin-bottom: 8px;
        border-radius: 4px;
      }
      .active-task-box {
        border: 1px solid var(--active-border);
        background: var(--active-bg);
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-weight: bold;
        color: var(--active-text);
      }
      .control-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .input-row {
        display: flex;
        gap: 8px;
      }
      .theme-select-row {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--panel-bg);
        border: 1px solid var(--border);
        padding: 8px 12px;
        border-radius: 4px;
      }
      .theme-select-row label {
        font-size: 11px;
        font-weight: bold;
      }
      select {
        flex: 1;
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--text);
        font-family: inherit;
        padding: 6px 10px;
        font-size: 12px;
        outline: none;
        border-radius: 3px;
        cursor: pointer;
      }
      .color-picker-grid {
        display: none;
        justify-content: space-between;
        background: var(--panel-bg);
        border: 1px solid var(--border);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 11px;
      }
      .color-picker-grid.visible {
        display: flex;
      }
      .color-picker-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .color-picker-item input[type="color"] {
        -webkit-appearance: none;
        border: 1px solid var(--border);
        width: 45px;
        height: 22px;
        cursor: pointer;
        background: none;
        padding: 0;
        border-radius: 3px;
      }
      .color-picker-item input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      .color-picker-item input[type="color"]::-webkit-color-swatch {
        border: none;
        border-radius: 2px;
      }
      input[type="text"] {
        flex: 1;
        background: var(--bg);
        border: 1px solid var(--text);
        color: var(--text);
        font-family: inherit;
        padding: 8px 10px;
        font-size: 13px;
        outline: none;
        border-radius: 3px;
      }
      button {
        background: var(--bg);
        border: 1px solid var(--text);
        color: var(--text);
        font-family: inherit;
        padding: 8px 16px;
        cursor: pointer;
        font-weight: bold;
        border-radius: 3px;
      }
      button:hover { background: var(--text); color: var(--bg); }
      .meta-info {
        display: flex;
        justify-content: space-between;
        color: #777;
        font-size: 12px;
        padding-bottom: 4px;
      }
      #status { color: var(--status); }
    </style>
  </head>
  <body>
    <div id="output" class="console-output">[SYSTEM] Terminal initialized. Decoders loading...</div>
    <div id="activeTask" class="active-task-box">[STATUS] Ready for input...</div>
    
    <div class="control-panel">
      <div class="theme-select-row">
        <label>THEME:</label>
        <select id="themeSelect">
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="cyan">Cyan</option>
          <option value="pink">Pink</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div class="color-picker-grid" id="customGrid">
        <div class="color-picker-item"><span>BG</span><input type="color" id="cBg" value="#000000"></div>
        <div class="color-picker-item"><span>Panel</span><input type="color" id="cPanel" value="#030303"></div>
        <div class="color-picker-item"><span>Border</span><input type="color" id="cBorder" value="#003300"></div>
        <div class="color-picker-item"><span>Text</span><input type="color" id="cText" value="#00ff00"></div>
        <div class="color-picker-item"><span>Active</span><input type="color" id="cActive" value="#00ffaa"></div>
      </div>

      <div class="input-row">
        <input type="text" id="urlInput" placeholder="Paste Spotify link, YouTube URL, or search query..." />
        <button id="browseBtn">DIR</button>
        <button id="downloadBtn">DOWNLOAD</button>
      </div>
      <div class="meta-info">
        <span>OUT: <span id="dirDisplay" style="color: #888;"></span></span>
        <span id="status">STATUS: STANDBY</span>
      </div>
    </div>

    <script>
      const { ipcRenderer } = require('electron');
      const os = require('os');
      let selectedOutputDir = pathJoin(os.homedir(), 'Music', 'VibeMP3s');
      
      function pathJoin(...args) {
        return args.join('\\\\').replace(/\\\\+/g, '\\\\');
      }

      document.getElementById('dirDisplay').innerText = selectedOutputDir;

      const themes = {
        green: { bg: '#000000', panel: '#030303', border: '#003300', text: '#00ff00', active: '#00ffaa' },
        amber: { bg: '#050300', panel: '#0a0600', border: '#442200', text: '#ffb000', active: '#ffcc66' },
        cyan: { bg: '#020408', panel: '#050a14', border: '#004466', text: '#00e5ff', active: '#80f0ff' },
        pink: { bg: '#071A1C', panel: '#375B58', border: '#61827F', text: '#F8C5CD', active: '#FCEBE8' }
      };

      const colorKeys = {
        cBg: '--bg',
        cPanel: '--panel-bg',
        cBorder: '--border',
        cText: '--text',
        cActive: '--active-text'
      };

      function applyThemeColors(colors) {
        document.documentElement.style.setProperty('--bg', colors.bg);
        document.documentElement.style.setProperty('--panel-bg', colors.panel);
        document.documentElement.style.setProperty('--border', colors.border);
        document.documentElement.style.setProperty('--text', colors.text);
        document.documentElement.style.setProperty('--active-text', colors.active);

        document.getElementById('cBg').value = colors.bg;
        document.getElementById('cPanel').value = colors.panel;
        document.getElementById('cBorder').value = colors.border;
        document.getElementById('cText').value = colors.text;
        document.getElementById('cActive').value = colors.active;
      }

      const savedTheme = localStorage.getItem('vibemp3_theme') || 'green';
      document.getElementById('themeSelect').value = savedTheme;

      if (savedTheme === 'custom') {
        document.getElementById('customGrid').classList.add('visible');
        for (const [id, cssVar] of Object.entries(colorKeys)) {
          const savedVal = localStorage.getItem('vibemp3_' + id);
          if (savedVal) {
            document.documentElement.style.setProperty(cssVar, savedVal);
            document.getElementById(id).value = savedVal;
          }
        }
      } else {
        applyThemeColors(themes[savedTheme] || themes.green);
      }

      document.getElementById('themeSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        localStorage.setItem('vibemp3_theme', val);
        const customGrid = document.getElementById('customGrid');

        if (val === 'custom') {
          customGrid.classList.add('visible');
        } else {
          customGrid.classList.remove('visible');
          applyThemeColors(themes[val]);
        }
      });

      for (const [id, cssVar] of Object.entries(colorKeys)) {
        const el = document.getElementById(id);
        const updateEvent = (e) => {
          const val = e.target.value;
          document.documentElement.style.setProperty(cssVar, val);
          try {
            localStorage.setItem('vibemp3_' + id, val);
          } catch (err) {}
        };
        el.addEventListener('input', updateEvent);
        el.addEventListener('change', updateEvent);
      }

      let lastLoggedTrack = 0;

      function makeProgressBar(percent) {
        const width = 15;
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;
        return '[' + '#'.repeat(filled) + '-'.repeat(empty) + '] ' + percent + '%';
      }

      ipcRenderer.on('app:status', (event, text) => {
        document.getElementById('status').innerText = 'STATUS: ' + text.toUpperCase();
        if (text === 'Ready.') {
          logConsole('[SYSTEM] Decoders verified & ready.');
          document.getElementById('activeTask').innerText = '[STATUS] Idle. Ready to download.';
        }
      });

      ipcRenderer.on('download:progress', (event, data) => {
        const bar = makeProgressBar(data.trackPercent);
        document.getElementById('activeTask').innerText = 
          \`[\${data.currentTrack}/\${data.totalTracks}] \${bar} \${data.trackName}\`;

        if (data.trackPercent === 100 && data.currentTrack > lastLoggedTrack) {
          lastLoggedTrack = data.currentTrack;
          logConsole(\`[OK] (\${data.currentTrack}/\${data.totalTracks}) \${data.trackName}\`);
        }
      });

      ipcRenderer.on('download:complete', (event, data) => {
        logConsole('--- BATCH COMPLETE: ' + data.outputDir + ' ---');
        document.getElementById('activeTask').innerText = '[STATUS] Download complete!';
      });

      document.getElementById('browseBtn').addEventListener('click', async () => {
        const dir = await ipcRenderer.invoke('dialog:selectOutputDir');
        if (dir) {
          selectedOutputDir = dir;
          document.getElementById('dirDisplay').innerText = selectedOutputDir;
          logConsole('[DIR] Output updated -> ' + dir);
        }
      });

      document.getElementById('downloadBtn').addEventListener('click', () => {
        const url = document.getElementById('urlInput').value.trim();
        if (!url) return;
        lastLoggedTrack = 0;
        logConsole('[TASK] Starting -> ' + url);
        ipcRenderer.send('download:start', { url, outputDir: selectedOutputDir });
        document.getElementById('urlInput').value = '';
      });

      function logConsole(message) {
        const out = document.getElementById('output');
        out.innerText += '\\n' + message;
        out.scrollTop = out.scrollHeight;
      }
    </script>
  </body>
  </html>
  `;

  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  
  const UI_PATH = path.join(APP_DIR, 'ui.html');
  fs.writeFileSync(UI_PATH, textUiHtml);
  mainWindow.loadFile(UI_PATH);

  mainWindow.webContents.once('did-finish-load', () => {
    checkAndUpdateDecoders();
  });
}

function downloadFile(url, destPath, description) {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.tmp`;
    const file = fs.createWriteStream(tempPath);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close(() => {
          fs.unlink(tempPath, () => {});
          downloadFile(response.headers.location, destPath, description).then(resolve).catch(reject);
        });
        return;
      }

      if (response.statusCode !== 200) {
        file.close(() => {
          fs.unlink(tempPath, () => {});
          reject(new Error(`Failed ${description}: HTTP ${response.statusCode}`));
        });
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tempPath, destPath);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }).on('error', (err) => {
      file.close(() => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
    });
  });
}

async function checkAndUpdateDecoders() {
  try {
    if (!fs.existsSync(BIN_DIR)) {
      fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    if (!fs.existsSync(YT_DLP_PATH)) {
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', YT_DLP_PATH, 'yt-dlp.exe');
    }

    if (!fs.existsSync(FFMPEG_PATH)) {
      await new Promise((resolve, reject) => {
        ffbinaries.downloadBinaries(['ffmpeg'], {
          destination: BIN_DIR,
          platform: 'windows-64',
          quiet: true
        }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    mainWindow.webContents.send('app:status', 'Ready.');
  } catch (err) {
    console.error('Auto-update error:', err);
    mainWindow.webContents.send('app:status', 'Setup failed.');
  }
}

async function fetchSpotifyItems(inputUrlOrName) {
  if (!inputUrlOrName.includes('spotify.com')) return [inputUrlOrName];

  return Promise.race([
    new Promise((resolve) => {
      let embedUrl = inputUrlOrName;
      if (inputUrlOrName.includes('/playlist/')) {
        const id = inputUrlOrName.split('/playlist/')[1].split('?')[0];
        embedUrl = `https://open.spotify.com/embed/playlist/${id}`;
      } else if (inputUrlOrName.includes('/album/')) {
        const id = inputUrlOrName.split('/album/')[1].split('?')[0];
        embedUrl = `https://open.spotify.com/embed/album/${id}`;
      }

      https.get(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let html = '';
        res.on('data', chunk => html += chunk);
        res.on('end', () => {
          try {
            const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (match && match[1]) {
              const data = JSON.parse(match[1]);
              const entity = data.props?.pageProps?.state?.data?.entity;
              if (entity && entity.trackList && entity.trackList.length > 0) {
                return resolve(entity.trackList.map(t => `"${t.title} ${t.subtitle}" official audio`));
              }
            }
          } catch (e) {}
          resolve([inputUrlOrName]);
        });
      }).on('error', () => resolve([inputUrlOrName]));
    }),
    new Promise((resolve) => setTimeout(() => resolve([inputUrlOrName]), 3000))
  ]);
}

async function runYtDlp(targetArg, resolvedOutputDir, onProgress, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const outputTemplate = path.join(resolvedOutputDir, '%(title)s.%(ext)s');
        const args = [
          targetArg,
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '320k',
          '--add-metadata',
          '--embed-thumbnail',
          '--no-mtime',
          '--no-warnings',
          '--socket-timeout', '20',
          '--output', outputTemplate,
          '--ffmpeg-location', BIN_DIR,
          '--newline'
        ];

        const ytDlpProcess = spawn(YT_DLP_PATH, args, { windowsVerbatimArguments: false });

        let watchdog = setTimeout(() => {
          try { ytDlpProcess.kill('SIGTERM'); } catch (e) {}
          reject(new Error('Stalled'));
        }, 45000);

        ytDlpProcess.stdout.on('data', (data) => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            try { ytDlpProcess.kill('SIGTERM'); } catch (e) {}
            reject(new Error('Stalled'));
          }, 45000);

          const lines = data.toString().split(/\r?\n/);
          for (const line of lines) {
            const match = line.match(/(\d+(?:\.\d+)?)%/);
            if (match) onProgress(parseFloat(match[1]));
          }
        });

        ytDlpProcess.on('error', (err) => {
          clearTimeout(watchdog);
          reject(err);
        });

        ytDlpProcess.on('close', (code) => {
          clearTimeout(watchdog);
          if (code === 0) resolve();
          else reject(new Error(`Exit code ${code}`));
        });
      });
    } catch (err) {
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 1000));
        continue;
      }
      throw err;
    }
  }
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

ipcMain.handle('dialog:selectOutputDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return path.resolve(result.filePaths[0]);
});

ipcMain.on('download:start', async (event, { url, outputDir }) => {
  if (!url || !outputDir) return;

  const resolvedOutputDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  event.sender.send('app:status', 'parsing...');

  const trimmedInput = url.trim();
  const isUrl = trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://');

  let itemsToDownload = [];
  if (trimmedInput.includes('spotify.com')) {
    itemsToDownload = await fetchSpotifyItems(trimmedInput);
  } else if (!isUrl) {
    itemsToDownload = [`"${trimmedInput}" official audio`];
  } else {
    itemsToDownload = [trimmedInput];
  }

  const total = itemsToDownload.length;
  event.sender.send('app:status', `downloading (${total} tracks)...`);

  for (let i = 0; i < total; i++) {
    const item = itemsToDownload[i];
    const cleanName = item.replace(/ official audio"?$/i, '').replace(/^°"/, '').replace(/^°/, '').replace(/^°/, '').replace(/^"/, '').replace(/"$/, '');
    const targetArg = item.startsWith('http') && !item.includes('spotify.com') ? item : `ytsearch1:${item}`;

    const updateProgress = (trackPercent = 0) => {
      event.sender.send('download:progress', {
        currentTrack: i + 1,
        totalTracks: total,
        trackName: cleanName,
        trackPercent: Math.round(trackPercent),
        overallPercent: Math.min(Math.round(((i + (trackPercent / 100)) / total) * 100), 100)
      });
    };

    updateProgress(0);

    try {
      await runYtDlp(targetArg, resolvedOutputDir, (pct) => updateProgress(pct));
      updateProgress(100);
    } catch (err) {
      console.error(`Skipped track ${i + 1} (${cleanName})`);
    }
  }

  event.sender.send('download:complete', { outputDir: resolvedOutputDir });
  event.sender.send('app:status', 'Ready.');
});