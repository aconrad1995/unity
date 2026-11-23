// Sends Unity's few emails: the welcome note and password-reset links.
// Off until the host has an email key, so nothing is ever sent by accident:
//   UNITY_RESEND_KEY   an API key from resend.com
//   UNITY_MAIL_FROM    who it's from, like "Unity <hello@unityrave.com>" (the domain must be verified at Resend)
// For tests and local trials, UNITY_MAIL_DIR writes each email to a file in that folder instead of sending it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PUBLIC_URL = (process.env.UNITY_PUBLIC_URL || 'https://unityrave.com').replace(/\/+$/, '')

export const mailReady = () => !!(process.env.UNITY_MAIL_DIR || (process.env.UNITY_RESEND_KEY && process.env.UNITY_MAIL_FROM))

let n = 0
/** Sends one plain-text email. Resolves true when it was handed off, false otherwise; never throws. */
export async function sendMail({ to, subject, text }) {
  try {
    if (process.env.UNITY_MAIL_DIR) {
      mkdirSync(process.env.UNITY_MAIL_DIR, { recursive: true })
      writeFileSync(join(process.env.UNITY_MAIL_DIR, `${Date.now()}-${++n}.json`), JSON.stringify({ to, subject, text }))
      return true
    }
    if (!mailReady()) return false
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UNITY_RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.UNITY_MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error(`email not sent: ${res.status} ${(await res.text()).slice(0, 200)}`)
    return res.ok
  } catch (e) {
    console.error('email not sent:', e?.message ?? e)
    return false
  }
}

export const welcomeMail = (to) => ({
  to,
  subject: 'Your Unity account is ready',
  text: [
    'Your Unity account is set up with this email.',
    '',
    'Sign in with it on any phone to get your listings, chats and saved outfits back.',
    `${PUBLIC_URL}/#/you/account/signin`,
    '',
    'If you forget your password, choose "Forgot your password?" on the sign-in screen and we’ll email you a link.',
    '',
    'Didn’t make this account? You can ignore this email.',
  ].join('\n'),
})

export const resetMail = (to, token) => ({
  to,
  subject: 'Reset your Unity password',
  text: [
    'Someone asked to reset the password for your Unity account.',
    '',
    'Choose a new password here. The link works once, for one hour:',
    `${PUBLIC_URL}/#/reset/${token}`,
    '',
    'Didn’t ask for this? Ignore this email and your password stays the same.',
  ].join('\n'),
})
