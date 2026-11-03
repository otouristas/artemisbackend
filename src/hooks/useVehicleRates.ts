import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type VehicleRate = Tables<"vehicle_rates">;

/** Postgres exclusion_violation: the new range overlaps an existing one for the model. */
export function isOverlapError(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23P01";
}

/** All rate periods, every model. Small table, so the CRM keeps it in one cache entry. */
export function useVehicleRates() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`vehicle-rates-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_rates" }, () => {
        qc.invalidateQueries({ queryKey: ["vehicle_rates"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["vehicle_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_rates")
        .select("*")
        .order("start_date");
      if (error) throw error;
      return data as VehicleRate[];
    },
  });
}

export function useCreateVehicleRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: TablesInsert<"vehicle_rates">[]) => {
      const { data, error } = await supabase.from("vehicle_rates").insert(rows).select();
      if (error) throw error;
      return data as VehicleRate[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle_rates"] }),
  });
}

export function useUpdateVehicleRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"vehicle_rates"> & { id: string }) => {
      const { error } = await supabase.from("vehicle_rates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle_rates"] }),
  });
}

export function useDeleteVehicleRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle_rates"] }),
  });
}
