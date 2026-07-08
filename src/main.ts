import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { readFile, writeFile, unlink } from 'node:fs/promises';

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const requi = createRequire(import.meta.url);

// 1. Get the standard Windows file system string path
const absoluteWorkerPath = requi.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

// 2. Convert the "C:\..." path into a valid "file:///C:/..." URL format
const workerUrl = pathToFileURL(absoluteWorkerPath).href;

// 3. Assign the valid URL to the PDF worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

import { pdf as pdfToImg } from 'pdf-to-img';
import { tmpdir } from 'node:os';
import { createWorker } from 'tesseract.js';

import sharp from 'sharp';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = (routePath: string, width: number, height: number) => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.removeMenu();

 if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${routePath}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      hash: routePath,
    });
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

ipcMain.on('open-new-window', (_event, routePath: string, width: number, height: number) => {
  createWindow(routePath, width, height);
});

ipcMain.on('close-current-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

ipcMain.handle('upload-docs', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf'] }
    ]
  })
  
  if (!canceled) {
    return filePaths // Returns array of absolute string paths to Vue
  }
})

async function getPageCount(dataBuffer: Buffer): Promise<number> {
  const pdfDoc = await pdfToImg(dataBuffer, { scale: 1 });
  let count = 0;
  for await (const _page of pdfDoc) {
    count++;
  }
  return count;
}

async function ocrPdf(dataBuffer: Buffer, maxPages = 10) {
  try {
    console.log(`OCR: Starting for ${maxPages} pages`);

    // Note: Fixed a minor typo in your code snippet (requi -> require)
    const tesseractWorkerPath = require.resolve('tesseract.js/src/worker-script/node/index.js');
    
    const worker = await createWorker('eng', 1, {
      workerPath: tesseractWorkerPath,
      workerBlobURL: false,
      logger: m => {
        if (m.status === 'recognizing text') console.log(`OCR: ${Math.round(m.progress * 100)}%`);
      }
    });
    
    // Core Configuration Adjustments: Set layout parameters
    await worker.setParameters({
      tessedit_pageseg_mode: 3 as unknown as any, // 3 = Fully automatic page segmentation (Default)
      // If parsing numbers/receipts only, uncomment the line below:
      // tessedit_char_whitelist: '0123456789.,$', 
    });
    
    console.log('OCR: Worker created, initialized, and configured');
    
    let fullText = '';
    let pageCount = 0;
    
    // CRITICAL FIX: Boost scale to 3.0 or 4.0 to hit an optimal ~300 DPI target density
    const pdfDoc = await pdfToImg(dataBuffer, { scale: 3.0 }); 
    console.log(`OCR: PDF loaded with high-density scale, iterating pages...`);
    
    for await (const page of pdfDoc) {
      if (pageCount >= maxPages) break;
      
      const tempPath = path.join(tmpdir(), `ocr-page-${Date.now()}-${pageCount}.png`);
      try {
        // IMAGE PREPROCESSING PIPELINE USING SHARP
        // 1. Grayscale conversion drops color channel artifacts
        // 2. Sharpen enhances character edges
        // 3. Threshold (Binarization) forces pixels to pure black or pure white
        const processedPageBuffer = await sharp(page)
          .grayscale()
          .sharpen()
          .threshold(180) // Adjust between 150-200 depending on background darkness
          .toBuffer();

        await writeFile(tempPath, processedPageBuffer);
        
        const result = await worker.recognize(tempPath);
        const text = result.data.text || '';
        console.log(`OCR: Page ${pageCount + 1} - recognized ${text.length} chars`);
        
        fullText += `\n--- Page ${pageCount + 1} ---\n${text}`;
      } catch (pageError: any) {
        const msg = pageError instanceof Error ? pageError.message : String(pageError);
        console.error(`OCR: Page ${pageCount + 1} error:`, msg);
        fullText += `\n--- Page ${pageCount + 1} ---\n[Error: ${msg}]`;
      } finally {
        try { await unlink(tempPath); } catch {}
      }
      
      pageCount++;
    }
    
    await worker.terminate();
    const result = fullText.trim();
    console.log(`OCR complete: ${pageCount} pages, ${result.length} total chars`);
    return result.length > 50 ? result : null;
  } catch (error) {
    console.error('OCR failed:', error);
    return null;
  }
}

ipcMain.on('create-session', async (event, filePaths) => {
  const results = [];
  console.log('test')
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const fileName = path.basename(filePath);
    
    try {
      const dataBuffer = await readFile(filePath);
      const numPages = await getPageCount(dataBuffer);

      const finalText = await ocrPdf(dataBuffer, numPages);
      
      results.push({
        fileName,
        pageCount: numPages,
        text: finalText
      });
      
      event.sender.send('document-processed', {
        current: i + 1,
        total: filePaths.length,
        fileName,
        pageCount: numPages
      });
    } catch (error) {
      console.error('Error processing PDF:', error);
      results.push({
        fileName,
        pageCount: 0,
        text: `Error reading document: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  const sessionID = crypto.randomUUID();

  const dataString = JSON.stringify({
    id: sessionID,
    data: results
  });

  const saveDirectory = app.getPath('userData');
  const filePath = path.join(saveDirectory, 'sessions', `${sessionID}`);
  // TODO: implement existing sessions view and chatbot view
    
  await writeFile(filePath, dataString, 'utf8');

  BrowserWindow.fromWebContents(event.sender)?.close();
  
  return results;
});


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow('/', 800, 600);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow('/', 800, 600);
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
