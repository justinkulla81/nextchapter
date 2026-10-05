import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { splitSqlStatements } from '../../scripts/higher-ed/sql-statements'

describe('splitSqlStatements', () => {
  it('splits on semicolons outside strings, identifiers, comments and $$ bodies', () => {
    const sql = `
      -- a comment; with a semicolon
      create table "a;b"(x text default 'it''s; fine');
      create function f() returns int language sql as $$ select 1; $$;
      do $body$ begin perform 1; end $body$;
    `
    expect(splitSqlStatements(sql)).toEqual([
      `create table "a;b"(x text default 'it''s; fine')`,
      `create function f() returns int language sql as $$ select 1; $$`,
      `do $body$ begin perform 1; end $body$`,
    ])
  })

  it('parses the real Higher Ed RLS file into whole statements', () => {
    const sql = readFileSync(path.join(__dirname, '../../prisma/sql/higher-ed-rls.sql'), 'utf8')
    const statements = splitSqlStatements(sql)
    // Each of the 13 helper function bodies stays in one piece.
    expect(statements.filter((s) => s.startsWith('create or replace function')).length).toBe(13)
    expect(statements.every((s) => !s.startsWith('$$'))).toBe(true)
    expect(statements.some((s) => s.includes('enable row level security'))).toBe(true)
  })
})
