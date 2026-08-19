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

// Parse raw binary body for application/octet-stream
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port,'0.0.0.0', () => {
  console.log(`PDF Conversion Service listening on port ${port}`);
});
