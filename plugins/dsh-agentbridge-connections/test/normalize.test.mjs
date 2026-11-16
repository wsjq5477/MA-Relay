import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AgentBridgeQueryError,
  extractToolPayload,
  toConnectionsView,
} from '../lib/normalize.js'

const SOURCE = { serverName: 'agentbridge', toolName: 'list_agents', fetchedAt: '2026-11-16T10:00:00.000Z' }

/** One realistic upstream item, including fields the projection must drop. */
function upstreamItem(overrides = {}) {
  return {
    nodeId: 'node-36cda21051f0017309fc4d48',
    machineId: 'local-9796bb2f-d622-497e-bc3f-3810424b9133',
    name: 'Claude Code',
    adapter: 'claude',
    status: 'connected',
    busy: false,
    machine: '97-PC',
    agents: [{
      agentId: '3ae4366a-3d82-4974-981c-e8e386c811e9',
      name: '本机 Claude',
      endpoint: { bindingDigest: '1586c7f3e0fdde6858e7bd20a657a1419126f0867d4a4fa6f1579228c7979d97' },
    }],
    ...overrides,
  }
}

test('reads structuredContent when the MCP server advertises an output schema', () => {
  const payload = { schema: 1, readOnly: true, items: [upstreamItem()] }
  assert.deepEqual(extractToolPayload({ content: [], structuredContent: payload }), payload)
})

test('falls back to the JSON text block', () => {
  const payload = { readOnly: true, items: [] }
  assert.deepEqual(extractToolPayload({ content: [{ type: 'text', text: JSON.stringify(payload) }] }), payload)
})

test('rejects a non-object tool value', () => {
  assert.throws(() => extractToolPayload('not-an-object'), error => {
    assert.ok(error instanceof AgentBridgeQueryError)
    assert.equal(error.code, 'agentbridge/unexpected-result')
    return true
  })
})

test('rejects a tool result without items', () => {
  assert.throws(() => toConnectionsView({ readOnly: true }, SOURCE), error => {
    assert.equal(error.code, 'agentbridge/unexpected-result')
    return true
  })
})

test('groups real items by machine and maps online/busy', () => {
  const view = toConnectionsView({
    schema: 1,
    readOnly: true,
    items: [
      upstreamItem(),
      upstreamItem({ name: 'OpenCode', adapter: 'opencode', machine: '97-PC', busy: true }),
      upstreamItem({ name: 'Remote bot', machine: 'build-01', status: 'disconnected' }),
    ],
  }, SOURCE)

  assert.equal(view.readOnly, true)
  assert.deepEqual(view.totals, { agents: 3, machines: 2 })
  assert.deepEqual(view.source, { transport: 'mcp', server: 'agentbridge', tool: 'list_agents' })
  assert.equal(view.fetchedAt, SOURCE.fetchedAt)

  const local = view.machines.find(group => group.machine === '97-PC')
  assert.equal(local.agents.length, 2)
  assert.deepEqual(local.agents[0], {
    name: 'Claude Code', online: true, busy: false, status: 'connected', adapter: 'claude',
  })
  assert.equal(local.agents[1].busy, true)

  const remote = view.machines.find(group => group.machine === 'build-01')
  assert.equal(remote.agents[0].online, false)
  assert.equal(remote.agents[0].status, 'disconnected')
})

test('does not copy identity, endpoint, or credential fields to the browser view', () => {
  const view = toConnectionsView({ items: [upstreamItem()] }, SOURCE)
  const serialized = JSON.stringify(view)
  for (const forbidden of [
    'node-36cda21051f0017309fc4d48',
    'local-9796bb2f-d622-497e-bc3f-3810424b9133',
    '3ae4366a-3d82-4974-981c-e8e386c811e9',
    'bindingDigest',
    'credentialId',
    'caller',
    'endpoint',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `view leaked ${forbidden}`)
  }
})

test('skips malformed items but keeps valid ones', () => {
  const view = toConnectionsView({
    items: [null, {}, upstreamItem({ name: '  ' }), upstreamItem({ name: 'Kept' })],
  }, SOURCE)
  assert.equal(view.totals.agents, 1)
  assert.equal(view.machines[0].agents[0].name, 'Kept')
})

test('uses the machine id when no machine display name exists', () => {
  const view = toConnectionsView({ items: [upstreamItem({ machine: undefined })] }, SOURCE)
  assert.equal(view.machines[0].machine, 'local-9796bb2f-d622-497e-bc3f-3810424b9133')
})

test('accepts an array payload', () => {
  const view = toConnectionsView([upstreamItem()], SOURCE)
  assert.equal(view.totals.agents, 1)
  assert.equal(view.view, 'authorized-connections')
})
