import { config } from "../config";
import type { CampaignInfo, Milestone, Status } from "../types";
import {
  invokeContract,
  milestonesScVal,
  readContract,
  toAddress,
  toI128,
  toU32,
  toU64,
  type Signer,
} from "./stellar";

// Soroban encodes unit enum variants as a single-element vec of a symbol;
// different SDK versions surface that as a string, ["Active"], or {tag}.
function normalizeStatus(raw: unknown): Status {
  if (Array.isArray(raw)) return raw[0] as Status;
  if (raw && typeof raw === "object" && "tag" in raw) {
    return (raw as { tag: Status }).tag;
  }
  return raw as Status;
}

// ---- factory ---------------------------------------------------------------

export async function listCampaignAddresses(): Promise<string[]> {
  return readContract<string[]>(config.factoryId, "list_campaigns");
}

export async function createCampaign(
  signer: Signer,
  params: { token: string; goal: bigint; deadline: bigint; milestones: { amount: bigint }[] },
): Promise<string | null> {
  return invokeContract<string>({
    contractId: config.factoryId,
    method: "create_campaign",
    args: [
      toAddress(signer.address),
      toAddress(params.token),
      toI128(params.goal),
      toU64(params.deadline),
      milestonesScVal(params.milestones),
    ],
    signer,
  });
}

// ---- campaign --------------------------------------------------------------

export async function getCampaignInfo(address: string): Promise<CampaignInfo> {
  const raw = await readContract<Omit<CampaignInfo, "address" | "status"> & { status: unknown }>(
    address,
    "get_info",
  );
  return {
    ...raw,
    address,
    status: normalizeStatus(raw.status),
    milestones: raw.milestones as Milestone[],
  };
}

export async function getContribution(address: string, who: string): Promise<bigint> {
  return readContract<bigint>(address, "get_contribution", [toAddress(who)]);
}

export async function contribute(signer: Signer, address: string, amount: bigint) {
  return invokeContract({
    contractId: address,
    method: "contribute",
    args: [toAddress(signer.address), toI128(amount)],
    signer,
  });
}

export async function approveMilestone(signer: Signer, address: string, idx: number) {
  return invokeContract({
    contractId: address,
    method: "approve_milestone",
    args: [toU32(idx)],
    signer,
  });
}

export async function releaseMilestone(signer: Signer, address: string, idx: number) {
  return invokeContract({
    contractId: address,
    method: "release_milestone",
    args: [toU32(idx)],
    signer,
  });
}

export async function refund(signer: Signer, address: string) {
  return invokeContract({
    contractId: address,
    method: "refund",
    args: [toAddress(signer.address)],
    signer,
  });
}

// ---- token -----------------------------------------------------------------

export async function tokenBalance(who: string): Promise<bigint> {
  try {
    return await readContract<bigint>(config.usdcId, "balance", [toAddress(who)]);
  } catch {
    return 0n;
  }
}
