param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference='Stop'
$files = & git -C $Root ls-files '*.ps1'
foreach($name in $files) {
  $path=Join-Path $Root $name
  $source=[IO.File]::ReadAllText($path)
  $tokens=$null; $errors=$null
  [void][Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
  if($errors.Count){Write-Output "Skipped invalid existing script: $name";continue}
  $updated=$source
  $comments=@($tokens | Where-Object {$_.Kind -eq 'Comment' -and $_.Text -notmatch '(?i)^#!|#requires|copyright|license|SPDX|PSScriptAnalyzer'})
  foreach($token in ($comments | Sort-Object {$_.Extent.StartOffset} -Descending)) {
    $start=$token.Extent.StartOffset; $end=$token.Extent.EndOffset
    $updated=$updated.Substring(0,$start)+([regex]::Replace($updated.Substring($start,$end-$start),'[^\r\n]',' '))+$updated.Substring($end)
  }
  $newTokens=$null; $newErrors=$null
  [void][Management.Automation.Language.Parser]::ParseInput($updated,[ref]$newTokens,[ref]$newErrors)
  $before=@($tokens | Where-Object {$_.Kind -ne 'Comment'} | ForEach-Object {"$($_.Kind):$($_.Text)"})
  $after=@($newTokens | Where-Object {$_.Kind -ne 'Comment'} | ForEach-Object {"$($_.Kind):$($_.Text)"})
  if($newErrors.Count -or (Compare-Object $before $after)){throw "PowerShell tokens changed: $name"}
  if($comments.Count){[IO.File]::WriteAllText($path,$updated,[Text.UTF8Encoding]::new($false));Write-Output "$name : $($comments.Count) comments removed"}
}
