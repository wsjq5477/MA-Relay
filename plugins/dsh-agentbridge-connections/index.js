/**
 * AgentBridge connections — Host half.
 *
 * Serves one read-only query to the browser page: the agents this DSH is
 * authorized to reach, as reported by the *existing* AgentBridge MCP server's
 * `list_agents` tool. It does not delegate work, change authorization, read
 * credentials, or touch the Bridge's own files; it only projects the tool's
 * real `items` into the view the page renders.
 *
 * Transport: an exact Fetch route under Connection's authenticated `/api`
 * handler. Exact routes are reachable only by the owner Peer, so the page uses
 * the same browser-cookie admission as `/api`, and no anonymous HTTP route is
 * added to the web server.
 */
import { AgentBridgeQueryError, extractToolPayload, toConnectionsView } from './lib/normalize.js'

/** Cordis plugin name for loader diagnostics. */
export const name = 'agentbridge-connections'

/** Exact authenticated Fetch path served to the browser page. */
const RESOURCE_PATH = '/api/agentbridge-connections'

/**
 * Services required by the Host half. `connection` registers the route through
 * `ctx.connection.fetch`, which only needs the Connection service.
 */
export const inject = ['connection']

/**
 * Register the read-only resource on Connection's authenticated Fetch table.
 * @param {import('@deepseek-ai/cordis').Context} ctx host plugin context.
 * @param {Record<string, unknown>} [config] row config from `cordis.patch.yml`.
 */
export function apply(ctx, config = {}) {
  const serverName = nonEmptyString(config.serverName) ?? 'agentbridge'
  const toolName = nonEmptyString(config.toolName) ?? 'list_agents'
  const timeoutMs = positiveNumber(config.timeoutMs) ?? 20_000
  const openOnLoad = config.openOnLoad === true
  const publicName = `mcp__${serverName}__${toolName}`

  /**
   * Invoke the live MCP tool through the tool registry and normalize its
   * result. The tool definition is resolved on every call, so an MCP
   * reconnect that re-registers the tool is picked up without a reload.
   * @param {AbortSignal | undefined} requestSignal caller cancellation.
   * @returns {Promise<object>} the view-model sent to the page.
   */
  async function readConnections(requestSignal) {
    const tools = ctx.get('tools')
    if (tools === undefined) {
      throw new AgentBridgeQueryError(
        'agentbridge/tool-unavailable',
        'The tool registry is not mounted on this DSH.',
      )
    }
    const definition = tools.get(publicName)
    if (definition === undefined) {
      throw new AgentBridgeQueryError(
        'agentbridge/tool-unavailable',
        `The MCP tool "${publicName}" is not registered. Check that the "${serverName}" MCP server is connected.`,
      )
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = requestSignal === undefined
      ? timeoutSignal
      : AbortSignal.any([requestSignal, timeoutSignal])

    let value
    try {
      // The MCP definition's execute only reads `signal` (and the Agent for
      // image results); list_agents returns text JSON. Calling the registered
      // definition keeps the read out of any Agent's tool pipeline and logs no
      // session event.
      value = await definition.execute({}, {
        callId: 'agentbridge-connections-ui',
        name: publicName,
        arguments: {},
        signal,
      })
    } catch (error) {
      if (signal.aborted && timeoutSignal.aborted) {
        throw new AgentBridgeQueryError(
          'agentbridge/timeout',
          `list_agents did not answer within ${timeoutMs} ms.`,
        )
      }
      throw new AgentBridgeQueryError('agentbridge/query-failed', errorMessage(error))
    }

    return toConnectionsView(extractToolPayload(value), {
      serverName,
      toolName,
      fetchedAt: new Date().toISOString(),
    })
  }

  const route = {
    path: RESOURCE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    /**
     * @param {Request} request authenticated owner request.
     * @returns {Promise<Response>} JSON result envelope.
     */
    fetch: async (request) => {
      let body
      try {
        const value = await readConnections(request.signal)
        body = { ok: true, value: { ...value, presentation: { openOnLoad } } }
      } catch (error) {
        body = {
          ok: false,
          error: {
            code: typeof error?.code === 'string' ? error.code : 'agentbridge/query-failed',
            message: errorMessage(error),
            details: {},
          },
        }
      }
      return Response.json(body, { headers: { 'cache-control': 'no-store' } })
    },
  }

  const dispose = ctx.connection.fetch.register(route)
  // The registration belongs to the Connection service's context; remove it
  // explicitly when this plugin unloads or is replaced by HMR.
  ctx.effect(() => () => dispose(), 'agentbridge-connections: query route')
}

/**
 * @param {unknown} value candidate.
 * @returns {string | undefined} trimmed non-empty string.
 */
function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * @param {unknown} value candidate.
 * @returns {number | undefined} positive finite number.
 */
function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * @param {unknown} error thrown value.
 * @returns {string} a bounded diagnostic for the page.
 */
function errorMessage(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'The list_agents call failed.'
  return message.length > 500 ? `${message.slice(0, 500)}…` : message
}
