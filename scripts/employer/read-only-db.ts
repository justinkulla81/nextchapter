// A Prisma client wrapper that cannot write. The employer-sections audit and diff scripts run against production
// (by the owner's assistant), so they never get the real client: every model delegate only exposes read methods, and
// every `$` method (raw SQL, transactions, extensions) throws except `$disconnect`. A write attempt throws before it
// reaches the driver. Backfill scripts use this too while in dry-run mode, so a dry run cannot write by mistake.

const READ_METHODS = new Set(['findMany', 'findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])

export class ReadOnlyViolation extends Error {
  constructor(what: string) {
    super(`Read-only database: refused ${what}`)
    this.name = 'ReadOnlyViolation'
  }
}

export function readOnlyDb<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver)
      if (prop.startsWith('$')) {
        if (prop === '$disconnect') return Reflect.get(target, prop, receiver).bind(target)
        return () => {
          throw new ReadOnlyViolation(prop)
        }
      }
      const delegate = Reflect.get(target, prop, receiver)
      if (!delegate || typeof delegate !== 'object') return delegate
      return new Proxy(delegate as object, {
        get(d, method, r) {
          if (typeof method !== 'string') return Reflect.get(d, method, r)
          if (READ_METHODS.has(method)) return (Reflect.get(d, method, r) as (...a: unknown[]) => unknown).bind(d)
          return () => {
            throw new ReadOnlyViolation(`${prop}.${method}`)
          }
        },
      })
    },
  })
}
