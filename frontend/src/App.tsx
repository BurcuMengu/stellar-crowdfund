import { Link, Route, Routes } from "react-router-dom";
import { ToastHost } from "./components/ToastHost";
import { WalletButton } from "./components/WalletButton";
import { config } from "./config";
import { CampaignDetail } from "./pages/CampaignDetail";
import { CampaignList } from "./pages/CampaignList";
import { CreateCampaign } from "./pages/CreateCampaign";

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="text-brand">✦</span> Stellar Crowdfund
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              {config.network}
            </span>
          </Link>
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<CampaignList />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/campaign/:address" element={<CampaignDetail />} />
        </Routes>
      </main>

      <ToastHost />
    </div>
  );
}
