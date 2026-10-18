function Test-UninstalledPath([string]$Path) {
 try {
  return !(Test-Path -LiteralPath $Path -ErrorAction Stop)
 } catch [System.UnauthorizedAccessException] {
  # Windows can deny queries while NSIS finishes deleting the executable.
  # This is not evidence of absence: retry until a successful query or timeout.
  return $false
 }
}
