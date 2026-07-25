import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import type { NotifyOpts } from './types/shared.ts'
import type { CardCopy } from './types/card.ts'

export function buildMailOptions(
  cardCopy: CardCopy,
  pngPaths: string[],
  { warnings = [], to }: NotifyOpts = {},
): Mail.Options {
  const warningBlock = warnings.length ? `⚠️ ${warnings.join(' / ')}\n\n` : ''
  const picksText = cardCopy.picks
    .map((p) => `- ${p.name} (${p.isUp ? '▲' : '▼'}${p.pct}%): ${p.note}`)
    .join('\n')
  const text =
    `${warningBlock}${cardCopy.date}\n\n${cardCopy.coverSubtitle}\n\n` +
    `[시황]\n${cardCopy.summaryLead} ${cardCopy.summaryRest}\n\n` +
    `[종목픽]\n${picksText}\n\n` +
    `[마무리]\n${cardCopy.closingLine1} ${cardCopy.closingLine2}\n내일 관전 포인트: ${cardCopy.tomorrowPoint}`

  return {
    from: process.env.NAVER_EMAIL,
    to: to || process.env.MAIL_TO || process.env.NAVER_EMAIL,
    subject: `[money.updown] ${cardCopy.date} 카드뉴스`,
    text,
    attachments: pngPaths.map((filePath, i) => ({ filename: `card-${i + 1}.png`, path: filePath })),
  }
}

export async function sendCardNewsMail(
  cardCopy: CardCopy,
  pngPaths: string[],
  opts: NotifyOpts = {},
): Promise<Mail.Options> {
  const mailOptions = buildMailOptions(cardCopy, pngPaths, opts)
  if (opts.demo) return mailOptions
  const transporter = nodemailer.createTransport({
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    auth: { user: process.env.NAVER_EMAIL, pass: process.env.NAVER_APP_PASSWORD },
  })
  await transporter.sendMail(mailOptions)
  return mailOptions
}
