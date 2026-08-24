import { supabase } from "./supabase";

export async function uploadFile(file) {
  try {
    const filePath = `test/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("scanpress-temp")
      .upload(filePath, file);

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from("scanpress-temp")
      .getPublicUrl(filePath);

    console.log("Upload Success:", data);
    console.log("Public URL:", publicData.publicUrl);

    return {
      ...data,
      url: publicData.publicUrl
    };
  } catch (err) {
    console.error("Upload Error:", err);
    throw err;
  }
}