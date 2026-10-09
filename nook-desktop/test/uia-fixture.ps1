Add-Type -AssemblyName PresentationFramework
$form = New-Object System.Windows.Window
$form.Title = 'Nook UI Automation Test'
$form.Width = 500
$form.Height = 240
$panel = New-Object System.Windows.Controls.StackPanel
$panel.Margin = 25
$field = New-Object System.Windows.Controls.TextBox
[System.Windows.Automation.AutomationProperties]::SetName($field,'Nook test field')
$field.Text = 'before'
$field.Height = 35
$button = New-Object System.Windows.Controls.Button
[System.Windows.Automation.AutomationProperties]::SetName($button,'Nook test action')
$button.Content = 'Test action'
$button.Height = 35
$button.Add_Click({$field.Text='invoked'})
$panel.Children.Add($field) | Out-Null
$panel.Children.Add($button) | Out-Null
$form.Content = $panel
$form.ShowDialog() | Out-Null
