Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System

$sampleRate = 44100
$bytesPerSample = 2
$pcm = [System.Collections.Generic.List[byte]]::new()

function Add-DrumHit {
  param(
    [Parameter(Mandatory = $true)][double]$Frequency,
    [Parameter(Mandatory = $true)][double]$DurationSeconds
  )

  $sampleCount = [int]($sampleRate * $DurationSeconds)
  $phase = 0.0
  for ($index = 0; $index -lt $sampleCount; $index += 1) {
    $progress = $index / [double]$sampleCount
    $pitch = $Frequency * (1.08 - (0.20 * $progress))
    $phase += 2.0 * [Math]::PI * $pitch / $sampleRate
    $bodyEnvelope = [Math]::Exp(-5.2 * $progress)
    $attackEnvelope = [Math]::Exp(-45.0 * $progress)
    $body = [Math]::Sin($phase) + (0.35 * [Math]::Sin($phase * 0.52)) + (0.18 * [Math]::Sin($phase * 1.97))
    $attack = [Math]::Sin($phase * 4.1) * $attackEnvelope
    $value = (0.70 * $body * $bodyEnvelope) + (0.24 * $attack)
    $value = [Math]::Max(-0.98, [Math]::Min(0.98, $value))
    $sample = [int16][Math]::Round($value * 32767.0)
    $pcm.Add([byte]($sample -band 0xff))
    $pcm.Add([byte](($sample -shr 8) -band 0xff))
  }
}

function Add-Silence {
  param([Parameter(Mandatory = $true)][double]$DurationSeconds)
  $byteCount = [int]($sampleRate * $DurationSeconds * $bytesPerSample)
  for ($index = 0; $index -lt $byteCount; $index += 1) {
    $pcm.Add([byte]0)
  }
}

Add-DrumHit -Frequency 430 -DurationSeconds 0.30
Add-Silence -DurationSeconds 0.07
Add-DrumHit -Frequency 380 -DurationSeconds 0.40

$stream = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($stream, [System.Text.Encoding]::UTF8, $true)
try {
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $writer.Write([int](36 + $pcm.Count))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $writer.Write([int]16)
  $writer.Write([int16]1)
  $writer.Write([int16]1)
  $writer.Write([int]$sampleRate)
  $writer.Write([int]($sampleRate * $bytesPerSample))
  $writer.Write([int16]$bytesPerSample)
  $writer.Write([int16]16)
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $writer.Write([int]$pcm.Count)
  $writer.Write($pcm.ToArray())
  $writer.Flush()
  $stream.Position = 0

  $player = [System.Media.SoundPlayer]::new($stream)
  try {
    $player.PlaySync()
  } finally {
    $player.Dispose()
  }
} finally {
  $writer.Dispose()
  $stream.Dispose()
}
