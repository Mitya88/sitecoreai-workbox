// ---------------------------------------------------------------------------
// WorkflowService — GraphQL API layer for SitecoreAI workflows
//
// Uses the Marketplace SDK's `xmc.authoring.graphql` module to issue queries.
// Pattern derived from examples/wizardUtils.ts:
//   client.mutate("xmc.authoring.graphql", {
//     params: { query: { sitecoreContextId }, body: { query: "..." } }
//   })
// ---------------------------------------------------------------------------

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { SITECORE_FIELDS } from "./sitecore-fields";
import { resolveHostOrigin } from "./host-url";
import type {
  GetWorkflowsResponse,
  GetWorkflowBoardResponse,
  GetCommandsForStateResponse,
  GetItemDetailResponse,
  ExecuteWorkflowCommandResponse,
  GetWorkflowItemCountsResponse,
  GetSitesResponse,
  GqlWorkflow,
  GqlWorkflowState,
  GqlWorkItem,
  GqlWorkflowCommand,
  GqlSite,
  GqlItemDetail,
  GqlExecuteWorkflowCommandPayload,
  GqlWorkflowEvent,
  GqlPageInfo,
} from "./graphql-types";

// ── GraphQL query strings ───────────────────────────────────────────────────

const GET_WORKFLOWS = `
query GetWorkflows($first: PaginationAmount = 100) {
  workflows(first: $first) {
    nodes {
      workflowId
      displayName
      initialState {
        stateId
        displayName
      }
      states {
        nodes {
          stateId
          displayName
          icon
          final
        }
      }
    }
  }
}`;

const GET_SITES = `
query GetSites {
  sites {
    name
    contentStartPath
    domain
    rootPath
    startPath
    targetHostName
  }
}`;

const GET_WORKFLOW_BOARD = `
query GetWorkflowBoard(
  $workflowId: String!
  $stateId: String!
  $itemsFirst: PaginationAmount = 50
  $itemsAfter: String
) {
  workflow(where: { workflowId: $workflowId }) {
    workflowId
    displayName
    states {
      nodes {
        stateId
        displayName
        icon
        final
      }
    }
    itemsCount(stateId: $stateId)
    items(stateId: $stateId, first: $itemsFirst, after: $itemsAfter) {
      nodes {
        itemId(format: B)
        name
        displayName
        path
        version
        icon
        hasPresentation
        language { name }
        template { name }
        lastUpdated: field(name: "__Updated") { value }
        lastUpdatedBy: field(name: "__Updated by") { value }
        workflow {
          canEdit
          workflowState {
            stateId
            displayName
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

const GET_COMMANDS_FOR_STATE = `
query GetCommandsForState($workflowId: String!, $stateId: String!) {
  workflow(where: { workflowId: $workflowId }) {
    commands(query: { stateId: $stateId }) {
      nodes {
        commandId
        displayName
        icon
        suppressComments
      }
    }
  }
}`;

// Dynamically build a query that fetches each command item by ID to read its
// "Next state" field. Uses GraphQL aliases so we can batch into a single request.
function buildCommandTargetsQuery(
  commandIds: string[]
): string {
  if (commandIds.length === 0) return "";

  const aliases = commandIds
    .map(
      (id, i) =>
        `    cmd${i}: item(where: { itemId: "${id}", database: "master" }) {\n      itemId(format: B)\n      nextState: field(name: "${SITECORE_FIELDS.NEXT_STATE}") { value }\n    }`
    )
    .join("\n");

  return `query GetCommandTargets {\n${aliases}\n}`;
}

// Response shape: { cmd0: { itemId, nextState }, cmd1: ... }
type CommandTargetsResponse = Record<
  string,
  { itemId: string; nextState: { value: string } | null } | null
>;

const GET_ITEM_DETAIL = `
query GetItemDetail(
  $itemId: ID!
  $language: String!
  $database: String = "master"
  $historyFirst: PaginationAmount = 50
) {
  item(
    where: {
      itemId: $itemId
      language: $language
      database: $database
    }
  ) {
    itemId(format: B)
    name
    displayName
    path
    icon
    version
    hasPresentation
    language {
      name
      displayName
    }
    template {
      name
      templateId(format: B)
    }
    fields(ownFields: true, excludeStandardFields: true) {
      nodes {
        name
        value
        fieldId(format: B)
        containsStandardValue
        templateField { type }
      }
    }
    versions {
      version
      language { name }
      field_updated: field(name: "__Updated") { value }
      field_updatedBy: field(name: "__Updated by") { value }
    }
    publish {
      hasPublishableVersion
      neverPublish
      hideVersion
      validFrom
      validTo
    }
    workflow {
      canEdit
      canSave
      workflow {
        workflowId
        displayName
      }
      workflowState {
        stateId
        displayName
        icon
        final
      }
    }
    lock {
      isLocked
      lockedBy
    }
    access {
      canRead
      canWrite
      canDelete
      canPublish
    }
  }

  workflow(
    where: {
      item: {
        itemId: $itemId
        language: $language
        database: $database
      }
    }
  ) {
    workflowId
    displayName
    history(
      item: {
        itemId: $itemId
        language: $language
        database: $database
      }
      first: $historyFirst
    ) {
      nodes {
        date
        user
        comments
        oldState { stateId displayName }
        newState { stateId displayName }
      }
    }
  }
}`;

const EXECUTE_WORKFLOW_COMMAND = `
mutation ExecuteWorkflowCommand(
  $commandId: String!
  $itemId: ID!
  $language: String!
  $database: String = "master"
  $comments: String
) {
  executeWorkflowCommand(
    input: {
      commandId: $commandId
      comments: $comments
      item: {
        itemId: $itemId
        language: $language
        database: $database
      }
    }
  ) {
    successful
    completed
    message
    error
    nextStateId
  }
}`;

// ── Helper – build item count query with dynamic aliases ────────────────────

function buildItemCountQuery(states: GqlWorkflowState[]): string {
  const aliases = states
    .map(
      (s, i) => `    count${i}: itemsCount(stateId: "${s.stateId}")`
    )
    .join("\n");

  return `
