// Minimal structured logger. Emits single-line JSON in production (easy to ship
// to a log aggregator) and a readable `[scope] message` form in development.
// Level is controlled by LOG_LEVEL (debug|info|warn|error); DEBUG=true implies
// debug. Zero-dependency wrapper over console so it stays edge/runtime safe.

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const explicit = (process.env.LOG_LEVEL || '').toLowerCase();
  if (explicit in LEVELS) return LEVELS[explicit as Level];
  if (process.env.DEBUG === 'true') return LEVELS.debug;
  return LEVELS.info;
}

const isProd = process.env.NODE_ENV === 'production';

function serialize(arg: unknown): unknown {
  if (arg instanceof Error) return { message: arg.message, stack: arg.stack };
  return arg;
}

function emit(level: Level, scope: string, msg: string, args: unknown[]): void {
  if (LEVELS[level] < threshold()) return;
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (isProd) {
    const record: Record<string, unknown> = { ts: new Date().toISOString(), level, scope, msg };
    if (args.length) record.args = args.map(serialize);
    consoleFn(JSON.stringify(record));
  } else {
    consoleFn(`[${scope}] ${msg}`, ...args);
  }
}

export interface Logger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, ...args) => emit('debug', scope, msg, args),
    info: (msg, ...args) => emit('info', scope, msg, args),
    warn: (msg, ...args) => emit('warn', scope, msg, args),
    error: (msg, ...args) => emit('error', scope, msg, args),
  };
}
