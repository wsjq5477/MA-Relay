/**
 * Pure projection of the AgentBridge MCP `list_agents` result into the
 * read-only view this plugin renders. Kept free of Cordis and Node APIs so the
 * normalization can be exercised directly by the workspace tests.
 */

/** A failure this plugin itself classifies, carrying the code the UI shows. */
export class AgentBridgeQueryError extends Error {
  /**
   * @param {string} code stable error code shown by the page.
   * @param {string} message human-readable diagnostic.
   */
  constructor(code, message) {
    super(message)
    this.name = 'AgentBridgeQueryError'
    this.code = code
  }
}

/**
 * Read the JSON payload the MCP tool produced. The tool bridge returns
 * `{ content, structuredContent? }`; either channel is accepted because the
 * upstream server may or may not advertise an output schema.
 * @param {unknown} value the value returned by the tool definition.
 * @returns {unknown} the parsed upstream JSON payload.
 */
export function extractToolPayload(value) {
  if (value === null || typeof value !== 'object') {
    throw new AgentBridgeQueryError(
      'agentbridge/unexpected-result',
      'The list_agents tool returned no object result.',
    )
  }
  if (value.structuredContent !== undefined && value.structuredContent !== null) {
    return value.structuredContent
  }
  const content = Array.isArray(value.content) ? value.content : []
  const text = content
    .filter(block => block !== null && typeof block === 'object'
      && block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim()
  if (text === '') {
    throw new AgentBridgeQueryError(
      'agentbridge/unexpected-result',
      'The list_agents tool returned no structured content and no JSON text.',
    )
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new AgentBridgeQueryError(
      'agentbridge/unexpected-result',
      'The list_agents text result is not JSON.',
    )
  }
}

/**
 * Group the upstream `items` by machine and keep only the fields the page
 * shows. Identities, binding digests, endpoint records and caller facts are
 * deliberately dropped: the page is read-only and needs none of them.
 * @param {unknown} payload parsed `list_agents` payload.
 * @param {{ serverName: string, toolName: string, fetchedAt: string }} source
 * @returns {object} view-model consumed by the Client half.
 */
export function toConnectionsView(payload, source) {
  const items = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === 'object' && Array.isArray(payload.items)
      ? payload.items
      : null
  if (items === null) {
    throw new AgentBridgeQueryError(
      'agentbridge/unexpected-result',
      'The list_agents result has no items array.',
    )
  }

  /** @type {Map<string, { machine: string, agents: object[] }>} */
  const machines = new Map()
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (name === '') continue
    const machine = typeof item.machine === 'string' && item.machine.trim() !== ''
      ? item.machine.trim()
      : typeof item.machineId === 'string' && item.machineId.trim() !== ''
        ? item.machineId.trim()
        : 'unknown'
    const status = typeof item.status === 'string' && item.status !== '' ? item.status : 'unknown'
    const online = item.online === true || status === 'connected'
    const busy = item.busy === true
    const adapter = typeof item.adapter === 'string' && item.adapter !== '' ? item.adapter : undefined
    let group = machines.get(machine)
    if (group === undefined) {
      group = { machine, agents: [] }
      machines.set(machine, group)
    }
    group.agents.push({
      name,
      online,
      busy,
      status,
      ...adapter === undefined ? {} : { adapter },
    })
  }

  const groups = [...machines.values()]
  const agentCount = groups.reduce((total, group) => total + group.agents.length, 0)
  const view = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {}
  return {
    view: typeof view.view === 'string' ? view.view : 'authorized-connections',
    readOnly: view.readOnly === true,
    source: {
      transport: 'mcp',
      server: source.serverName,
      tool: source.toolName,
    },
    fetchedAt: source.fetchedAt,
    totals: { agents: agentCount, machines: groups.length },
    machines: groups,
  }
}
