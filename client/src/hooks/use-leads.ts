import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertLead, type Lead, type Rate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type CreateLeadResponse = {
  lead: Lead;
  rates: Rate[];
};

export function useCreateLead() {
  const { toast } = useToast();
  
  return useMutation<CreateLeadResponse, Error, InsertLead>({
    mutationFn: async (data: InsertLead) => {
      // Simulate slight network delay for effect if needed, but keeping it real-time
      const res = await fetch(api.leads.create.path, {
        method: api.leads.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to submit lead');
      }

      return await res.json();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
