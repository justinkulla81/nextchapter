# Publishing the MCP server to directories

The server is `https://launchyournextchapter.com/api/mcp` (Streamable HTTP, no key, read-only, seven tools; see `src/lib/mcp/jobs-mcp.ts`
and https://launchyournextchapter.com/mcp). `server.json` here is the official MCP Registry record.

## Official MCP Registry

Namespace `com.launchyournextchapter/*` is proven by `https://launchyournextchapter.com/.well-known/mcp-registry-auth`
(`src/app/.well-known/mcp-registry-auth/route.ts`), which holds the public half of an Ed25519 key. To publish or update:

1. Bump `version` in `server.json` (a published version cannot be changed; it should match `serverInfo.version` in `jobs-mcp.ts`).
2. `mcp-publisher login http --domain launchyournextchapter.com --private-key <hex of the private key>`
3. `mcp-publisher publish` from this folder.
4. Check: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.launchyournextchapter/nextchapter-jobs"`

The private key was made on 2026-11-04 in a session scratch folder and is not stored in the repo. If it is gone, make a new key
(`openssl genpkey -algorithm Ed25519`), replace the record in the route, deploy, and publish with the new key.

The registry limits `description` to 100 characters.
