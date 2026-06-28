// ---------------------------------------------------------------------------
// GraphQL response types for SitecoreAI Management API
// Aligned with: documents/3_GraphQL_Mappings/graphql-mapping-proposal_opus.md
// ---------------------------------------------------------------------------

// ── Workflow & State ────────────────────────────────────────────────────────

export interface GqlWorkflowState {
  stateId: string;
  displayName: string;
  icon: string | null;
  final: boolean;
}

export interface GqlWorkflow {
  workflowId: string;
  displayName: string;
  initialState: Pick<GqlWorkflowState, "stateId" | "displayName"> | null;
  states: { nodes: GqlWorkflowState[] };
}

// ── Sites ──────────────────────────────────────────────────────────────────

export interface GqlSite {
  name: string;
  contentStartPath: string;
  domain: string;
  rootPath: string;
  startPath: string;
  targetHostName: string;
}

// ── Items ───────────────────────────────────────────────────────────────────

export interface GqlItemLanguage {
  name: string;
  displayName?: string;
}

export interface GqlItemTemplate {
  name: string;
  templateId?: string;
}

export interface GqlItemWorkflowInfo {
  canEdit: boolean;
  canSave?: boolean;
  workflow?: {
    workflowId: string;
    displayName: string;
  };
  workflowState: {
    stateId: string;
    displayName: string;
    icon?: string;
    final?: boolean;
  };
}

export interface GqlFieldValue {
  value: string;
}

export interface GqlItemField {
  name: string;
  value: string;
  fieldId: string;
  containsStandardValue: boolean;
  templateField: { type: string };
}

export interface GqlWorkItem {
  itemId: string;
  name: string;
  displayName: string;
  path: string;
  version: number;
  icon: string | null;
  hasPresentation: boolean;
  language: GqlItemLanguage;
  template: GqlItemTemplate;
  workflow: GqlItemWorkflowInfo;
  lastUpdated?: GqlFieldValue;
  lastUpdatedBy?: GqlFieldValue;
}

// ── Commands ────────────────────────────────────────────────────────────────

export interface GqlWorkflowCommand {
  commandId: string;
  displayName: string;
  icon: string | null;
  suppressComments: boolean;
  /** Resolved from the command item's "Next state" field; null if unknown */
  nextStateId: string | null;
}

// ── Workflow Events (History) ───────────────────────────────────────────────

export interface GqlWorkflowEvent {
  date: string;
  user: string;
  comments: string[];
  oldState: Pick<GqlWorkflowState, "stateId" | "displayName"> | null;
  newState: Pick<GqlWorkflowState, "stateId" | "displayName"> | null;
}

// ── Item Detail ─────────────────────────────────────────────────────────────

export interface GqlItemVersion {
  version: number;
  language: GqlItemLanguage;
  field_updated?: GqlFieldValue;
  field_updatedBy?: GqlFieldValue;
}

export interface GqlItemPublish {
  hasPublishableVersion: boolean;
  neverPublish: boolean;
  hideVersion: boolean;
  validFrom: string;
  validTo: string;
}

export interface GqlItemLock {
  isLocked: boolean;
  lockedBy: string | null;
}

export interface GqlItemAccess {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canPublish: boolean;
}

export interface GqlItemDetail {
  itemId: string;
  name: string;
  displayName: string;
  path: string;
  icon: string | null;
  version: number;
  hasPresentation: boolean;
  language: GqlItemLanguage & { displayName: string };
  template: GqlItemTemplate & { templateId: string };
  fields: { nodes: GqlItemField[] };
  versions: GqlItemVersion[];
  publish: GqlItemPublish;
  workflow: GqlItemWorkflowInfo;
  lock: GqlItemLock;
  access: GqlItemAccess;
}

// ── Execute Workflow Command ────────────────────────────────────────────────

export interface GqlExecuteWorkflowCommandPayload {
  successful: boolean;
  completed: boolean;
  message: string | null;
  error: string | null;
  nextStateId: string | null;
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface GqlPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface GqlConnection<T> {
  nodes: T[];
  pageInfo?: GqlPageInfo;
}

// ── Response wrappers (top-level `data` shape) ──────────────────────────────

export interface GetWorkflowsResponse {
  workflows: { nodes: GqlWorkflow[] };
}

export interface GetSitesResponse {
  sites: GqlSite[];
}

export interface GetWorkflowBoardResponse {
  workflow: {
    workflowId: string;
    displayName: string;
    states: { nodes: GqlWorkflowState[] };
    itemsCount: number;
    items: GqlConnection<GqlWorkItem>;
  };
}

export interface GetCommandsForStateResponse {
  workflow: {
    commands: { nodes: GqlWorkflowCommand[] };
  };
}

export interface GetItemDetailResponse {
  item: GqlItemDetail;
  workflow: {
    workflowId: string;
    displayName: string;
    history: { nodes: GqlWorkflowEvent[] };
  };
}

export interface ExecuteWorkflowCommandResponse {
  executeWorkflowCommand: GqlExecuteWorkflowCommandPayload;
}

// Dynamic item-count response — keys are aliases like "count0", "count1", etc.
export type GetWorkflowItemCountsResponse = {
  workflow: Record<string, number> & {
    workflowId?: string;
    displayName?: string;
  };
};
