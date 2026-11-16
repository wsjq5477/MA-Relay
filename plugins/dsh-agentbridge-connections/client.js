/**
 * AgentBridge connections — browser half.
 *
 * A read-only page in the main panel, reached from its sidebar icon. It asks
 * the Host half for the current AgentBridge `list_agents` projection and
 * renders name / online / busy per machine. No action on the page mutates
 * authorization, delegates work, or reads credentials.
 */
window.__ModuleLoader__.load({
  id: '@local/agentbridge-connections',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'agentbridgeConnections'
    /** Sidebar entry id and main-panel key; they must match. */
    const PANEL_ID = 'agentbridge-connections'
    /** Authenticated exact Fetch resource served by the Host half. */
    const RESOURCE = 'api/agentbridge-connections'

    const zh = {
      panel: 'AgentBridge 连接',
      title: 'AgentBridge 连接',
      description: '只读列出当前 DSH 获准访问的 Agent，按机器分组。本页不会发送任务或修改授权。',
      refresh: '刷新',
      refreshing: '正在刷新…',
      updatedAt: '上次读取：{time}',
      totals: '{agents} 个 Agent · {machines} 台机器',
      machineCount: '{count} 个',
      source: '来源：MCP {server} / {tool}',
      readOnlyTag: '只读',
      online: '在线',
      offline: '离线',
      busy: '忙碌',
      idle: '空闲',
      emptyTitle: '没有获准访问的 Agent',
      emptyHint: '当前 DSH 未从 AgentBridge 收到任何已授权连接。请确认 Bridge 已连接，然后刷新。',
      errorTitle: '读取失败',
      errorNoResult: 'Host 没有返回结果。',
      errorCode: '错误代码：{code}',
      retry: '重试',
      loading: '正在读取获准访问的 Agent…',
      loadingHint: '正在调用 AgentBridge 的 list_agents。',
      readOnlyNote: '本页只读取 Bridge 的授权连接列表；不会发任务、改授权或读取凭据。',
      unknownMachine: '未知机器',
    }

    const en = {
      panel: 'AgentBridge connections',
      title: 'AgentBridge connections',
      description: 'Read-only list of the agents this DSH is authorized to reach, grouped by machine. This page sends no tasks and changes no authorization.',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      updatedAt: 'Last read: {time}',
      totals: 'Agents: {agents} · Machines: {machines}',
      machineCount: '{count}',
      source: 'Source: MCP {server} / {tool}',
      readOnlyTag: 'Read-only',
      online: 'Online',
      offline: 'Offline',
      busy: 'Busy',
      idle: 'Idle',
      emptyTitle: 'No authorized agents',
      emptyHint: 'AgentBridge returned no authorized connections. Check that the bridge is connected, then refresh.',
      errorTitle: 'Could not read connections',
      errorNoResult: 'The Host returned no result.',
      errorCode: 'Error code: {code}',
      retry: 'Retry',
      loading: 'Reading authorized agents…',
      loadingHint: 'Calling the AgentBridge list_agents tool.',
      readOnlyNote: 'This page only reads the bridge’s authorized connection list; it sends no tasks, changes no authorization, and reads no credentials.',
      unknownMachine: 'Unknown machine',
    }

    const CSS = `
.abc-root{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;
  padding:28px clamp(24px,4vw,48px) 48px;overflow-y:auto;color:var(--dsw-alias-label-primary);
  font-family:inherit;font-size:14px;line-height:22px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}
.abc-inner{display:flex;flex-direction:column;gap:18px;width:100%;max-width:960px;margin:0 auto;}
.abc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.abc-title{margin:0;font-size:20px;line-height:28px;font-weight:500;}
.abc-sub{margin:4px 0 0;max-width:68ch;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);}
.abc-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;box-sizing:border-box;
  border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;}
@media (hover:hover){.abc-btn:hover:not(:disabled){background-color:var(--dsw-alias-interactive-bg-hover);}}
.abc-btn:disabled{opacity:.6;cursor:default;}
.abc-btn:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px;}
.abc-refresh-glyph{display:inline-block;font-size:14px;line-height:1;}
.abc-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-secondary);min-height:18px;}
.abc-tag{display:inline-flex;align-items:center;height:18px;padding:0 6px;box-sizing:border-box;border-radius:6px;
  font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-3);}
.abc-groups{display:flex;flex-direction:column;gap:14px;}
.abc-machine{border:0.5px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1);}
.abc-machine-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;
  border-bottom:0.5px solid var(--dsw-alias-border-l2);}
.abc-machine-name{font-size:14px;line-height:22px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.abc-agents{list-style:none;margin:0;padding:0;}
.abc-agent{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
.abc-agent:last-child{border-bottom:none;}
.abc-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-secondary);}
.abc-dot.online{background:var(--dsw-alias-state-success-primary);}
.abc-name{flex:1;min-width:0;font-size:14px;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.abc-adapter{flex:none;display:inline-flex;align-items:center;height:18px;padding:0 6px;box-sizing:border-box;
  border-radius:6px;font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-3);}
.abc-state{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.abc-busy{flex:none;display:inline-flex;align-items:center;height:18px;padding:0 6px;box-sizing:border-box;
  border-radius:6px;font-size:11px;line-height:18px;color:var(--dsw-alias-state-warn-label);
  background:var(--dsw-alias-state-warn-tertiary);}
.abc-idle{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.abc-empty,.abc-error{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:28px 20px;text-align:center;}
.abc-empty-title{font-size:14px;line-height:22px;font-weight:500;}
.abc-empty-hint{margin-top:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.abc-error{text-align:left;border-style:solid;}
.abc-error-title{font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-state-error-primary);}
.abc-error-msg{margin-top:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word;}
.abc-error-code{margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;
  line-height:16px;color:var(--dsw-alias-label-secondary);word-break:break-all;}
.abc-error-actions{margin-top:14px;}
.abc-banner{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:10px;
  background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-primary);}
.abc-banner-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-state-warn-label);}
.abc-banner-msg{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word;}
.abc-skel{display:flex;flex-direction:column;gap:10px;padding:16px;border:0.5px solid var(--dsw-alias-border-l2);
  border-radius:12px;}
.abc-skel-line{height:12px;border-radius:6px;background:var(--dsw-alias-bg-layer-3);animation:abc-pulse 1.2s ease-in-out infinite;}
.abc-skel-line.short{width:38%;}
.abc-note{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
@keyframes abc-pulse{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.abc-skel-line{animation:none;opacity:.7}}
`

    /**
     * Sidebar entry glyph. The sidebar owns the button and label around it.
     * @param {{ size?: number }} props requested icon edge.
     */
    function PanelIcon({ size }) {
      const edge = typeof size === 'number' ? size : 16
      return h('svg', {
        width: edge, height: edge, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': 'true', focusable: 'false',
      },
      h('circle', { cx: 3.6, cy: 8, r: 1.85, stroke: 'currentColor', strokeWidth: 1.3 }),
      h('circle', { cx: 12.4, cy: 8, r: 1.85, stroke: 'currentColor', strokeWidth: 1.3 }),
      h('path', { d: 'M5.6 8h4.8', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
      h('circle', { cx: 8, cy: 8, r: 1.05, fill: 'currentColor' }))
    }

    /**
     * Format the Host timestamp for display.
     * @param {unknown} iso ISO timestamp.
     * @param {string} fallback text when the timestamp is unusable.
     */
    function formatTime(iso, fallback) {
      if (typeof iso !== 'string' || iso === '') return fallback
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return fallback
      try {
        return date.toLocaleString()
      } catch {
        return iso
      }
    }

    /**
     * One machine group: its name, the agent count, and the rows.
     * @param {{ machine: object, tr: Function }} props group and translator.
     */
    function MachineGroup({ machine, tr }) {
      const agents = Array.isArray(machine.agents) ? machine.agents : []
      const name = typeof machine.machine === 'string' && machine.machine !== 'unknown'
        ? machine.machine
        : tr('unknownMachine')
      return h('section', { className: 'abc-machine', 'aria-label': name },
        h('div', { className: 'abc-machine-head' },
          h('span', { className: 'abc-machine-name', title: name }, name),
          h('span', { className: 'abc-tag' }, tr('machineCount', { count: agents.length }))),
        h('ul', { className: 'abc-agents' }, agents.map((agent, index) => h('li', {
          key: `${agent.name}-${index}`,
          className: 'abc-agent',
        },
        h('span', {
          className: agent.online ? 'abc-dot online' : 'abc-dot',
          'aria-hidden': 'true',
        }),
        h('span', { className: 'abc-name', title: agent.name }, agent.name),
        typeof agent.adapter === 'string' && agent.adapter !== ''
          ? h('span', { className: 'abc-adapter' }, agent.adapter)
          : null,
        h('span', { className: 'abc-state' }, agent.online ? tr('online') : tr('offline')),
        agent.busy
          ? h('span', { className: 'abc-busy' }, tr('busy'))
          : h('span', { className: 'abc-idle' }, tr('idle'))))))
    }

    /**
     * The page. `load` is the stable Host call injected by `apply`.
     * @param {{ t?: Function, load: (signal?: AbortSignal) => Promise<object> }} props page props.
     */
    function ConnectionsPage({ t, load }) {
      const tr = typeof t === 'function' ? t : key => key
      const trRef = React.useRef(tr)
      trRef.current = tr
      const [state, setState] = React.useState({ phase: 'loading', data: undefined, error: undefined })
      const abortRef = React.useRef(null)

      const run = React.useCallback(() => {
        if (abortRef.current !== null) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setState(previous => ({
          phase: previous.data === undefined ? 'loading' : 'refreshing',
          data: previous.data,
          error: undefined,
        }))
        load(controller.signal).then((result) => {
          if (controller.signal.aborted) return
          if (result === null || result === undefined || result.ok !== true) {
            setState(previous => ({
              phase: 'error',
              data: previous.data,
              error: result !== null && result !== undefined && result.error !== undefined
                ? result.error
                : { code: 'agentbridge/no-result', message: trRef.current('errorNoResult') },
            }))
            return
          }
          setState({ phase: 'ready', data: result.value, error: undefined })
        }, (failure) => {
          if (controller.signal.aborted) return
          setState(previous => ({
            phase: 'error',
            data: previous.data,
            error: {
              code: 'agentbridge/transport',
              message: failure !== null && failure !== undefined && failure.message !== undefined
                ? String(failure.message)
                : String(failure),
            },
          }))
        })
      }, [load])

      React.useEffect(() => {
        run()
        return () => {
          if (abortRef.current !== null) abortRef.current.abort()
        }
      }, [run])

      const busy = state.phase === 'loading' || state.phase === 'refreshing'
      const data = state.data
      const machines = data !== undefined && Array.isArray(data.machines) ? data.machines : []
      const totals = data !== undefined && data.totals !== undefined ? data.totals : undefined

      const meta = []
      if (data !== undefined) {
        meta.push(h('span', { key: 'updated' }, tr('updatedAt', {
          time: formatTime(data.fetchedAt, '—'),
        })))
        meta.push(h('span', { key: 'totals' }, tr('totals', {
          agents: totals !== undefined && typeof totals.agents === 'number' ? totals.agents : machines.reduce((n, m) => n + (Array.isArray(m.agents) ? m.agents.length : 0), 0),
          machines: totals !== undefined && typeof totals.machines === 'number' ? totals.machines : machines.length,
        })))
        if (data.source !== undefined) {
          meta.push(h('span', { key: 'source' }, tr('source', {
            server: data.source.server,
            tool: data.source.tool,
          })))
        }
        if (data.readOnly === true) meta.push(h('span', { key: 'ro', className: 'abc-tag' }, tr('readOnlyTag')))
      }

      let body
      if (data === undefined && state.phase === 'loading') {
        body = h('div', { className: 'abc-skel', 'aria-busy': 'true', 'aria-label': tr('loading') },
          h('div', { className: 'abc-skel-line short' }),
          h('div', { className: 'abc-skel-line' }),
          h('div', { className: 'abc-skel-line' }),
          h('div', { className: 'abc-skel-line short' }))
      } else if (state.phase === 'error' && data === undefined) {
        body = h('div', { className: 'abc-error', role: 'alert' },
          h('div', { className: 'abc-error-title' }, tr('errorTitle')),
          h('div', { className: 'abc-error-msg' },
            state.error !== undefined && state.error.message !== undefined
              ? String(state.error.message)
              : tr('errorNoResult')),
          state.error !== undefined && state.error.code !== undefined
            ? h('div', { className: 'abc-error-code' }, tr('errorCode', { code: state.error.code }))
            : null,
          h('div', { className: 'abc-error-actions' },
            h('button', { type: 'button', className: 'abc-btn', onClick: run }, tr('retry'))))
      } else if (machines.length === 0) {
        body = h('div', { className: 'abc-empty' },
          h('div', { className: 'abc-empty-title' }, tr('emptyTitle')),
          h('div', { className: 'abc-empty-hint' }, tr('emptyHint')))
      } else {
        body = h('div', { className: 'abc-groups' },
          machines.map((machine, index) => h(MachineGroup, {
            key: machine.machine !== undefined ? String(machine.machine) : String(index),
            machine,
            tr,
          })))
      }

      const banner = state.phase === 'error' && data !== undefined
        ? h('div', { className: 'abc-banner', role: 'alert' },
          h('div', null,
            h('div', { className: 'abc-banner-title' }, tr('errorTitle')),
            h('div', { className: 'abc-banner-msg' },
              state.error !== undefined && state.error.message !== undefined
                ? String(state.error.message)
                : tr('errorNoResult'))),
          h('button', { type: 'button', className: 'abc-btn', onClick: run }, tr('retry')))
        : null

      return h('div', { className: 'abc-root' },
        h('style', null, CSS),
        h('div', { className: 'abc-inner' },
          h('header', { className: 'abc-head' },
            h('div', null,
              h('h1', { className: 'abc-title' }, tr('title')),
              h('p', { className: 'abc-sub' }, tr('description'))),
            h('button', {
              type: 'button',
              className: 'abc-btn',
              onClick: run,
              disabled: busy,
              'aria-busy': busy ? 'true' : undefined,
            },
            h('span', { className: 'abc-refresh-glyph', 'aria-hidden': 'true' }, '↻'),
            h('span', null, busy ? tr('refreshing') : tr('refresh')))),
          h('div', { className: 'abc-meta', 'aria-live': 'polite' }, meta),
          banner,
          body,
          h('p', { className: 'abc-note' }, tr('readOnlyNote'))))
    }

    return {
      inject: ['connection', 'slots', 'locale', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agentbridge-connections: dictionaries')
        const t = ctx.locale.bind(NS)

        // One stable loader shared by the page and the pre-render open check.
        // The Host serves an owner-only exact Fetch resource under /api, so the
        // browser's normal cookie admission applies.
        const load = async (signal) => {
          let response
          try {
            response = await fetch(RESOURCE, {
              method: 'GET',
              headers: { accept: 'application/json' },
              cache: 'no-store',
              ...(signal === undefined ? {} : { signal }),
            })
          } catch (error) {
            if (signal !== undefined && signal.aborted) throw error
            return {
              ok: false,
              error: {
                code: 'agentbridge/transport',
                message: error && error.message !== undefined ? String(error.message) : String(error),
              },
            }
          }
          if (!response.ok) {
            return {
              ok: false,
              error: {
                code: 'agentbridge/http',
                message: `The Host answered HTTP ${response.status}.`,
              },
            }
          }
          let payload
          try {
            payload = await response.json()
          } catch {
            return {
              ok: false,
              error: { code: 'agentbridge/bad-response', message: 'The Host response is not JSON.' },
            }
          }
          if (payload === null || typeof payload !== 'object') {
            return {
              ok: false,
              error: { code: 'agentbridge/bad-response', message: 'The Host response has no result.' },
            }
          }
          return payload
        }

        let wantsOpen = false
        let panelRegistered = false
        const maybeOpen = () => {
          if (!wantsOpen || !panelRegistered) return
          wantsOpen = false
          try {
            ctx.layout.selectPanel(PANEL_ID)
          } catch (error) {
            console.warn('[agentbridge-connections] could not select the panel:', error)
          }
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => t('panel'),
          locale: NS,
        }, PanelIcon))

        ctx.slots.inject('main', () => {
          const dispose = ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => ({ load }),
          }, ConnectionsPage)
          panelRegistered = true
          maybeOpen()
          return dispose
        })

        // Ask once whether the row asked the page to reveal itself. The same
        // read-only endpoint answers with the Host config, so activation adds
        // exactly one list_agents call.
        let opening
        try {
          opening = Promise.resolve(load(undefined))
        } catch (error) {
          opening = Promise.reject(error)
        }
        opening.then((result) => {
          if (result === null || result === undefined || result.ok !== true) return
          if (result.value === null || typeof result.value !== 'object') return
          if (result.value.presentation === undefined || result.value.presentation === null) return
          if (result.value.presentation.openOnLoad !== true) return
          wantsOpen = true
          maybeOpen()
        }).catch((error) => {
          console.warn('[agentbridge-connections] open-on-load check failed:', error)
        })
      },
    }
  },
})
