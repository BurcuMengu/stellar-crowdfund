import { useCallback, useEffect, useState } from "react";
import { getCampaignInfo, listCampaignAddresses } from "../lib/contracts";
import type { CampaignInfo } from "../types";

interface State {
  data: CampaignInfo[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCampaigns(): State {
  const [data, setData] = useState<CampaignInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const addrs = await listCampaignAddresses();
      const infos = await Promise.all(addrs.map(getCampaignInfo));
      setData(infos.reverse()); // newest first
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
