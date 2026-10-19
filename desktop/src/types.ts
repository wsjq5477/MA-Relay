export type ToolKind = "claude" | "opencode" | "codex" | "hermes" | "pi" | "dsh";
export type Status =
  | "queued"
  | "accepted"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "unknown";
export interface ModelSelection {
  providerID: string;
  id: string;
}
export interface Event {
  seq: number;
  timestamp: string;
  event: {
    kind: string;
    text?: string;
    reason?: string;
    error?: { message: string };
  };
}
export interface DetailRead {
  id: string;
  status: "loading" | "ready" | "missing" | "error";
  message?: string;
}
export interface Task {
  historical?:boolean;
  nodeId?: string;
  workspace?: string;
  machineId?: string;
  taskId: string;
  executionId: string;
  conversationId: string;
  targetAgent: string;
  requestId: string;
  message: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  turn?: number;
  lastSummary: string;
  lastSeq: number;
  waiting?: { kind: string; summary: string; requestIds: string[] };
  result?: { message: string; truncated?: boolean };
  error?: { code: string; message: string };
  uncertaintyReason?: string;
  reconciliation?: { time: string; state: string; reason: string };
  events?: Event[];
  native?: { sessionId: string; messageId: string };
  verification?: boolean;
}
export interface Agent {
  settingsRevision?: number;
  instanceId?: string;
  machineId?: string;
  connectionId?: string;
  adapter?: ToolKind;
  capabilities?: Record<string, unknown>;
  agentId: string;
  name: string;
  workspace: string;
  enabled: boolean;
  online: boolean;
  healthy: boolean;
  busy: boolean;
  available: boolean;
  default: boolean;
  selectedModel?: { providerID: string; id: string } | null;
  model?: { providerID: string; id: string };
  nativeAgent: string;
  currentTask?: { taskId?: string; status: string; summary: string };
  check?: Record<string, unknown>;
  verification?: { status: string; stale: boolean };
  startupError?: { code: string; message: string };
}
export interface Conversation {
  historical?:boolean;
  nodeId?: string;
  workspace?: string;
  kind?: "task" | "verification";
  canContinue?: boolean;
  continuationReason?: string;
  machineId?: string;
  conversationId: string;
  title: string;
  targetAgent: string;
  turns: number;
  updatedAt: string;
  lastTaskId?: string;
  items?: Task[];
}
export interface Snapshot {
  teamSpaceSupported?: boolean;
  nodes?: AgentNode[];
  nodeManagement?:boolean;
  machineManagement?:boolean;
  daemonManagement?:boolean;
  collaboration?: Collaboration;
  delegations?: Delegation[];
  configured: boolean;
  directory: string;
  status?: { connected: boolean; connectionState: string };
  agents: {
    items: Agent[];
    revision: number;
    connected: boolean;
    connectionState?: string;
    defaultAgent?: string;
  };
  tasks: Task[];
  conversations: Conversation[];
  machines?: Machine[];
  connections?: ToolConnection[];
  instances?: AgentInstance[];
}
export interface AgentNode {
  connectionCapabilities?: ConnectionCapabilities;
  capabilitySource?: {kind: 'static-adapter'|'unknown';adapterId?:string;driver?:'native-cli'|'cli-http'};
  supersededBy?: string;
  removed?:boolean;
  nodeId:string;
  machineId:string;
  adapter:ToolKind;
  name:string;
  executable:string;
  version?:string;
  connected:boolean;
  online:boolean;
  healthy:boolean;
  busy:boolean;
  available:boolean;
  executionSupported:boolean;
  teamCollaboration?:boolean;
  activeTasks:number;
  unconfirmed?:number;
  uncertain?:boolean;
  waiting?:boolean;
  lastError?:{code:string;message:string};
  status:"connected"|"discovered"|"offline"|"tool_error"|"unsupported"|"needs_check"|"upgrade_required";
  error?:string;
}
export interface ConnectionCapabilities {
  execution:boolean|null;
  delegation:boolean|null;
  bridgeMcp:boolean|null;
  resume:boolean|null;
  cancellation:boolean|null;
  permissions:boolean|null;
  forms:boolean|null;
  verification:boolean|null;
}
export interface Collaboration {leaderId:string|null;memberIds:string[];revision:number;}
export interface GraphLayout {
  version:1;layoutRevision:number;
  groups:Record<string,{x:number;y:number}>;
  nodes:Record<string,{x:number;y:number}>;
  viewport:{x:number;y:number;zoom:number};
  warning?:string;
}
export interface GraphReceipt<T> {operationId:string;state:'confirmed'|'not_found'|'rejected';fingerprint?:string;data?:T;error?:{code:string;message:string};}
export interface Delegation {delegationId:string;leaderId:string;memberId:string;parentRequestId:string;parentTaskId?:string;taskId?:string;conversationId?:string;state:string;message:string;createdAt:string;}
export interface Machine {
  busy?:boolean;
  daemonMaintenance?:{operationId:string;state:string;action:string};
  removed?:boolean;
  revision?:number;
  machineId: string;
  name: string;
  kind: "windows" | "wsl" | "linux" | "ssh";
  platform: string;
  distribution?: string;
  online: boolean;
  error?: string;
  lastSyncedAt?:string;
  lastSeenAt?:string;
  home?: string;
  cwd?: string;
  parentMachineId?: string;
  connectionId?: string;
  connectionState?: SshConnectionState;
  stage?: SshConnectionState;
  host?: string;
  port?: number;
  username?: string;
  authKind?: SshAuthKind;
  keyPath?: string;
  credentialSaveSupported?: boolean;
  credentialAvailable?:boolean;
  daemonVersion?: string;
  installProgress?: {phase: string; completedBytes: number; totalBytes: number};
}
export type SshAuthKind = "password" | "key" | "agent";
export type SshConnectionState =
  | "draft" | "validating_host" | "awaiting_host_trust" | "authenticating"
  | "inspecting" | "ready" | "installing" | "starting" | "handshaking" | "online"
  | "disconnected" | "reconnecting" | "needs_credentials" | "blocked"
  | "disconnected_manual" | "removed" | "maintaining";
