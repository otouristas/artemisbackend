import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VehicleChecklist {
  id: string;
  booking_id: string;
  type: "check_in" | "check_out";
  fuel_level: number;
  mileage: number;
  damage_notes: string | null;
  photo_urls: string[];
  created_at: string;
}

interface ChecklistInsert {
  booking_id: string;
  type: "check_in" | "check_out";
  fuel_level?: number;
  mileage?: number;
  damage_notes?: string | null;
  photo_urls?: string[];
}

export function useVehicleChecklists(bookingId?: string) {
  return useQuery({
    queryKey: ["vehicle_checklists", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_checklists")
        .select("*")
        .eq("booking_id", bookingId!)
        .order("created_at");
      if (error) throw error;
      return data as VehicleChecklist[];
    },
    enabled: !!bookingId,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: ChecklistInsert) => {
      const { data, error } = await supabase
        .from("vehicle_checklists")
        .insert(checklist as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["vehicle_checklists", vars.booking_id] }),
  });
}

export async function uploadVehiclePhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("vehicle-photos")
    .upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(fileName);
  return data.publicUrl;
}
