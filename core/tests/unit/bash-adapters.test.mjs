import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const bash = join(
  process.env.ProgramFiles ?? 'C:/Program Files',
  'Git/bin/bash.exe'
)
test(
  'Bash adapters preserve literal arguments, cwd, exit codes and native commands',
  {
    skip: process.platform !== 'win32' || !existsSync(bash)
  },
  () => {
    const cwd = mkdtempSync(join(tmpdir(), 'terminal-adapter-'))
    writeFileSync(join(cwd, 'synthetic.txt'), 'fixture')
    const run = (command) =>
      spawnSync(
        bash,
        [
          '--noprofile',
          '--norc',
          '-c',
          'source "$1"; ' + command,
          'adapter-test',
          resolve('shell/adapters.bash').replaceAll('\\', '/')
        ],
        { cwd, encoding: 'utf8', timeout: 15000 }
      )
    try {
      let result = run('Write-Output "literal space"')
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), 'literal space')
      result = run(
        String.raw`Write-Output "quote' and \$literal; & no-execution"`
      )
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), "quote' and $literal; & no-execution")
      result = run('Get-ChildItem -LiteralPath synthetic.txt -Name')
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), 'synthetic.txt')
      result = run('Get-Item -LiteralPath nonexistent-file')
      assert.equal(result.status, 1)
      result = run('dir /b')
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), 'synthetic.txt')
      assert.equal(run("dir /b 'bad&echo unexpected'").status, 2)
      assert.equal(run('not_a_real_command').status, 127)
      result = run('function Write-Output() { printf native; }; Write-Output')
      assert.equal(result.stdout, 'native')
      result = run('dir --format=single-column')
      assert.equal(result.stdout.trim(), 'synthetic.txt')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  }
)
