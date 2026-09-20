import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function pdfConverterPlugin(): Plugin {
  return {
    name: 'pdf-converter-plugin',
    configureServer(server) {
      server.middlewares.use('/api/convert-pdf', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

        req.on('end', async () => {
          const docxBuffer = Buffer.concat(chunks);
          if (docxBuffer.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Empty DOCX payload' }));
            return;
          }

          const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const tmpDir = os.tmpdir();
          const tempDocxPath = path.join(tmpDir, `doc_${uniqueId}.docx`);
          const tempPdfPath = path.join(tmpDir, `doc_${uniqueId}.pdf`);
          const scriptPath = path.join(import.meta.dirname || path.resolve('.'), 'convert_pdf.ps1');

          try {
            // Write incoming Final.docx binary blob to temp file
            fs.writeFileSync(tempDocxPath, docxBuffer);

            let conversionSuccess = false;

            // Strategy 1: Try LibreOffice in headless mode if installed
            const libreOfficePaths = [
              'soffice',
              'libreoffice',
              'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
              'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            ];

            for (const loPath of libreOfficePaths) {
              try {
                await execFileAsync(loPath, [
                  '--headless',
                  '--convert-to', 'pdf',
                  '--outdir', tmpDir,
                  tempDocxPath,
                ], { timeout: 30000 });

                if (fs.existsSync(tempPdfPath)) {
                  const normScript = path.join(import.meta.dirname || path.resolve('.'), 'normalize_borders.py');
                  if (fs.existsSync(normScript)) {
                    try {
                      await execFileAsync('python', [normScript, tempPdfPath], { timeout: 10000 });
                    } catch {}
                  }
                  conversionSuccess = true;
                  break;
                }
              } catch {
                // Continue to next path / fallback
              }
            }

            // Strategy 2: Fallback to native Microsoft Word COM automation via PowerShell if on Windows
            if (!conversionSuccess && fs.existsSync(scriptPath)) {
              try {
                await execFileAsync('powershell', [
                  '-ExecutionPolicy', 'Bypass',
                  '-File', scriptPath,
                  '-DocxPath', tempDocxPath,
                  '-PdfPath', tempPdfPath,
                ], { timeout: 30000 });

                if (fs.existsSync(tempPdfPath)) {
                  conversionSuccess = true;
                }
              } catch (err: any) {
                console.error('Word COM PDF Conversion Error:', err?.message || err);
              }
            }

            if (conversionSuccess && fs.existsSync(tempPdfPath)) {
              const pdfBuffer = fs.readFileSync(tempPdfPath);
              const header = pdfBuffer.subarray(0, 5).toString('ascii');

              // Validate PDF signature (%PDF-) and non-zero size
              if (pdfBuffer.length > 0 && header === '%PDF-') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.end(pdfBuffer);
                return;
              }
            }

            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'PDF conversion failed. Your Word document was generated successfully, but PDF conversion is currently unavailable.'
            }));
          } catch (err: any) {
            console.error('Vite PDF Conversion Endpoint Error:', err);
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'PDF conversion failed. Your Word document was generated successfully, but PDF conversion is currently unavailable.'
            }));
          } finally {
            // Clean up temporary files
            try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch {}
            try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
          }
        });
      });

      server.middlewares.use('/api/convert-docx', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

        req.on('end', async () => {
          const pdfBuffer = Buffer.concat(chunks);
          if (pdfBuffer.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Empty PDF payload' }));
            return;
          }

          const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const tmpDir = os.tmpdir();
          const tempPdfPath = path.join(tmpDir, `input_${uniqueId}.pdf`);
          const tempDocxPath = path.join(tmpDir, `output_${uniqueId}.docx`);
          const scriptPath = path.join(import.meta.dirname || path.resolve('.'), 'convert_docx.ps1');

          try {
            fs.writeFileSync(tempPdfPath, pdfBuffer);

            let conversionSuccess = false;

            // Strategy 1: Try LibreOffice with writer_pdf_import if available
            const libreOfficePaths = [
              'soffice',
              'libreoffice',
              'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
              'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            ];

            for (const loPath of libreOfficePaths) {
              try {
                await execFileAsync(loPath, [
                  '--headless',
                  '--infilter=writer_pdf_import',
                  '--convert-to', 'docx',
                  '--outdir', tmpDir,
                  tempPdfPath,
                ], { timeout: 30000 });

                if (fs.existsSync(tempDocxPath)) {
                  conversionSuccess = true;
                  break;
                }
              } catch {}
            }

            // Strategy 2: Word COM automation on Windows
            if (!conversionSuccess && fs.existsSync(scriptPath)) {
              try {
                await execFileAsync('powershell', [
                  '-ExecutionPolicy', 'Bypass',
                  '-File', scriptPath,
                  '-PdfPath', tempPdfPath,
                  '-DocxPath', tempDocxPath,
                ], { timeout: 45000 });

                if (fs.existsSync(tempDocxPath)) {
                  conversionSuccess = true;
                }
              } catch (err: any) {
                console.error('Word COM PDF->DOCX Error:', err?.message || err);
              }
            }

            if (conversionSuccess && fs.existsSync(tempDocxPath)) {
              const docxBuffer = fs.readFileSync(tempDocxPath);
              if (docxBuffer.length > 0 && docxBuffer.subarray(0, 2).toString('ascii') === 'PK') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Length', docxBuffer.length);
                res.end(docxBuffer);
                return;
              }
            }

            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'PDF to DOCX conversion failed on local server.' }));
          } catch (err: any) {
            console.error('Vite PDF->DOCX Endpoint Error:', err);
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'PDF to DOCX conversion failed on local server.' }));
          } finally {
            try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
            try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch {}
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/scratch/**', '**/*.tmp', '**/tmp/**', '**/*.docx', '**/*.pdf'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    pdfConverterPlugin(),
  ],
});
