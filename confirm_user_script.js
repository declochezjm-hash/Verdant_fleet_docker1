import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Searching for user with email: paul1@verdura.fr");
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  const user = users.find(u => u.email === 'paul1@verdura.fr');
  if (!user) {
    console.log("User paul1@verdura.fr not found in Supabase Auth.");
    console.log("Available users in Auth:");
    users.forEach(u => console.log(`- ${u.email} (Confirmed: ${!!u.email_confirmed_at})`));
    return;
  }

  console.log(`Found user: ${user.email}, ID: ${user.id}, Confirmed: ${!!user.email_confirmed_at}`);

  if (!user.email_confirmed_at) {
    console.log("Confirming email for user...");
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (error) {
      console.error("Error confirming user:", error);
    } else {
      console.log("User successfully confirmed!");
    }
  } else {
    console.log("User is already confirmed.");
  }

  // Also check public.profiles and public.user_roles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile from DB:", profileError.message);
  } else {
    console.log("Profile in DB:", profile);
  }

  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error("Error fetching roles from DB:", rolesError.message);
  } else {
    console.log("Roles in DB:", roles);
  }
}

run();
