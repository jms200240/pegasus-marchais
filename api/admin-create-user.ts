import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const callerToken = authHeader.slice('Bearer '.length)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Configuration serveur incomplète' })
    return
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Vérifie que l'appelant est bien un admin authentifié
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken)
  if (callerErr || !callerData.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const { data: callerProfile } = await admin
    .from('users')
    .select('role')
    .eq('id', callerData.user.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' })
    return
  }

  const { email, password, role } = req.body ?? {}
  if (!email || !password) {
    res.status(400).json({ error: 'email et password requis' })
    return
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr) {
    res.status(400).json({ error: createErr.message })
    return
  }

  if (role && role !== 'famille') {
    await admin.from('users').update({ role }).eq('id', created.user!.id)
  }

  res.status(200).json({ ok: true, id: created.user!.id })
}
