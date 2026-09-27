/**
 * What `bun run native:scroll` was asked for. Strict: an unknown switch, or one
 * missing its value, is a mistake to say rather than a default to fall back on
 * (round 34).
 */

export const NATIVE_SCROLL_USAGE =
  'Usage: bun run native:scroll [--theme light|dark] [--chrome <path>] [--chrome-arg <switch>]... [--url <origin> | --port <port>]';

export interface NativeScrollOptions {
  url?: string;
  port: number;
  chrome?: string;
  /** Extra Chrome switches, in order, repeatable. */
  args: string[];
  themes: ('light' | 'dark')[];
}

const VALUED = new Set(['--theme', '--chrome', '--chrome-arg', '--url', '--port']);

export class NativeScrollUsageError extends Error {
  constructor(message: string) {
    super(`${message}\n${NATIVE_SCROLL_USAGE}`);
    this.name = 'NativeScrollUsageError';
  }
}

export function parseNativeScrollOptions(argv: readonly string[]): NativeScrollOptions {
  const values = new Map<string, string>();
  const args: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!VALUED.has(flag)) throw new NativeScrollUsageError(`Unknown option ${flag}`);
    const value = argv[index + 1];
    // A Chrome switch is itself a --flag; any other option's value never is.
    if (value === undefined || (flag !== '--chrome-arg' && value.startsWith('--'))) {
      throw new NativeScrollUsageError(`${flag} needs a value`);
    }
    index += 1;
    if (flag === '--chrome-arg') args.push(value);
    else if (values.has(flag)) throw new NativeScrollUsageError(`${flag} given twice`);
    else values.set(flag, value);
  }
  const theme = values.get('--theme');
  if (theme !== undefined && theme !== 'light' && theme !== 'dark') {
    throw new NativeScrollUsageError('--theme must be light or dark');
  }
  if (values.has('--url') && values.has('--port')) throw new NativeScrollUsageError('--url and --port are exclusive');
  const port = Number(values.get('--port') ?? 4320);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new NativeScrollUsageError('--port must be a port number');
  const url = values.get('--url');
  if (url !== undefined && !/^https?:\/\//.test(url)) throw new NativeScrollUsageError('--url must be an http(s) origin');
  return {
    url, port, chrome: values.get('--chrome'), args,
    themes: theme ? [theme] : ['light', 'dark'],
  };
}
