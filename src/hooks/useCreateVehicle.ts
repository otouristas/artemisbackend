import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicle: TablesInsert<"vehicles">) => {
      const { data, error } = await supabase.from("vehicles").insert(vehicle).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}
