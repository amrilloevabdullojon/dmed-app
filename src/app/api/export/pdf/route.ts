import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { STATUS_LABELS, formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger.server'

export const dynamic = 'force-dynamic'

/**
 * Generates PDF-ready HTML for a single letter
 */
function generateLetterHTML(letter: {
  number: string
  org: string
  date: Date
  deadlineDate: Date | null
  status: string
  type: string | null
  content: string | null
  answer: string | null
  comment: string | null
  owner?: { name: string | null; email: string | null } | null
}) {
  const statusLabel = STATUS_LABELS[letter.status as keyof typeof STATUS_LABELS] || letter.status

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Письмо ${letter.number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #333;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 18pt;
          color: #1e40af;
          margin-bottom: 8px;
        }
        .header .org {
          font-size: 14pt;
          color: #4b5563;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 30px;
          padding: 15px;
          background: #f3f4f6;
          border-radius: 8px;
        }
        .meta-item {
          min-width: 150px;
        }
        .meta-label {
          font-size: 10pt;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .meta-value {
          font-size: 12pt;
          font-weight: 600;
          color: #111827;
        }
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 11pt;
        }
        .status-done { background: #d1fae5; color: #065f46; }
        .status-progress { background: #dbeafe; color: #1e40af; }
        .status-overdue { background: #fee2e2; color: #991b1b; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 11pt;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e5e7eb;
        }
        .section-content {
          color: #4b5563;
          white-space: pre-wrap;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 10pt;
          color: #9ca3af;
          text-align: center;
        }
        @media print {
          body { padding: 20px; }
          .header { page-break-after: avoid; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Письмо №${escapeHtml(letter.number)}</h1>
        <div class="org">${escapeHtml(letter.org)}</div>
      </div>

      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Дата письма</div>
          <div class="meta-value">${formatDate(letter.date)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Дедлайн</div>
          <div class="meta-value">${letter.deadlineDate ? formatDate(letter.deadlineDate) : '—'}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Статус</div>
          <div class="meta-value">
            <span class="status ${getStatusClass(letter.status)}">${statusLabel}</span>
          </div>
        </div>
        ${
          letter.type
            ? `
        <div class="meta-item">
          <div class="meta-label">Тип</div>
          <div class="meta-value">${escapeHtml(letter.type)}</div>
        </div>
        `
            : ''
        }
        ${
          letter.owner
            ? `
        <div class="meta-item">
          <div class="meta-label">Ответственный</div>
          <div class="meta-value">${escapeHtml(letter.owner.name || letter.owner.email || 'Не указан')}</div>
        </div>
        `
            : ''
        }
      </div>

      ${
        letter.content
          ? `
      <div class="section">
        <div class="section-title">Содержание</div>
        <div class="section-content">${escapeHtml(letter.content)}</div>
      </div>
      `
          : ''
      }

      ${
        letter.answer
          ? `
      <div class="section">
        <div class="section-title">Ответ</div>
        <div class="section-content">${escapeHtml(letter.answer)}</div>
      </div>
      `
          : ''
      }

      ${
        letter.comment
          ? `
      <div class="section">
        <div class="section-title">Комментарий</div>
        <div class="section-content">${escapeHtml(letter.comment)}</div>
      </div>
      `
          : ''
      }

      <div class="footer">
        Документ сформирован ${new Date().toLocaleString('ru-RU')}
      </div>
    </body>
    </html>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'DONE':
    case 'READY':
      return 'status-done'
    case 'IN_PROGRESS':
    case 'ACCEPTED':
      return 'status-progress'
    case 'CLARIFICATION':
      return 'status-pending'
    default:
      return 'status-pending'
  }
}

// GET /api/export/pdf?id=xxx - экспорт письма в PDF (HTML для печати)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Letter ID is required' }, { status: 400 })
    }

    const letter = await prisma.letter.findUnique({
      where: { id },
      include: {
        owner: {
          select: { name: true, email: true },
        },
      },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const html = generateLetterHTML(letter)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    logger.error('GET /api/export/pdf', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
