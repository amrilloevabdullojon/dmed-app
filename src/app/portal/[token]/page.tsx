import Link from 'next/link'
import type { LetterStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  STATUS_LABELS,
  formatDate,
  getWorkingDaysUntilDeadline,
  isDoneStatus,
  pluralizeDays,
} from '@/lib/utils'
import { ApplicantCommentForm } from '@/components/ApplicantCommentForm'
import { ApplicantContactForm } from '@/components/ApplicantContactForm'
import { ApplicantCopyButton } from '@/components/ApplicantCopyButton'

const APPLICANT_EMAIL = 'applicant@portal.local'

const STATUS_LABELS_UZ: Record<LetterStatus, string> = {
  NOT_REVIEWED: 'tekshirilmagan',
  ACCEPTED: 'qabul qilindi',
  IN_PROGRESS: 'jarayonda',
  CLARIFICATION: 'aniqlashtirishda',
  READY: 'tayyor',
  DONE: 'bajarildi',
}

type PageProps = {
  params: { token: string }
  searchParams?: { lang?: string }
}

type PortalCopy = {
  portalTitle: string
  portalSubtitle: string
  letterLabel: string
  statusMenu: string
  commentsMenu: string
  filesMenu: string
  notificationsMenu: string
  nextMenu: string
  statusTitle: string
  orgLabel: string
  letterDateLabel: string
  deadlineLabel: string
  ownerLabel: string
  ownerFallback: string
  contactLabel: string
  workingHours: string
  lastUpdated: string
  expectedAnswer: string
  expectedIn: string
  expectedOverdue: string
  timelineTitle: string
  createdLabel: string
  currentLabel: string
  commentsTitle: string
  commentsEmpty: string
  writeCommentTitle: string
  writeCommentHint: string
  filesTitle: string
  filesEmpty: string
  downloadLabel: string
  applicantLabel: string
  staffLabel: string
  notificationsTitle: string
  notificationsHint: string
  nextTitle: string
  nextSteps: string[]
  langRu: string
  langUz: string
  notFoundTitle: string
  notFoundBody: string
  expiredTitle: string
  expiredBody: string
}

const RU_COPY: PortalCopy = {
  portalTitle:
    '\u041f\u043e\u0440\u0442\u0430\u043b \u0437\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f',
  portalSubtitle:
    '\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u0438\u0441\u044c\u043c\u0430 \u0438 \u043e\u0431\u0440\u0430\u0442\u043d\u0430\u044f \u0441\u0432\u044f\u0437\u044c',
  letterLabel: '\u041f\u0438\u0441\u044c\u043c\u043e \u2116-',
  statusMenu: '\u0421\u0442\u0430\u0442\u0443\u0441',
  commentsMenu: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438',
  filesMenu: '\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  notificationsMenu: '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
  nextMenu: '\u0427\u0442\u043e \u0434\u0430\u043b\u044c\u0448\u0435',
  statusTitle: '\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u0438\u0441\u044c\u043c\u0430',
  orgLabel: '\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f:',
  letterDateLabel: '\u0414\u0430\u0442\u0430 \u043f\u0438\u0441\u044c\u043c\u0430:',
  deadlineLabel: '\u0414\u0435\u0434\u043b\u0430\u0439\u043d:',
  ownerLabel: '\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c:',
  ownerFallback: '\u041d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d',
  contactLabel: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b:',
  workingHours: '\u0440\u0430\u0431\u043e\u0447\u0438\u0435 \u0447\u0430\u0441\u044b 09:00-18:00',
  lastUpdated:
    '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435:',
  expectedAnswer:
    '\u041e\u0436\u0438\u0434\u0430\u0435\u043c\u044b\u0439 \u043e\u0442\u0432\u0435\u0442:',
  expectedIn:
    '\u043e\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044f \u0432 \u0442\u0435\u0447\u0435\u043d\u0438\u0435',
  expectedOverdue:
    '\u0441\u0440\u043e\u043a \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d \u043d\u0430',
  timelineTitle:
    '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u0442\u0430\u0442\u0443\u0441\u043e\u0432',
  createdLabel: '\u0421\u043e\u0437\u0434\u0430\u043d\u043e',
  currentLabel: '\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441',
  commentsTitle: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438',
  commentsEmpty:
    '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432.',
  writeCommentTitle:
    '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439',
  writeCommentHint:
    '\u0412\u0430\u0448 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0443\u0432\u0438\u0434\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c \u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u0432 \u044d\u0442\u043e\u043c \u0436\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0435.',
  filesTitle: '\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  filesEmpty: '\u041d\u0435\u0442 \u0444\u0430\u0439\u043b\u043e\u0432',
  downloadLabel: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c',
  applicantLabel: '\u0417\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044c',
  staffLabel: '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a',
  notificationsTitle: '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
  notificationsHint:
    '\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 email \u0438\u043b\u0438 Telegram ID \u2014 \u043c\u044b \u0431\u0443\u0434\u0435\u043c \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0442\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f.',
  nextTitle: '\u0427\u0442\u043e \u0434\u0430\u043b\u044c\u0448\u0435',
  nextSteps: [
    '\u041c\u044b \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u0435\u043c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u043c \u0432 \u0441\u0440\u043e\u043a \u043f\u043e \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0443.',
    '\u0415\u0441\u043b\u0438 \u043d\u0443\u0436\u043d\u044b \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f, \u043d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0432 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439.',
    '\u041d\u043e\u0432\u044b\u0435 \u043e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u044f \u043f\u0440\u0438\u0434\u0443\u0442 \u043d\u0430 email / Telegram, \u0435\u0441\u043b\u0438 \u043e\u0442\u043c\u0435\u0442\u0438\u0442\u0435 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443.',
  ],
  langRu: 'RU',
  langUz: 'UZ',
  notFoundTitle:
    '\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e',
  notFoundBody:
    '\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u0438\u043b\u0438 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0443 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f.',
  expiredTitle: '\u0421\u0441\u044b\u043b\u043a\u0430 \u0438\u0441\u0442\u0435\u043a\u043b\u0430',
  expiredBody:
    '\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0441\u0441\u044b\u043b\u043a\u0438 \u0438\u0441\u0442\u0451\u043a. \u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0443 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f.',
}

