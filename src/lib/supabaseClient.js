import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/*
 * La anon key NO es un secreto: está pensada para viajar en el navegador y
 * acaba embebida en el bundle, así que ocultarla no protege nada. Lo que
 * protege los datos son las políticas RLS de cada tabla.
 *
 * Las opciones de sesión son explícitas a propósito: con Supabase Auth la
 * sesión la gobierna esta librería, y de ella depende que el token se guarde
 * entre recargas y se renueve antes de caducar. Sin renovación, el usuario
 * vería la interfaz cargada pero sus consultas empezarían a fallar sin motivo
 * aparente.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'siga-auth',
  },
})
