import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Vehicle = Tables<"vehicles">;

export function useVehicles() {
  const qc = useQueryClient();

  useEffect(() => {
    const channelId = `vehicles-realtime-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => {
          qc.invalidateQueries({ queryKey: ["vehicles"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}