query GetWorkflowItemCounts($workflowId: String!) {
  workflow(where: { workflowId: $workflowId }) {
    workflowId
    displayName
${aliases}
  }
}`;
}

// ── Service class ───────────────────────────────────────────────────────────

export class WorkflowService {
  constructor(
    private client: ClientSDK,
    private sitecoreContextId: string
  ) {}

  // Low-level GraphQL request via Marketplace SDK
  private async request<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await this.client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId: this.sitecoreContextId },
        body: {
          query,
          ...(variables ? { variables } : {}),
        },
      },
    });

    const data = (response as { data?: { data?: T } })?.data?.data;

    if (!data) {
      throw new Error("GraphQL request returned no data");
    }
    return data;
  }

  // ── 1. Get all workflows ────────────────────────────────────────────────

  async getWorkflows(): Promise<GqlWorkflow[]> {
    const result = await this.request<GetWorkflowsResponse>(GET_WORKFLOWS);
    return result.workflows.nodes;
  }

  async getSites(): Promise<GqlSite[]> {
    const result = await this.request<GetSitesResponse>(GET_SITES);
    return Array.isArray(result.sites) ? result.sites : [];
  }

  /**
   * Resolves the XM Cloud authoring host origin (used to build Content Editor
   * deep-links). Delegates to the standalone `resolveHostOrigin` helper.
   */
  async getHostOrigin(): Promise<string | null> {
    return resolveHostOrigin(this.client, this.sitecoreContextId);
  }

  // ── 2. Get per-state item counts (batched as aliases) ───────────────────

  async getWorkflowItemCounts(
    workflowId: string,
    states: GqlWorkflowState[]
  ): Promise<Map<string, number>> {
    if (states.length === 0) return new Map();

    const query = buildItemCountQuery(states);
    const result = await this.request<GetWorkflowItemCountsResponse>(query, {
      workflowId,
    });

    const counts = new Map<string, number>();
    states.forEach((state, i) => {
      const value = result.workflow[`count${i}`];
      counts.set(state.stateId, typeof value === "number" ? value : 0);
    });
    return counts;
  }

  // ── 3. Get workflow board items for a single state ──────────────────────

  async getWorkflowBoard(
    workflowId: string,
    stateId: string,
    first = 50,
    after?: string
  ): Promise<{
    items: GqlWorkItem[];
    itemsCount: number;
    states: GqlWorkflowState[];
    pageInfo: GqlPageInfo;
  }> {
    const result = await this.request<GetWorkflowBoardResponse>(
      GET_WORKFLOW_BOARD,
      {
        workflowId,
        stateId,
        itemsFirst: first,
        ...(after ? { itemsAfter: after } : {}),
      }
    );

    return {
      items: result.workflow.items.nodes,
      itemsCount: result.workflow.itemsCount,
      states: result.workflow.states.nodes,
      pageInfo: result.workflow.items.pageInfo ?? {
        hasNextPage: false,
        endCursor: null,
      },
    };
  }

  // ── 4. Get commands available for a workflow state ──────────────────────

  async getCommandsForState(
    workflowId: string,
    stateId: string
  ): Promise<GqlWorkflowCommand[]> {
    // Step 1: Fetch commands for this state
    const commandsResult = await this.request<GetCommandsForStateResponse>(
      GET_COMMANDS_FOR_STATE,
      { workflowId, stateId }
    );

    const commands = commandsResult.workflow.commands.nodes;

    if (commands.length === 0) {
      return [];
    }

    // Step 2: Build a dynamic alias query to fetch each command item's "Next state" field
    const targetQuery = buildCommandTargetsQuery(
      commands.map((c) => c.commandId)
    );

    const targetMap = new Map<string, string>();

    if (targetQuery) {
      try {
        const targetsResult =
          await this.request<CommandTargetsResponse>(targetQuery);


        // Parse aliases: cmd0, cmd1, ...
        for (let i = 0; i < commands.length; i++) {
          const entry = targetsResult[`cmd${i}`];
          if (entry?.nextState?.value) {
            const raw = entry.nextState.value;
            // Normalise to brace format to match stateId format from workflow API
            const cleaned = raw.trim();
            const normalised = cleaned.startsWith("{")
              ? cleaned.toUpperCase()
              : `{${cleaned.toUpperCase()}}`;
           
            targetMap.set(commands[i].commandId, normalised);
          } 
        }
      } catch (err) {
        console.error("[getCommandsForState] Failed to fetch command targets:", err);
      }
    }

    // Merge nextStateId into each command
    return commands.map((cmd) => ({
      ...cmd,
      nextStateId: targetMap.get(cmd.commandId) ?? null,
    }));
  }

  // ── 5. Get item detail ─────────────────────────────────────────────────

  async getItemDetail(
    itemId: string,
    language: string,
    database = "master"
  ): Promise<{
    item: GqlItemDetail;
    history: GqlWorkflowEvent[];
  }> {
    const result = await this.request<GetItemDetailResponse>(GET_ITEM_DETAIL, {
      itemId,
      language,
      database,
    });
    return {
      item: result.item,
      history: result.workflow.history.nodes,
    };
  }

  // ── 6. Execute a workflow command (state transition) ────────────────────

  async executeWorkflowCommand(params: {
    commandId: string;
    itemId: string;
    language: string;
    database?: string;
    comments?: string;
  }): Promise<GqlExecuteWorkflowCommandPayload> {
    const result = await this.request<ExecuteWorkflowCommandResponse>(
      EXECUTE_WORKFLOW_COMMAND,
      {
        commandId: params.commandId,
        itemId: params.itemId,
        language: params.language,
        database: params.database ?? "master",
        ...(params.comments ? { comments: params.comments } : {}),
      }
    );
    return result.executeWorkflowCommand;
  }
}
