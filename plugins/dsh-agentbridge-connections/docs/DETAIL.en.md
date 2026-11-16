# AgentBridge connections

Read-only view of the agents this DSH is authorized to reach. Open it from the **AgentBridge connections** icon in the left sidebar; with `openOnLoad` the plugin also selects the page once after activation.

## What it shows

- Agents grouped by machine (`machine`).
- Each agent shows its name, online/offline state, and busy/idle state; the adapter name is a secondary tag.
- The header shows the last read time, agent/machine totals, and the source (MCP `agentbridge` / `list_agents`).
- **Refresh** calls the MCP tool again.
- Empty results and query failures have separate states; a failed refresh keeps the last successful data and shows the error code and reason.

## Where the data comes from

The Host half resolves the existing `mcp__agentbridge__list_agents` tool through `ctx.tools.get(...)` and calls it, reads the real `items`, and projects only the fields the page needs (name, machine, status, busy, adapter) before grouping by machine.

- No agent or machine list is hard-coded.
- No task is delegated, no authorization is changed, no account is re-signed-in.
- No credential is read or shown; `caller`, `credentialId`, `bindingDigest`, and similar records are dropped during projection.
- The Bridge source is not modified; the plugin only consumes the MCP tool DSH already registered.

## States and limitations

- Requires the `agentbridge` server row of `@deepseek-ai/dsh-mcp-client` in the profile. Without the tool the page reports `agentbridge/tool-unavailable`.
- Queries are bounded by `timeoutMs`; a timeout reports `agentbridge/timeout`.
- The browser reads through the exact Fetch route `/api/agentbridge-connections` on Connection's authenticated `/api` handler. Exact routes answer only the owner Peer, so the page uses the same browser-cookie admission as `/api` and exposes no extra anonymous HTTP route.
- `ctx.connection.rpc.handle` is not usable in this DSH build: it registers its prefix route through the Connection service's own context, which never injects `webServer`, so any call throws `cannot get property "webServer" without inject`. The shared `/api` interceptor also has one owner (API Gateway), so a plugin cannot add a second one.
- No result cache; entering the page or pressing Refresh reads again.
- No desktop or CLI surface and no write operation.

## Configuration (the plugin row in `cordis.patch.yml`)

| Field | Default | Meaning |
|---|---|---|
| `serverName` | `agentbridge` | MCP server namespace. |
| `toolName` | `list_agents` | Raw MCP tool name. |
| `timeoutMs` | `20000` | One query's timeout in milliseconds. |
| `openOnLoad` | `false` (this preview bundle uses `true`) | Select the main panel once after activation. |

## Privacy

The page renders only display names, machine names, online/busy states, and adapter tags. Identity, binding digests, endpoint records, and caller facts are dropped on the Host before any bytes reach the browser.