export interface SshTrustChallenge {
  challengeId: string;
  fingerprint: string;
  host: string;
  port: number;
  keyType: string;
}
export interface SshProbe {
  home: string;
  platform: string;
  arch: string;
  nodeVersion?: string;
  installNeeded: boolean;
  runtimeNeeded: boolean;
  installPath: string;
  diskAvailable?: number;
  packageBytes?: number;
  daemonVersion?: string;
  protocolVersion?: number;
  summary?: string;
}
export interface SshTestResult {
  status?: SshConnectionState;
  stage?: SshConnectionState;
  trustChallenge?: SshTrustChallenge;
  probe?: SshProbe;
}
export interface ToolConnection {
  connectionId: string;
  machineId: string;
  name: string;
  adapter: ToolKind;
  executable: string;
  version?: string;
  connected: boolean;
  healthy: boolean;
  error?: string;
}
export interface AgentInstance extends Agent {
  instanceId: string;
  machineId: string;
  connectionId: string;
  adapter: ToolKind;
}
export interface DiscoveredTool {
  name: string;
  version?: string;
  executable: string;
  adapter: ToolKind;
  connectionId?: string;
  machineId: string;
}
export interface Field {
  format?:string;
  sensitive?:boolean;
  key: string;
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  hidden?: boolean;
  options?: { value: string; label: string }[];
  when?: { key: string; op: string; value: unknown }[];
  minLength?: number;
  maxLength?: number;
}
export interface Pending {
  permissions: { id: string; action: string; resources: string[] }[];
  forms: { id: string; title: string; fields: Field[] }[];
}
export interface Receipt {
  operationId: string;
  state: string;
  data?: unknown;
}
export interface Preferences {
  theme: "system" | "light" | "dark";
  distribution: string;
  directory: string;
  platform?: string;
  version?: string;
}
export interface RecoveryItem {
  id: string;
  machineId?: string;
  op: string;
  code: string;
  reason: string;
}
export interface Journal {
  id: string;
  blockedNodeIds?: string[];
  machineId?:string;
  op: string;
  params: Record<string, unknown>;
  state: string;
  time: string;
}
export interface DesktopAPI {
  call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<
    | { ok: true; result: T }
    | { ok: false; error: { code: string; message: string } }
  >;
  preferences(): Promise<Preferences>;
  savePreferences(p: Preferences): Promise<Preferences>;
  runtimes(): Promise<{
    platform: string;
    distributions: string[];
    error?: string;
  }>;
  pickFolder(machineId?: string): Promise<string | null>;
  window(action: string): Promise<void>;
  pending(): Promise<Journal[]>;
  recoverPending?(): Promise<{ resolved: number; remaining?: number; items?: RecoveryItem[] }>;
}
declare global {
  interface Window {
    agentbridge?: DesktopAPI;
  }
}
