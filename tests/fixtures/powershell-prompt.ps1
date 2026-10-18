function Test-IdlePowerShellPrompt([string[]]$Rows) {
 $visible=@($Rows | ForEach-Object { $_.Trim() } | Where-Object { $_ })
 if(!$visible.Count){return $false}
 # An old prompt elsewhere in the viewport, or a prompt with an echoed
 # command, does not establish that PSReadLine is ready for the next command.
 return $visible[-1] -cmatch '^PS [^\r\n]*>\s*$'
}
