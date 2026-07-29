import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type BookingRequest = Tables<"booking_requests">;
export type BookingRequestInsert = TablesInsert<"booking_requests">;
export type BookingRequestUpdate = TablesUpdate<"booking_requests">;

export function useBookingRequests() {
  const qc = useQueryClient();

  useEffect(() => {
    const channelId = `booking-requests-realtime-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["booking_requests"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["booking_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBookingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: BookingRequestInsert) => {
      const { data, error } = await supabase
        .from("booking_requests")
        .insert(request)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_requests"] });
    },
  });
}

export function useUpdateBookingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: BookingRequestUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("booking_requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_requests"] });
    },
  });
}

export function useRejectBookingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("booking_requests")
        .update({ status: "rejected" })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_requests"] });
    },
  });
}
