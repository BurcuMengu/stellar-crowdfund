/** Mirrors the contract `Status` enum. */
export type Status = "Active" | "Successful" | "Failed" | "Finalized";

/** Mirrors the contract `Milestone` struct. */
export interface Milestone {
  amount: bigint;
  approved: boolean;
  released: boolean;
}

/** Mirrors the contract `CampaignInfo` struct, plus the on-chain address. */
export interface CampaignInfo {
  address: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  total_raised: bigint;
  status: Status;
  milestones: Milestone[];
}

/** A decoded contract event for the live feed. */
export interface ContractEvent {
  id: string;
  ledger: number;
  type: "contrib" | "release" | "refund" | "approve" | "created";
  data: unknown;
}
