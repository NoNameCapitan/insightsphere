import type { SpecialtyId } from "./vlk-sample-data.ts";
import type { OutcomeFilterId } from "./vlk-outcomes.ts";

export type WorkspaceHistorySnapshot = {
  specialty: SpecialtyId | "";
  query: string;
  selectedId: string;
  selectedRuleIndex: string;
  outcomeFilter: OutcomeFilterId;
  pointFilter: string;
  searchSpecialty: SpecialtyId | "all";
  mobilePanel: "list" | "article";
};

/** Ephemeral browser navigation only; no patient/query data is added to storage. */
export function createWorkspaceHistory(entryId = crypto.randomUUID()) {
  let lastWorkspace: WorkspaceHistorySnapshot | undefined;
  let activeEntryId = entryId;
  return {
    get marker() { return { vlk: "dashboard", vlkEntry: activeEntryId }; },
    remember(snapshot: WorkspaceHistorySnapshot) {
      lastWorkspace = { ...snapshot };
    },
    restore(state: unknown): WorkspaceHistorySnapshot | undefined {
      if (!state || typeof state !== "object" || !("vlk" in state) || state.vlk !== "dashboard" ||
        !("vlkEntry" in state) || state.vlkEntry !== activeEntryId) return;
      return lastWorkspace ? { ...lastWorkspace } : undefined;
    },
    clear() {
      lastWorkspace = undefined;
      activeEntryId = crypto.randomUUID();
    },
  };
}
