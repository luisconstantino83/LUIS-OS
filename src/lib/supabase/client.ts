import { createBrowserClient } from "@supabase/ssr";

// Solo se usa en el navegador para subir archivos directo a Storage (la carpeta la protege RLS).
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
}
