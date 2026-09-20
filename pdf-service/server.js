const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const cors = require('cors');

const execFileAsync = promisify(execFile);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Parse raw binary body for any binary content type (application/octet-stream, application/pdf, docx, etc.)
app.use(express.raw({ type: '*/*', limit: '50mb' }));

app.post('/api/convert-pdf', async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Empty or invalid DOCX payload' });
  }

  const uniqueId = crypto.randomBytes(8).toString('hex');
  const tmpDir = os.tmpdir();
  const tempDocxPath = path.join(tmpDir, `doc_${uniqueId}.docx`);
  const tempPdfPath = path.join(tmpDir, `doc_${uniqueId}.pdf`);

  try {
    // Write incoming DOCX to temp file
    fs.writeFileSync(tempDocxPath, req.body);

    // Run LibreOffice in headless mode
    // libreoffice --headless --convert-to pdf --outdir <dir> <file>
    await execFileAsync('libreoffice', [
      '--headless',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to', 'pdf',
      '--outdir', tmpDir,
      tempDocxPath
    ], { timeout: 30000 });

    if (fs.existsSync(tempPdfPath)) {
      // Normalize page borders so they sit BELOW header (matching Microsoft Word 100%)
      const normalizeScript = path.join(__dirname, 'normalize_borders.py');
      if (fs.existsSync(normalizeScript)) {
        try {
          await execFileAsync('python3', [normalizeScript, tempPdfPath], { timeout: 10000 });
        } catch (normErr) {
          console.warn('Border normalization note:', normErr?.message || normErr);
        }
      }

      const pdfBuffer = fs.readFileSync(tempPdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).send(pdfBuffer);
    } else {
      throw new Error("LibreOffice completed but PDF was not generated");
    }
  } catch (error) {
    console.error('PDF Conversion Error:', error);
    res.status(503).json({ error: 'PDF conversion failed. Your Word document was generated successfully, but PDF conversion is currently unavailable.' });
  } finally {
    // Clean up temporary files
    try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch (e) {}
    try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}
  }
});

app.post('/api/convert-docx', async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Empty or invalid PDF payload' });
  }

  const uniqueId = crypto.randomBytes(8).toString('hex');
  const tmpDir = os.tmpdir();
  const tempPdfPath = path.join(tmpDir, `pdf_${uniqueId}.pdf`);
  const tempDocxPath = path.join(tmpDir, `pdf_${uniqueId}.docx`);

  try {
    fs.writeFileSync(tempPdfPath, req.body);

    // Run LibreOffice with writer_pdf_import filter to convert PDF to DOCX
    await execFileAsync('libreoffice', [
      '--headless',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      '--infilter=writer_pdf_import',
      '--convert-to', 'docx',
      '--outdir', tmpDir,
      tempPdfPath
    ], { timeout: 45000 });

    if (fs.existsSync(tempDocxPath)) {
      const docxBuffer = fs.readFileSync(tempDocxPath);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Length', docxBuffer.length);
      return res.status(200).send(docxBuffer);
    } else {
      throw new Error("LibreOffice completed but DOCX was not generated");
    }
  } catch (error) {
    console.error('PDF to DOCX Conversion Error:', error);
    res.status(503).json({ error: 'PDF to DOCX conversion failed.' });
  } finally {
    try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}
    try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch (e) {}
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port,'0.0.0.0', () => {
  console.log(`PDF Conversion Service listening on port ${port}`);
});
