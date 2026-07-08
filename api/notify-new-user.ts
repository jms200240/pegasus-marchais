import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const userEmail: string | undefined = req.body?.record?.email
  if (!userEmail) {
    res.status(400).json({ error: 'Missing user email' })
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "Demande d'accès reçue",
      text: `Un nouvel utilisateur (${userEmail}) a demandé l'accès à l'application.`,
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Erreur envoi email notify-new-user', err)
    res.status(500).json({ error: 'Email send failed' })
  }
}