const UZ_COPY: PortalCopy = {
  portalTitle: 'Ariza beruvchi portali',
  portalSubtitle: 'Xat holati va qayta aloqa',
  letterLabel: 'Xat \u2116-',
  statusMenu: 'Holat',
  commentsMenu: 'Izohlar',
  filesMenu: 'Fayllar',
  notificationsMenu: 'Xabarnomalar',
  nextMenu: 'Keyingi qadam',
  statusTitle: 'Xat holati',
  orgLabel: 'Tashkilot:',
  letterDateLabel: 'Xat sanasi:',
  deadlineLabel: 'Deadline:',
  ownerLabel: 'Masul:',
  ownerFallback: 'Tayinlanmagan',
  contactLabel: 'Kontaktlar:',
  workingHours: 'ish vaqti 09:00-18:00',
  lastUpdated: 'So\u02bcnngi yangilanish:',
  expectedAnswer: 'Kutilayotgan javob:',
  expectedIn: 'taxminan',
  expectedOverdue: 'muddat oshgan',
  timelineTitle: 'Holat tarixi',
  createdLabel: 'Yaratildi',
  currentLabel: 'Joriy holat',
  commentsTitle: 'Izohlar',
  commentsEmpty: 'Hozircha izohlar yo\u02bcuq.',
  writeCommentTitle: 'Izoh yozish',
  writeCommentHint: 'Izohingiz masul xodimga yetadi va shu bo\u02bclimda javob beriladi.',
  filesTitle: 'Fayllar',
  filesEmpty: 'Fayllar yo\u02bcuq',
  downloadLabel: 'Yuklab olish',
  applicantLabel: 'Ariza beruvchi',
  staffLabel: 'Xodim',
  notificationsTitle: 'Xabarnomalar',
  notificationsHint: 'Email yoki Telegram ID qoldiring \u2014 yangiliklar yuboriladi.',
  nextTitle: 'Keyingi qadam',
  nextSteps: [
    'Murojaat ko\u02bcrib chiqiladi va deadline bo\u02bcyicha javob beriladi.',
    'Agar qo\u02bcs\u02bchimcha ma\u02bclumot kerak bo\u02bclsa, izoh yozing.',
    'Yangiliklar email/Telegram orqali yuboriladi.',
  ],
  langRu: 'RU',
  langUz: 'UZ',
  notFoundTitle: 'Xat topilmadi',
  notFoundBody: 'Havolani tekshiring yoki yangi havola so\u02bcrang.',
  expiredTitle: 'Havola muddati tugagan',
  expiredBody: 'Havola amal qilish muddati tugagan. Yangi havola so\u02bcrang.',
}

