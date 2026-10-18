param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$ResultPath)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'uninstalled-path.ps1')
# The CI parent is PowerShell 7. Its inherited module search path can select
# incompatible modules in Windows PowerShell 5.1; load this engine's modules.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\CimCmdlets\CimCmdlets.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TerminalTestWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd,IntPtr after,int x,int y,int width,int height,uint flags);
}
'@
function Wait-Condition([scriptblock]$Condition,[string]$Name,[int]$Seconds=30) {
 $deadline=[DateTime]::UtcNow.AddSeconds($Seconds)
 do {
  $value=& $Condition
  if($value){return $value}
  [Threading.Thread]::Sleep(100)
 } while([DateTime]::UtcNow -lt $deadline)
 throw "Installed-app condition timed out: $Name"
}
function Window-Text {
 $elements=$script:window.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
 $names=foreach($element in $elements){try{$element.Current.Name}catch{}}
 return $names -join "`n"
}
function Send-Terminal([string]$Text) {
 $field=$script:window.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Terminal input')))
 if(!$field){throw 'Installed terminal input was not accessible'}
 [void][TerminalTestWindow]::SetForegroundWindow($script:process.MainWindowHandle)
 $field.SetFocus()
 if([TerminalTestWindow]::GetForegroundWindow() -ne $script:process.MainWindowHandle){throw 'Installed window does not own keyboard focus'}
 $keys=foreach($character in $Text.ToCharArray()) {
  if('+^%~()'.Contains([string]$character)){'{'+$character+'}'}
  elseif($character -eq '{'){'{{}'}elseif($character -eq '}'){'{}}'}else{[string]$character}
 }
 [Windows.Forms.SendKeys]::SendWait(($keys -join '')+'{ENTER}')
}
$installPath=Join-Path $Root ('App with spaces '+[char]0x4e16+[char]0x754c)
$testProfile=Join-Path $Root 'isolated-profile'
$exe=Join-Path $installPath 'TerminalOne.exe'
$process=$null
$retained=New-Object System.Collections.Generic.List[System.Diagnostics.Process]
try {
 # NSIS requires /D last and unquoted, even when the path includes spaces.
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName=$Installer
 $start.Arguments='/S /D='+$installPath
 $start.UseShellExecute=$false
 $installerProcess=[Diagnostics.Process]::Start($start)
 if(!$installerProcess.WaitForExit(60000) -or $installerProcess.ExitCode -ne 0){throw 'Unsigned installer failed'}
 [void](Wait-Condition {Test-Path -LiteralPath $exe} 'installed executable')
 $signature=Get-AuthenticodeSignature -LiteralPath $exe
 if($signature.Status -ne 'NotSigned'){throw 'Unsigned test artifact has an unexpected Authenticode status'}
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName=$exe
 $start.Arguments='--force-renderer-accessibility --user-data-dir="'+$testProfile+'"'
 $start.UseShellExecute=$false
 $start.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
 $start.EnvironmentVariables.Remove('NODE_OPTIONS')
 $startup=[Diagnostics.Stopwatch]::StartNew()
 $process=[Diagnostics.Process]::Start($start)
 [void](Wait-Condition {$process.Refresh();if($process.HasExited){throw 'Installed app exited before opening'};$process.MainWindowHandle -ne [IntPtr]::Zero} 'installed window')
 $window=[Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
 [void](Wait-Condition {(Window-Text) -match '(?m)^running$'} 'real shell startup')
 $startup.Stop()
 Send-Terminal "Write-Output ('INSTALL_' + 'OK'); Write-Output ('UNICODE_' + [char]0x4e16 + [char]0x754c)"
 [void](Wait-Condition {(Window-Text).Contains('INSTALL_OK')} 'real command output')
 [void](Wait-Condition {(Window-Text).Contains(('UNICODE_'+[char]0x4e16+[char]0x754c))} 'Unicode output')
 [void][TerminalTestWindow]::SetWindowPos($process.MainWindowHandle,[IntPtr]::Zero,0,0,800,600,4)
 Send-Terminal "Clear-Host; Write-Output ('BUSY_' + 'READY'); Start-Sleep -Seconds 90"
 [void](Wait-Condition {(Window-Text).Contains('BUSY_READY')} 'blocking command start')
 if([TerminalTestWindow]::GetForegroundWindow() -ne $process.MainWindowHandle){throw 'Installed window lost keyboard focus'}
 [Windows.Forms.SendKeys]::SendWait('^c')
 [void](Wait-Condition {(Window-Text) -match 'PS [^\r\n]*>'} 'post-interrupt prompt')
 Send-Terminal "Write-Output ('CTRL_' + 'OK')"
 [void](Wait-Condition {(Window-Text).Contains('CTRL_OK')} 'post-interrupt command')
 $snapshot=@(Get-CimInstance Win32_Process)
 $owned=New-Object 'System.Collections.Generic.HashSet[int]'
 [void]$owned.Add($process.Id)
 do {
  $changed=$false
  foreach($entry in $snapshot){if($owned.Contains([int]$entry.ParentProcessId) -and $owned.Add([int]$entry.ProcessId)){$changed=$true}}
 } while($changed)
 foreach($ownedId in $owned){try{$handle=[Diagnostics.Process]::GetProcessById($ownedId);$null=$handle.Handle;$retained.Add($handle)}catch{}}
 if(!$process.CloseMainWindow()){throw 'Installed app window could not close normally'}
 if(!$process.WaitForExit(15000)){throw 'Installed app did not quit'}
 foreach($handle in $retained){if(!$handle.WaitForExit(15000)){throw 'An installed-app owned process survived quit'}}
 $uninstaller=Join-Path $installPath 'Uninstall Terminal One.exe'
 if(!(Test-Path -LiteralPath $uninstaller)){
  $uninstaller=(Get-ChildItem -LiteralPath $installPath -Filter '*Uninstall*.exe' | Select-Object -First 1).FullName
 }
 if(!$uninstaller){throw 'Installed uninstaller is missing'}
 $remove=Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -WindowStyle Hidden
 if(!$remove.WaitForExit(60000)){throw 'Uninstaller timed out'}
 [void](Wait-Condition {Test-UninstalledPath $exe} 'uninstalled executable')
 @{passed=$true;os=[Environment]::OSVersion.Version.ToString();arch=$env:PROCESSOR_ARCHITECTURE;unsigned=$true;startupMs=$startup.ElapsedMilliseconds;installerChecksum=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash;checks=@('install-space-unicode-path','real-shell','command','unicode','resize','ctrlc','owned-tree-quit','uninstall')} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
} finally {
 if($process -and !$process.HasExited){$process.Kill();[void]$process.WaitForExit(15000)}
 foreach($handle in $retained){$handle.Dispose()}
}
