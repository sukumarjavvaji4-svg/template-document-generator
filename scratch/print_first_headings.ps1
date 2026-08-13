param (
    [string]$DocPath
)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($DocPath, $false, $true)

    Write-Host "=================================================="
    Write-Host "FIRST 30 NUMBERED ITEMS IN: $DocPath"
    Write-Host "=================================================="

    $count = 0
    foreach ($p in $doc.Paragraphs) {
        $text = $p.Range.Text.Trim()
        if ($text.Length -gt 0) {
            $listType = $p.Range.ListFormat.ListType
            $listString = $p.Range.ListFormat.ListString
            $listValue = $p.Range.ListFormat.ListValue

            if ($listType -ne 0) { # 0 = wdListNoNumbering
                $count++
                if ($count -le 35) {
                    Write-Host "[$count] TEXT: '$text'"
                    Write-Host "    ListType: $listType | ListString: '$listString' | ListValue: $listValue"
                }
            }
        }
    }

    $doc.Close(0)
} catch {
    Write-Host "WORD_OPEN_ERROR: $_"
} finally {
    if ($word) { $word.Quit() }
}
