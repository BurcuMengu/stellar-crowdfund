import { Link } from "react-router-dom";
import { CampaignCard } from "../components/CampaignCard";
import { Spinner } from "../components/Spinner";
import { isConfigured } from "../config";
import { useCampaigns } from "../hooks/useCampaigns";

export function CampaignList() {
  const { data, loading, error, reload } = useCampaigns();

  if (!isConfigured()) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800">
        <h2 className="font-semibold">Not configured</h2>
        <p className="mt-1 text-sm">
          Set <code>VITE_FACTORY_ID</code> and <code>VITE_USDC_ID</code> in{" "}
          <code>frontend/.env.local</code>. Run <code>./scripts/deploy.sh</code> to
          generate them.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-gray-500">Back projects with milestone-based escrow.</p>
        </div>
        <Link
          to="/create"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + New Campaign
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-16 text-brand">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}{" "}
          <button onClick={reload} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
          No campaigns yet. Be the first to{" "}
          <Link to="/create" className="font-semibold text-brand">
            create one
          </Link>
          .
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((info) => (
          <CampaignCard key={info.address} info={info} />
        ))}
      </div>
    </div>
  );
}