function formatDateTime(value: Date | string | null, locale: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale)
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ApplicantPortalPage({ params, searchParams }: PageProps) {
  const lang = searchParams?.lang === 'uz' ? 'uz' : 'ru'
  const copy = lang === 'uz' ? UZ_COPY : RU_COPY
  const locale = lang === 'uz' ? 'uz-UZ' : 'ru-RU'
  const statusLabels = lang === 'uz' ? STATUS_LABELS_UZ : STATUS_LABELS

  const letter = await prisma.letter.findFirst({
    where: {
      applicantAccessToken: params.token,
    },
    include: {
      comments: {
        include: {
          author: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      owner: {
        select: { name: true, email: true },
      },
      files: {
        select: { id: true, name: true, url: true, size: true },
        orderBy: { createdAt: 'desc' },
      },
      history: {
        where: { field: 'status' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, oldValue: true, newValue: true, createdAt: true },
      },
    },
  })

  if (!letter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-white">
        <div className="panel panel-glass space-y-3 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-semibold">{copy.notFoundTitle}</h1>
          <p className="text-muted text-sm">{copy.notFoundBody}</p>
        </div>
      </div>
    )
  }

  if (letter.applicantAccessTokenExpiresAt && letter.applicantAccessTokenExpiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-white">
        <div className="panel panel-glass space-y-3 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-semibold">{copy.expiredTitle}</h1>
          <p className="text-muted text-sm">{copy.expiredBody}</p>
        </div>
      </div>
    )
  }

  const isDone = isDoneStatus(letter.status)
  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const daysCount = Math.abs(daysLeft)
  const daysWord = lang === 'ru' ? pluralizeDays(daysCount) : daysCount === 1 ? 'kun' : 'kun'
  const expectedText =
    daysLeft >= 0
      ? `${copy.expectedIn} ${daysCount} ${daysWord}`
      : `${copy.expectedOverdue} ${daysCount} ${daysWord}`

  const timelineItems = [
    {
      id: 'created',
      label: copy.createdLabel,
      status:
        statusLabels[letter.history[0]?.oldValue as LetterStatus] || statusLabels[letter.status],
      date: letter.createdAt,
    },
    ...letter.history
      .filter((item) => item.newValue)
      .map((item) => ({
        id: item.id,
        label: copy.statusMenu,
        status: statusLabels[item.newValue as LetterStatus] || item.newValue || '-',
        date: item.createdAt,
      })),
  ]

  const lastTimeline = timelineItems[timelineItems.length - 1]
  if (lastTimeline?.status !== statusLabels[letter.status]) {
    timelineItems.push({
      id: 'current',
      label: copy.currentLabel,
      status: statusLabels[letter.status],
      date: letter.updatedAt,
    })
  }

  const commentGroups: Array<{ label: string; items: typeof letter.comments }> = []
  letter.comments.forEach((comment) => {
    const label = new Date(comment.createdAt).toLocaleDateString(locale)
    const lastGroup = commentGroups[commentGroups.length - 1]
    if (!lastGroup || lastGroup.label !== label) {
      commentGroups.push({ label, items: [comment] })
    } else {
      lastGroup.items.push(comment)
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="panel panel-glass rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{copy.portalTitle}</h1>
              <p className="text-muted text-sm">{copy.portalSubtitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-2xl font-semibold text-white">
                  {copy.letterLabel}
                  {letter.number}
                </p>
                <ApplicantCopyButton value={letter.number} language={lang} />
              </div>
              <p className="text-muted mt-2 text-sm">
                {copy.lastUpdated} {formatDateTime(letter.updatedAt, locale)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`app-pill text-sm ${
                  isDone
                    ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-500/40 bg-slate-600/50 text-slate-200'
                }`}
              >
                {statusLabels[letter.status]}
              </span>
              <div className="flex items-center gap-2">
                <Link className="app-pill text-xs" href={`/portal/${params.token}?lang=ru`}>
                  {copy.langRu}
                </Link>
                <Link className="app-pill text-xs" href={`/portal/${params.token}?lang=uz`}>
                  {copy.langUz}
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="app-pill text-sm" href="#status">
              {copy.statusMenu}
            </a>
            <a className="app-pill text-sm" href="#comments">
              {copy.commentsMenu}
            </a>
            <a className="app-pill text-sm" href="#files">
              {copy.filesMenu}
            </a>
            <a className="app-pill text-sm" href="#notifications">
              {copy.notificationsMenu}
            </a>
            <a className="app-pill text-sm" href="#next">
              {copy.nextMenu}
            </a>
          </div>
        </div>

        <section id="status" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{copy.statusTitle}</h2>
          <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <div>
              <span className="text-muted">{copy.orgLabel}</span> {letter.org}
            </div>
            <div>
              <span className="text-muted">{copy.letterDateLabel}</span> {formatDate(letter.date)}
            </div>
            <div>
              <span className="text-muted">{copy.deadlineLabel}</span>{' '}
              {formatDate(letter.deadlineDate)}
            </div>
            <div>
              <span className="text-muted">{copy.ownerLabel}</span>{' '}
              {letter.owner?.name || letter.owner?.email || copy.ownerFallback}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted">{copy.contactLabel}</span>{' '}
              {letter.owner?.email || copy.ownerFallback} · {copy.workingHours}
            </div>
          </div>
          <div className="panel-soft panel-glass rounded-xl p-4 text-sm text-slate-200">
            <span className="text-muted">{copy.expectedAnswer}</span> {expectedText}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">{copy.timelineTitle}</h3>
            <div className="space-y-3">
              {timelineItems.map((item, index) => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    {index < timelineItems.length - 1 && (
                      <span className="mt-1 h-10 w-px bg-white/10" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">
                      {item.label}: {item.status}
                    </p>
                    <p className="text-muted text-xs">{formatDateTime(item.date, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="comments" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{copy.commentsTitle}</h2>
          {letter.comments.length === 0 ? (
            <p className="text-muted text-sm">{copy.commentsEmpty}</p>
          ) : (
            <div className="space-y-4">
              {commentGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="text-muted text-xs uppercase tracking-wider">{group.label}</div>
                  {group.items.map((comment) => {
                    const isApplicant = comment.author?.email === APPLICANT_EMAIL
                    return (
                      <div key={comment.id} className="panel-soft panel-glass rounded-xl p-4">
                        <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">
                              {comment.author?.name ||
                                comment.author?.email ||
                                (isApplicant ? copy.applicantLabel : copy.ownerFallback)}
                            </span>
                            <span
                              className={`app-pill text-[10px] ${
                                isApplicant
                                  ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                                  : 'border-slate-400/40 bg-slate-700/40 text-slate-200'
                              }`}
                            >
                              {isApplicant ? copy.applicantLabel : copy.staffLabel}
                            </span>
                          </div>
                          <span>{new Date(comment.createdAt).toLocaleTimeString(locale)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                          {comment.text}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="app-divider" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{copy.writeCommentTitle}</h3>
            <p className="text-muted text-sm">{copy.writeCommentHint}</p>
            <ApplicantCommentForm token={params.token} language={lang} />
          </div>
        </section>

        <section id="files" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{copy.filesTitle}</h2>
          {letter.files.length === 0 ? (
            <p className="text-muted text-sm">{copy.filesEmpty}</p>
          ) : (
            <div className="space-y-3">
              {letter.files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="panel-soft panel-glass flex items-center justify-between gap-3 rounded-xl p-4 text-sm text-slate-200 hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-200">{file.name}</div>
                    {file.size ? (
                      <div className="text-muted text-xs">{formatFileSize(file.size)}</div>
                    ) : null}
                  </div>
                  <span className="app-pill text-xs">{copy.downloadLabel}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        <section id="notifications" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{copy.notificationsTitle}</h2>
          <p className="text-muted text-sm">{copy.notificationsHint}</p>
          <ApplicantContactForm
            token={params.token}
            initialEmail={letter.applicantEmail}
            initialTelegram={letter.applicantTelegramChatId}
            language={lang}
          />
        </section>

        <section id="next" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">{copy.nextTitle}</h2>
          <div className="space-y-2 text-sm text-slate-200">
            {copy.nextSteps.map((step) => (
              <div key={step} className="panel-soft panel-glass rounded-xl p-3">
                {step}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
