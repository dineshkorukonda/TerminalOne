export const DOCUMENTATION_URL =
  'https://github.com/dineshkorukonda/TerminalOne'

export function validateArguments(args: unknown[], count: number): void {
  if (args.length !== count) throw new Error('Invalid IPC arguments')
}

export function validateExternalUrl(value: unknown): string {
  // Exact URLs only: no credentials, alternate protocols, query strings, or subdomains.
  if (value !== DOCUMENTATION_URL)
    throw new Error('External URL is not allowed')
  return value
}

interface Sender {
  sender: object
  frame: object | null
  url: string
}

export function authorizeSender(actual: Sender, expected: Sender): void {
  if (
    actual.sender !== expected.sender ||
    actual.frame === null ||
    actual.frame !== expected.frame ||
    actual.url !== expected.url
  ) {
    throw new Error('Unauthorized IPC sender')
  }
}

export function validatePackagedArguments(args: string[]): void {
  const forbidden =
    /^--(?:remote-debugging(?:-port|-pipe|-address)?|inspect(?:-brk|-port|-publish-uid)?)(?:=|$)/
  if (args.some((arg) => forbidden.test(arg))) {
    throw new Error('Debugging flags are disabled in packaged builds')
  }
}
