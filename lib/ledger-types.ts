export type LedgerKind =
  | "GENESIS"
  | "ASSESSMENT"
  | "TRUST"
  | "ISOLATE"
  | "PATCH"
  | "ROLLBACK"
  | "GOSSIP";

export interface LedgerPayload {
  kind: LedgerKind;
  sourceDid: string;
  targetDid: string;
  sourceU6a: string;
  targetU6a: string;
  note: string;
  carbon: string;
  silicon: string;
  patchStatus: string;
  matrix: number[];
}

export interface LedgerBlock {
  index: number;
  timestamp: string;
  prevHash: string;
  payload: LedgerPayload;
  hash: string;
}
