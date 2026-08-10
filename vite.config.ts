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
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

        req.on('end', async () => {
          const docxBuffer = Buffer.concat(chunks);
          if (docxBuffer.length === 0) {
            res.statusCode = 400;
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

            // Invoke native Microsoft Word automation COM renderer via PowerShell
            await execFileAsync('powershell', [
              '-ExecutionPolicy', 'Bypass',
              '-File', scriptPath,
              '-DocxPath', tempDocxPath,
              '-PdfPath', tempPdfPath,
            ], { timeout: 30000 });

            if (fs.existsSync(tempPdfPath)) {
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

            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'PDF conversion produced invalid PDF output' }));
          } catch (err: any) {
            console.error('Vite PDF Conversion Endpoint Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'PDF conversion error' }));
          } finally {
            // Clean up temporary files
            try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch {}
            try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pdfConverterPlugin(),
  ],
});
