param([Parameter(Mandatory=$true)][string]$Request)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Request)) | ConvertFrom-Json
$targetProcess = Get-Process -Id ([int]$data.pid) -ErrorAction Stop
if ($targetProcess.ProcessName -match '^(consent|winlogon|LogonUI|lsass|CredentialUIBroker)$') { throw 'Protected system interfaces cannot be automated.' }
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$data.pid)
$roots = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
$items = New-Object 'System.Collections.Generic.List[object]'
$elements = New-Object 'System.Collections.Generic.List[System.Windows.Automation.AutomationElement]'
function Visit-Control($element, $depth) {
  if ($depth -gt 12 -or $elements.Count -ge 350) { return }
  try {
    if ($element.Current.IsPassword) { return }
    $elements.Add($element)
    $id = ($element.GetRuntimeId() -join '.')
    $value = $null
    $valuePattern = $null
    if ($element.Current.Name -notmatch '(?i)password|passcode|security code|credit card' -and $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$valuePattern)) { $value = $valuePattern.Current.Value }
    $items.Add([pscustomobject]@{id=$id;name=$element.Current.Name;type=$element.Current.ControlType.ProgrammaticName;enabled=$element.Current.IsEnabled;offscreen=$element.Current.IsOffscreen;pid=$element.Current.ProcessId;value=$value})
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $child = $walker.GetFirstChild($element)
    while ($null -ne $child -and $elements.Count -lt 350) { Visit-Control $child ($depth+1); $child = $walker.GetNextSibling($child) }
  } catch {}
}
foreach ($root in $roots) { Visit-Control $root 0 }
if ($data.action -eq 'inspect') { ConvertTo-Json -InputObject @($items.ToArray()) -Depth 5 -Compress; exit 0 }
$selected = $null
foreach ($element in $elements) { if (($element.GetRuntimeId() -join '.') -eq [string]$data.id) { $selected=$element; break } }
if ($null -eq $selected) { throw 'Control no longer exists. Inspect the application again.' }
if ($selected.Current.IsPassword -or -not $selected.Current.IsEnabled -or $selected.Current.ProcessId -ne [int]$data.pid) { throw 'This control is unavailable.' }
if ($data.action -eq 'invoke') {
  $pattern = $selected.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $pattern.Invoke()
} elseif ($data.action -eq 'setValue') {
  if ([string]$selected.Current.Name -match '(?i)password|passcode|security code|credit card') { throw 'Sensitive fields require manual input.' }
  $pattern = $selected.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  if ($pattern.Current.IsReadOnly) { throw 'Control is read only.' }
  $pattern.SetValue([string]$data.value)
} else { throw 'Unknown automation action.' }
'{"dispatched":true,"verified":false,"note":"Inspect the application to verify the outcome."}'
