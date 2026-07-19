import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type VehicleBlock = Tables<"vehicle_blocks">;

export function useVehicleBlocks() {
  return useQuery({
    queryKey: ["vehicle_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blocks")
        .select("*")
        .order("start_date");
      if (error) throw error;
      return data as VehicleBlock[];
    },
  });
}

export function useCreateVehicleBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: TablesInsert<"vehicle_blocks">) => {
      const { data, error } = await supabase.from("vehicle_blocks").insert(block).select().single();
      if (error) throw error;
      return data as VehicleBlock;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle_blocks"] }),
  });
}

export function useDeleteVehicleBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle_blocks"] }),
  });
}
