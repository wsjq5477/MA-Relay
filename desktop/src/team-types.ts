export interface TeamAgent {
  agentId: string; kind: 'native' | 'mcp'; nodeId?: string; entryKey: string;
  name: string; purpose: string; inputs: string; outputs: string; limitations: string;
  revision: number; disabled: boolean;
}
export interface Team {
  teamId: string; name: string; leaderId: string; memberIds: string[]; charter: string; revision: number;
}
export interface TeamRun {
  runId: string; teamId: string; name: string; goal: string; acceptance: string;
  charter: string; leaderId: string; memberIds: string[]; revision: number;
  state: 'active' | 'stopping' | 'completed' | 'closed'; paused: boolean; acceptancePending?: {summary:string};
}
export interface TeamDocument {
  documentId: string; runId: string; title: string; content: string; ownerId: string;
  editorIds: string[]; revision: number; history: { revision: number; title: string; content: string; authorId: string; time: string }[];
}
export interface TeamMessage {
  messageId: string; runId: string; seq: number; senderId: string; content: string;
  createdAt: string; notifyIds: string[]; replyTo?: string; attemptId?: string;
}
export interface TeamAttempt {
  attemptId: string; runId: string; agentId: string; nodeId: string; requestId: string;
  message: string; state: string; result?: string; taskId?: string;
  waiting?: {kind: 'permission' | 'input'; requestCount: number};
  stop?: {state: string};
  error?: { code: string; message: string };
}
export interface TeamSnapshot { stage: string; agents: TeamAgent[]; teams: Team[]; runs: TeamRun[]; automaticCoordination: boolean }
export interface TeamContext {
  stopSupported?: boolean;
  run: TeamRun; members: (TeamAgent & { role: 'leader' | 'member' })[];
  documents: TeamDocument[]; messages: TeamMessage[]; hasOlderMessages: boolean;
  deliveries: { messageId: string; runId: string; agentId: string; state: 'pending' | 'delivered' | 'read' }[];
  attempts: TeamAttempt[];
  stop?: {requestedAt: string; completedAt?: string; total: number; unresolved: number; externalCount: number} | null;
  automation?: {
    policy: {enabled: boolean; agentIds: string[]; used: number; maxActivations: number; maxMinutes: number; idleMinutes: number; startedAt: string; issues?: Record<string,string>} | null;
    capabilities: {agentId: string; start: boolean; resume: boolean; runningMessages: boolean; reason?: string; testedVersion?: string}[];
    events: {eventId:string; agentId:string; kind:string; state:string; attemptId?:string}[];
    pending: number; limitReached: boolean; runningMessages: boolean;
  };
  workItems: TeamWorkItem[]; handoffGrants: TeamHandoffGrant[];
  handoffs: { handoffId: string; fromTaskId: string; toTaskId: string; action: string; createdAt: string }[];
  acceptance: { acceptedAt: string; acceptedBy: string; summary: string } | null;
}
export interface TeamConnection { configuration: { command: string; args: string[]; env: Record<string, string> }; instructions: string }

export interface TeamWorkReport {
  reportId: string; round: number; outcome: string; summary: string; reporterId: string;
  artifact?: { artifactId: string; version: string; reference: string };
  targetArtifactId?: string; targetVersion?: string; accessConfirmed?: boolean; evidenceReference?: string;
}
export interface TeamWorkItem {
  workItemId: string; title: string; description: string; ownerId: string; kind: 'delivery' | 'verification';
  sourceTaskId?: string; dependsOn: string[]; state: string; revision: number; round: number;
  reports: TeamWorkReport[]; currentReportId?: string; targetArtifactId?: string; acceptanceSummary?: string;
}
export interface TeamHandoffGrant {
  grantId: string; fromTaskId: string; toTaskId: string; action: 'review' | 'repair';
  maxUses: number; used: number; enabled: boolean; revision: number;
}
