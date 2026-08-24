import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://eacrbqwxcczaakpuvgrp.supabase.co";

const supabaseAnonKey =
  "sb_publishable_5QpJJS57WhAhHgx_owP8Lw_0CpXYy4Q";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);