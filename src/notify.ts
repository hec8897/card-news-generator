import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import type { NotifyOpts } from './types/shared.ts'
import type { CardCopy } from './types/card.ts'
import type { MarketBrief, MarketEval } from './types/market.ts'

function transporter() {
  return nodemailer.createTransport({
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    auth: { user: process.env.NAVER_EMAIL, pass: process.env.NAVER_APP_PASSWORD },
  })
}

const jo = (won: number) => `${won >= 0 ? '+' : '-'}${Math.abs(won / 1e12).toFixed(2)}조`
const signed = (p: number) => `${p >= 0 ? '+' : ''}${p}%`

/** 테마 시황 카드 메일 (신 경로). 본문에 요약 텍스트 + PNG 5장 첨부. */
export function buildThemeMail(
  brief: MarketBrief,
  ev: MarketEval,
  pngPaths: string[],
  { to }: NotifyOpts = {},
): Mail.Options {
  const f = brief.investorTrading
  const today = brief.themes.find((t) => t.theme === brief.todayTheme) ?? brief.themes[0]
  const newsBlock = (list: MarketEval['news']) =>
    list.map((n, i) => `${i + 1}. ${n.title}\n   ${n.why}${n.link ? `\n   ${n.link}` : ''}`).join('\n')

  const text =
    `${brief.date}\n\n` +
    `코스피 ${brief.kospi.value} (${brief.kospi.pct >= 0 ? '▲' : '▼'}${Math.abs(brief.kospi.pct)}%)\n` +
    `개인 ${jo(f.individual.net)} / 외국인 ${jo(f.foreigner.net)} / 기관 ${jo(f.institution.net)}\n\n` +
    `[시장 총평]\n${ev.marketEval}\n\n` +
    `[오늘의 테마] ${today.theme} (${signed(today.returnPct)})\n${ev.themeComment}\n` +
    today.top3.map((s) => `- ${s.name} ${signed(s.pct)}`).join('\n') +
    `\n\n[테마 뉴스]\n${newsBlock(ev.news)}\n\n[오늘의 시장]\n${newsBlock(ev.marketNews)}\n`

  return {
    from: process.env.NAVER_EMAIL,
    to: to || process.env.MAIL_TO || process.env.NAVER_EMAIL,
    subject: `[money.updown] ${brief.date} 테마 시황 · 오늘의 테마 ${brief.todayTheme}`,
    text,
    attachments: pngPaths.map((filePath, i) => ({ filename: `card-${i + 1}.png`, path: filePath })),
  }
}

export async function sendThemeMail(
  brief: MarketBrief,
  ev: MarketEval,
  pngPaths: string[],
  opts: NotifyOpts = {},
): Promise<Mail.Options> {
  const mailOptions = buildThemeMail(brief, ev, pngPaths, opts)
  if (opts.demo) return mailOptions
  await transporter().sendMail(mailOptions)
  return mailOptions
}

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
