import 'react-native-url-polyfill/auto';
import { StorageClient } from '@supabase/storage-js';
import { GoTrueClient } from '@supabase/gotrue-js';

// Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing Supabase environment variables. Check your .env file.');
  console.error('   Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Create individual clients for only what we need
export const supabaseAuth = new GoTrueClient({
  url: `${supabaseUrl}/auth/v1`,
  headers: {
    apikey: supabaseAnonKey,
    'X-Client-Info': 'fretiko-mobile',
  },
  autoRefreshToken: true,
  persistSession: true,
});

export const supabaseStorage = new StorageClient(`${supabaseUrl}/storage/v1`, {
  apikey: supabaseAnonKey,
  authorization: `Bearer ${supabaseAnonKey}`,
  'X-Client-Info': 'fretiko-mobile',
});

// Create a compatible supabase object for existing code
export const supabase = {
  auth: supabaseAuth,
  storage: supabaseStorage,
};

// Helper function to get the current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};