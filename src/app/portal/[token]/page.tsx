import { prisma } from '@/lib/prisma'
import { STATUS_LABELS, formatDate, isDoneStatus } from '@/lib/utils'
import { ApplicantCommentForm } from '@/components/ApplicantCommentForm'

type PageProps = {
  params: { token: string }
}

export default async function ApplicantPortalPage({ params }: PageProps) {
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
    },
  })

  if (!letter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-white">
        <div className="panel panel-glass space-y-3 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-semibold">
            {
              '\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e'
            }
          </h1>
          <p className="text-muted text-sm">
            {
              '\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u0438\u043b\u0438 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0443 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f.'
            }
          </p>
        </div>
      </div>
    )
  }

  if (letter.applicantAccessTokenExpiresAt && letter.applicantAccessTokenExpiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-white">
        <div className="panel panel-glass space-y-3 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-semibold">
            {'\u0421\u0441\u044b\u043b\u043a\u0430 \u0438\u0441\u0442\u0435\u043a\u043b\u0430'}
          </h1>
          <p className="text-muted text-sm">
            {
              '\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0441\u0441\u044b\u043b\u043a\u0438 \u0438\u0441\u0442\u0451\u043a. \u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0443 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f.'
            }
          </p>
        </div>
      </div>
    )
  }

  const isDone = isDoneStatus(letter.status)

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="panel panel-glass rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted text-sm">
                {
                  '\u041f\u043e\u0440\u0442\u0430\u043b \u0437\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f'
                }
              </p>
              <p className="text-2xl font-semibold text-white">
                {'\u041f\u0438\u0441\u044c\u043c\u043e \u2116-'}
                {letter.number}
              </p>
            </div>
            <span
              className={`app-pill text-sm ${
                isDone
                  ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-500/40 bg-slate-600/50 text-slate-200'
              }`}
            >
              {STATUS_LABELS[letter.status]}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="app-pill text-sm" href="#status">
              {'\u0421\u0442\u0430\u0442\u0443\u0441'}
            </a>
            <a className="app-pill text-sm" href="#comments">
              {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438'}
            </a>
          </div>
        </div>

        <section id="status" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">
            {'\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u0438\u0441\u044c\u043c\u0430'}
          </h2>
          <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <div>
              <span className="text-muted">
                {'\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f:'}
              </span>{' '}
              {letter.org}
            </div>
            <div>
              <span className="text-muted">
                {'\u0414\u0430\u0442\u0430 \u043f\u0438\u0441\u044c\u043c\u0430:'}
              </span>{' '}
              {formatDate(letter.date)}
            </div>
            <div>
              <span className="text-muted">{'\u0414\u0435\u0434\u043b\u0430\u0439\u043d:'}</span>{' '}
              {formatDate(letter.deadlineDate)}
            </div>
            <div>
              <span className="text-muted">
                {'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c:'}
              </span>{' '}
              {letter.owner?.name ||
                letter.owner?.email ||
                '\u041d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d'}
            </div>
          </div>
        </section>

        <section id="comments" className="panel panel-glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">
            {'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438'}
          </h2>
          {letter.comments.length === 0 ? (
            <p className="text-muted text-sm">
              {
                '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432.'
              }
            </p>
          ) : (
            <div className="space-y-4">
              {letter.comments.map((comment) => (
                <div key={comment.id} className="panel-soft panel-glass rounded-xl p-4">
                  <div className="text-muted flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {comment.author?.name ||
                        comment.author?.email ||
                        '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a'}
                    </span>
                    <span>{new Date(comment.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{comment.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="app-divider" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold">
              {
                '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'
              }
            </h3>
            <p className="text-muted text-sm">
              {
                '\u0412\u0430\u0448 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0443\u0432\u0438\u0434\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c \u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u0432 \u044d\u0442\u043e\u043c \u0436\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0435.'
              }
            </p>
            <ApplicantCommentForm token={params.token} />
          </div>
        </section>
      </div>
    </div>
  )
}
