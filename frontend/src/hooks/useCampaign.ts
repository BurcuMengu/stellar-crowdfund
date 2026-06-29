import { useCallback, useEffect, useState } from "react";
import { getCampaignInfo } from "../lib/contracts";
import type { CampaignInfo } from "../types";

interface State {
  info: CampaignInfo | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCampaign(address: string | undefined): State {
  const [info, setInfo] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      setInfo(await getCampaignInfo(address));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  return { info, loading, error, reload };
}
