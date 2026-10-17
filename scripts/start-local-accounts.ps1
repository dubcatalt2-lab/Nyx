$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot ".nyx-local.json"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Missing .nyx-local.json. Create the private local account configuration before starting Nyx."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$serviceAccountPath = [Environment]::ExpandEnvironmentVariables(
  [string]$config.serviceAccountPath
)

if (-not $serviceAccountPath -or -not (Test-Path -LiteralPath $serviceAccountPath)) {
  throw "The Firebase service-account file configured in .nyx-local.json was not found."
}

$firebase = Get-Content -LiteralPath $serviceAccountPath -Raw | ConvertFrom-Json
$requiredValues = @{
  FIREBASE_PROJECT_ID = [string]$firebase.project_id
  FIREBASE_CLIENT_EMAIL = [string]$firebase.client_email
  FIREBASE_PRIVATE_KEY = [string]$firebase.private_key
  FIREBASE_WEB_API_KEY = [string]$config.firebaseWebApiKey
  NYX_FOUNDER_PROFILE_ADMIN_UID = [string]$config.ownerUid
}

foreach ($entry in $requiredValues.GetEnumerator()) {
  if ([string]::IsNullOrWhiteSpace($entry.Value)) {
    throw "The local account configuration is missing $($entry.Key)."
  }
  Set-Item -LiteralPath "Env:$($entry.Key)" -Value $entry.Value
}


if (-not [string]::IsNullOrWhiteSpace([string]$config.tmdbToken)) {
  $env:TMDB_TOKEN = [string]$config.tmdbToken
}

                                                                            
                                                                                  
if ([string]::IsNullOrWhiteSpace($env:NYXCLOUD_COORDINATOR_ORIGIN) -and
    -not [string]::IsNullOrWhiteSpace([string]$config.desktopCoordinatorOrigin)) {
  $env:NYXCLOUD_COORDINATOR_ORIGIN = [string]$config.desktopCoordinatorOrigin
}
if (-not [string]::IsNullOrWhiteSpace($env:NYXCLOUD_COORDINATOR_ORIGIN)) {
  $coordinatorUri = $null
  if (-not [Uri]::TryCreate($env:NYXCLOUD_COORDINATOR_ORIGIN, [UriKind]::Absolute, [ref]$coordinatorUri) -or
      $coordinatorUri.Scheme -ne 'https' -or $coordinatorUri.UserInfo -or
      $coordinatorUri.AbsolutePath -ne '/' -or $coordinatorUri.Query -or $coordinatorUri.Fragment) {
    throw 'Desktop coordinator must be an HTTPS origin without credentials, path, query, or fragment.'
  }
  $env:NYXCLOUD_COORDINATOR_ORIGIN = $coordinatorUri.GetLeftPart([UriPartial]::Authority)
  Write-Host 'Shared desktop backend configured.' -ForegroundColor Green
}

                                                                          
                                                              
if ([string]::IsNullOrWhiteSpace($env:NYX_YOUTUBE_NATIVE_ENABLED)) {
  $extractorCommand = if ($env:NYX_YTDLP_BIN) { $env:NYX_YTDLP_BIN } else { 'yt-dlp' }
  $encoderCommand = if ($env:NYX_FFMPEG_BIN) { $env:NYX_FFMPEG_BIN } else { 'ffmpeg' }
  $videoExtractor = Get-Command $extractorCommand -CommandType Application -ErrorAction SilentlyContinue
  $videoEncoder = Get-Command $encoderCommand -CommandType Application -ErrorAction SilentlyContinue
  if ($videoExtractor -and $videoEncoder) {
    $env:NYX_YTDLP_BIN = $videoExtractor.Source
    $env:NYX_FFMPEG_BIN = $videoEncoder.Source
    $env:NYX_YOUTUBE_NATIVE_ENABLED = '1'
    Write-Host 'Local video playback tools found and enabled.' -ForegroundColor Green
  }
}

Set-Location -LiteralPath $projectRoot
Write-Host "Firebase accounts loaded for local Nyx." -ForegroundColor Green
& npm run dev
exit $LASTEXITCODE
