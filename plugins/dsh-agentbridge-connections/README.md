# AgentBridge connections

A local DeepSeek Harness bundle that adds a read-only **AgentBridge connections** page to the DSH NEXT web GUI. It lists the agents the current DSH is authorized to reach, grouped by machine, with online and busy state.

The data comes from the AgentBridge MCP server that is already configured in the profile: the Host half resolves `mcp__agentbridge__list_agents` through the live tool registry and calls it. The upstream `items` are real; nothing about the agent or machine set is hard-coded.

## Install (local development entry)

In DSH NEXT, open **Plugins → Add plugin** and select this directory (or the directory extracted from the release ZIP). The native `plugin_manager` also supports `install_bundle` with the absolute path to this directory.

Then open **AgentBridge connections** from the left sidebar. With the shipped `openOnLoad: true` row config, the page is also selected once after activation. Set `openOnLoad: false` in the row config for a purely click-to-open page.

## Package layout

| Path | Role |
|---|---|
| `index.js` | Host half: resolves the MCP tool, normalizes `items`, serves the authenticated query route. |
| `lib/normalize.js` | Pure projection: tool result → machine groups; drops identity/credential fields. |
| `client.js` | Browser half: sidebar entry, main panel, loading/empty/error states, refresh. |
| `cordis.patch.yml` | Insert row and its config. |
| `locale/en.json`, `locale/zh.json` | Plugin Manager display metadata. |
| `icon.svg` | Plugin icon. |
| `docs/DETAIL.*.md` | Bundle detail documents. |
| `test/normalize.test.mjs` | Unit tests for the projection and its privacy boundary. |

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `serverName` | `agentbridge` | MCP server namespace. |
| `toolName` | `list_agents` | Raw MCP tool name. |
| `timeoutMs` | `20000` | Query timeout in milliseconds. |
| `openOnLoad` | `false` (this preview uses `true`) | Select the main panel once after activation. |

## Read-only boundary

The plugin never delegates a task, cancels a task, changes authorization, signs in, or reads credentials. It does not modify the AgentBridge source or its configuration. The Host projection keeps only `name`, `machine`, `status`, `online`, `busy`, and `adapter`; caller identities, credential IDs, binding digests, and endpoint records are discarded before the response leaves the Host.

## Native-interface notes

- The browser reads through an exact Fetch route under Connection's authenticated `/api` handler (`ctx.connection.fetch.register`). Exact routes answer only the owner Peer, so the page uses the same browser-cookie admission as `/api`; no anonymous HTTP route is exposed.
- `ctx.connection.rpc.handle` is not usable in this DSH build. It failed activation twice with `cannot get property "webServer" without inject`: `HostConnectionService` registers the prefix route through its own context (`src/rpc-host.ts`), which is created with only `credentials` injected, so adding `webServer` to this plugin's inject cannot change that context. The final build uses `ctx.connection.fetch.register` instead.
- A plugin cannot add a second interceptor to the shared `/api` FetchHandler either: `ctx.connection.rpc.intercept('/api', ...)` has one owner (API Gateway) and throws on a second registration.
- The browser half is a plain lazy-CJS bundle (`window.__ModuleLoader__.load`) and may only require baseline modules such as `react`; it cannot import Harness Client packages such as `@deepseek-ai/dsh-client-ui-primitives`.

## Verification (2026-11-16)

Environment: DSH NEXT desktop `2.0.23-next` (bundled CLI `@deepseek-ai/dsh` `0.2.2-rc.3`), profile `desktop`, Windows.

- Installed through `plugin_manager` `install_bundle` with this directory as the target. The package linked as `@local/agentbridge-connections@1.0.0`; a later activation of `include:agentbridge-connections` reported `application: applied`.
- Live Client inspection showed `sidebar.panellist` id `agentbridge-connections` (order 20) active and `main` key `agentbridge-connections` active.
- The panel was opened and refreshed in the running GUI. It showed machine **97-PC** with agent **Claude Code**, **online**, **idle (not busy)**.
- The same source read outside the page, `mcp__agentbridge__list_agents`, returned one item: `name: "Claude Code"`, `machine: "97-PC"`, `status: "connected"`, `busy: false`.
- Unit tests: 9/9 pass (`node --test --test-isolation=none`). The default per-file test runner spawns a child process, which this sandbox denies with `EPERM`; `--test-isolation=none` runs the same assertions in-process.
- Syntax: `node --check` reported no diagnostics for `index.js`, `client.js`, and `lib/normalize.js`; a deliberately malformed file produced the expected `SyntaxError`, confirming the check was effective.

Not verified: the empty-list and query-failure visuals were not forced against the live bridge (their projections are unit-tested); dark-theme appearance and browser console output were not inspected.

## Tests

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& $env:DSH_NODE_EXECUTABLE --test --test-isolation=none test/normalize.test.mjs
```

The suite uses only `node:test` and `node:assert/strict`. This sandbox denies the default per-file child-process spawn with `EPERM`, so `--test-isolation=none` runs the assertions in this process.
