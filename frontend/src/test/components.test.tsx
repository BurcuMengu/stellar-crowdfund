import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CampaignCard } from "../components/CampaignCard";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import type { CampaignInfo } from "../types";

const sample: CampaignInfo = {
  address: "CAAA",
  creator: "GCREATOR1234567890",
  token: "CUSDC",
  goal: 1000_0000000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
  total_raised: 400_0000000n,
  status: "Active",
  milestones: [
    { amount: 600_0000000n, approved: false, released: false },
    { amount: 400_0000000n, approved: false, released: false },
  ],
};

describe("ProgressBar", () => {
  it("renders the correct aria progress value", () => {
    render(<ProgressBar info={{ goal: 1000n, total_raised: 250n }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});

describe("StatusBadge", () => {
  it("shows the status text", () => {
    render(<StatusBadge status="Successful" />);
    expect(screen.getByText("Successful")).toBeInTheDocument();
  });
});

describe("CampaignCard", () => {
  it("shows raised/goal, milestone count and links to detail", () => {
    render(
      <MemoryRouter>
        <CampaignCard info={sample} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/400/)).toBeInTheDocument();
    expect(screen.getByText(/1000 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/2 milestones/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/campaign/CAAA");
  });
});
