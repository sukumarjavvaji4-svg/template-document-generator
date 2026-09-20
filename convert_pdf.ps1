param (
    [string]$DocxPath,
    [string]$PdfPath
)

$ErrorActionPreference = "Stop"
$DocxPath = [System.IO.Path]::GetFullPath($DocxPath)
$PdfPath = [System.IO.Path]::GetFullPath($PdfPath)
$word = $null
$doc = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $doc = $word.Documents.Open($DocxPath, $false, $true)
    $doc.SaveAs([ref]$PdfPath, [ref]17)
    $doc.Close([ref]0)
    $word.Quit()

    if (Test-Path $PdfPath) {
        Write-Host "PDF_CONVERT_SUCCESS"
    } else {
        Write-Host "PDF_CONVERT_FAILED"
        exit 1
    }
} catch {
    Write-Host "PDF_CONVERT_ERROR: $_"
    if ($doc) { try { $doc.Close([ref]0) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    exit 1
}
