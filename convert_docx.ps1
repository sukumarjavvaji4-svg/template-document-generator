param (
    [string]$PdfPath,
    [string]$DocxPath
)

$ErrorActionPreference = "Stop"
$PdfPath = [System.IO.Path]::GetFullPath($PdfPath)
$DocxPath = [System.IO.Path]::GetFullPath($DocxPath)

# Suppress Microsoft Word interactive PDF conversion prompt dialog
New-Item -Path 'HKCU:\Software\Microsoft\Office\16.0\Word\Options' -Force -ErrorAction SilentlyContinue | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Office\16.0\Word\Options' -Name 'ShowPDFConversionWarning' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue

$word = $null
$doc = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.Options.ConfirmConversions = $false

    # Open PDF without interactive conversion confirmation
    $doc = $word.Documents.Open($PdfPath, $false, $true, $false)
    $doc.SaveAs([ref]$DocxPath, [ref]16)
    $doc.Close([ref]0)
    $word.Quit()

    if (Test-Path $DocxPath) {
        Write-Host "DOCX_CONVERT_SUCCESS"
    } else {
        Write-Host "DOCX_CONVERT_FAILED"
        exit 1
    }
} catch {
    Write-Host "DOCX_CONVERT_ERROR: $_"
    if ($doc) { try { $doc.Close([ref]0) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    exit 1
}
