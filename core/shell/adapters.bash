# Bash parses commands and retains ownership of cwd, environment and stdin.
# Only missing, explicit PowerShell cmdlets are adapted. Existing Bash commands,
# functions and aliases win. Arguments use Bash quoting, not PowerShell syntax.
command_not_found_handle() {
  local name=$1 runtime arg escaped script
  shift
  case ${name,,} in
    get-childitem|get-location|get-item|write-output|get-process) ;;
    *) printf 'bash: %s: command not found\n' "$name" >&2; return 127 ;;
  esac
  runtime=$(command -v pwsh.exe || command -v powershell.exe) || {
    printf 'Terminal One: PowerShell is unavailable for %s\n' "$name" >&2
    return 127
  }
  script="& '$name'"
  for arg in "$@"; do
    if [[ $arg =~ ^-[a-zA-Z][a-zA-Z0-9]*$ ]]; then
      script+=" $arg"
    else
      escaped=${arg//\'/\'\'}
      script+=" '$escaped'"
    fi
  done
  # An explicit success exit prevents an inherited LASTEXITCODE from winning.
  script+='; if ($?) { exit 0 } else { exit 1 }'
  MSYS2_ARG_CONV_EXCL='*' "$runtime" -NoLogo -NoProfile -Command "$script"
}

# CMD's common directory switches are distinct from GNU dir flags. Keep all
# other dir forms with Bash; reject CMD metacharacters rather than reparse them.
dir() {
  local arg line='dir' adapted=
  for arg in "$@"; do
    case ${arg,,} in /b|/s|/a|/o|/t) adapted=1 ;; esac
  done
  if [[ ! $adapted ]]; then command dir "$@"; return; fi
  for arg in "$@"; do
    if [[ $arg == *['%!'\"'&|<>^()']* || $arg == *$'\n'* || $arg == *$'\r'* ]]; then
      printf 'Terminal One: use an explicit CMD tab for complex CMD syntax.\n' >&2
      return 2
    fi
    case ${arg,,} in
      /b|/s|/a|/o|/t) line+=" $arg" ;;
      *) line+=" \"$arg\"" ;;
    esac
  done
  MSYS2_ARG_CONV_EXCL='*' command cmd.exe /d /s /c "$line"
}
