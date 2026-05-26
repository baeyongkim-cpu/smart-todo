import { createClient } from '@supabase/supabase-js';

async function test() {
  const customerEmail = "ditto0038@naver.com";
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("URL:", supabaseUrl);
  console.log("Key length:", supabaseKey?.length);

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Listing users...");
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("List users error:", listError.message);
    return;
  }

  const users = listData.users || [];
  console.log("Total users found:", users.length);
  
  const targetUser = users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());
  if (!targetUser) {
    console.error("User not found!");
    return;
  }

  console.log("Found user:", targetUser.id, targetUser.email);

  console.log("Updating profile...");
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_premium: true })
    .eq('id', targetUser.id);

  if (updateError) {
    console.error("Update error:", updateError.message);
  } else {
    console.log("Successfully updated to premium!");
  }
}

test();
