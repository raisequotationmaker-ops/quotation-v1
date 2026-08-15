import type { SupabaseClient } from "@supabase/supabase-js";

export async function allocateQuotationNumber(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("allocate_quotation_number");
  if (error) throw error;
  return data as string;
}
