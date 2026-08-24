import { supabase } from "./supabase";

export async function testSupabase() {
  const { data, error } = await supabase.storage
    .from("scanpress-temp")
    .list();

  console.log("DATA:", data);
  console.log("ERROR:", error);
}