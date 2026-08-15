import type { SupabaseClient } from "@supabase/supabase-js";

export async function createQuotationVersion(
  supabase: SupabaseClient,
  sourceId: string,
) {
  const { data, error } = await supabase.rpc("create_quotation_version", {
    p_source_id: sourceId,
  });
  if (error) throw error;
  return data as string;
}
