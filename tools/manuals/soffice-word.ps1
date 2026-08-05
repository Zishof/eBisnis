$ErrorActionPreference = 'Stop'
$outputDirectory = $null
$inputPath = $null
for ($index = 0; $index -lt $args.Count; $index++) {
    if ($args[$index] -eq '--outdir' -and $index + 1 -lt $args.Count) {
        $outputDirectory = $args[$index + 1]
        $index++
        continue
    }
    if ($args[$index] -match '\.(docx|doc|odt)$') {
        $inputPath = $args[$index]
    }
}
if (-not $outputDirectory -or -not $inputPath) {
    throw 'Argumen --outdir dan dokumen sumber wajib tersedia.'
}
$inputPath = (Resolve-Path -LiteralPath $inputPath).Path
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$pdfPath = Join-Path $outputDirectory (([System.IO.Path]::GetFileNameWithoutExtension($inputPath)) + '.pdf')
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $document = $word.Documents.Open($inputPath, $false, $true)
    try {
        $document.ExportAsFixedFormat($pdfPath, 17)
    }
    finally {
        $document.Close($false)
    }
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
Write-Output "convert $inputPath -> $pdfPath"
