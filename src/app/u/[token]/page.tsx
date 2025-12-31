import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Globe2,
  Shield,
  Crown,
  FileText,
  MessageSquare,
  Clock,
  UserCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d',
  ADMIN: '\u0410\u0434\u043c\u0438\u043d',
  MANAGER: '\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440',
  AUDITOR: '\u0410\u0443\u0434\u0438\u0442\u043e\u0440',
  EMPLOYEE: '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a',
  VIEWER: '\u041d\u0430\u0431\u043b\u044e\u0434\u0430\u0442\u0435\u043b\u044c',
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  SUPERADMIN:
    'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-600/30 text-yellow-100 border border-yellow-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  ADMIN: 'bg-amber-500/20 text-amber-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  AUDITOR: 'bg-purple-500/20 text-purple-400',
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-400',
  VIEWER: 'bg-slate-500/20 text-slate-400',
}

export default async function PublicProfilePage({
  params,
}: {
  params: { token: string }
}) {
  const profile = await prisma.userProfile.findFirst({
    where: {
      publicProfileEnabled: true,
      publicProfileToken: params.token,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          lastLoginAt: true,
          _count: { select: { letters: true, comments: true, sessions: true } },
        },
      },
    },
  })

  if (!profile) {
    notFound()
  }

  const user = profile.user
  const avatarUrl = resolveProfileAssetUrl(profile.avatarUrl)
  const coverUrl = resolveProfileAssetUrl(profile.coverUrl)
  const displayAvatar = avatarUrl || user.image

  const showEmail = profile.publicEmail && user.email
  const showPhone = profile.publicPhone && profile.phone
  const showBio = profile.publicBio && profile.bio
  const showPosition = profile.publicPosition && profile.position
  const showDepartment = profile.publicDepartment && profile.department
  const showLocation = profile.publicLocation && profile.location
  const showTimezone = profile.publicTimezone && profile.timezone
  const showSkills = profile.publicSkills && profile.skills.length > 0
  const showLastLogin = profile.publicLastLogin && user.lastLoginAt

  return (
    <div className="min-h-screen app-shell">
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="panel panel-glass rounded-2xl overflow-hidden">
          <div className="h-32 bg-white/5 border-b border-white/10">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt="Cover"
                width={1200}
                height={320}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-teal-500/10 via-white/5 to-amber-500/10" />
            )}
          </div>
          <div className="p-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                {displayAvatar ? (
                  <Image
                    src={displayAvatar}
                    alt={user.name || user.email || 'User'}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div>
                  <div className="text-lg font-semibold text-white">
                    {user.name || '\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438'}
                  </div>
                  {showEmail && (
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
              >
                {user.role === 'SUPERADMIN' ? (
                  <Crown className="w-3 h-3 text-yellow-200" />
                ) : (
                  <Shield className="w-3 h-3" />
                )}
                {ROLE_LABELS[user.role]}
              </span>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                  <FileText className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                  <div className="text-white">{user._count.letters}</div>
                  <div className="text-gray-500">{'\u041f\u0438\u0441\u044c\u043c\u0430'}</div>
                </div>
                <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                  <MessageSquare className="w-4 h-4 text-blue-300 mx-auto mb-1" />
                  <div className="text-white">{user._count.comments}</div>
                  <div className="text-gray-500">{'\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u044b'}</div>
                </div>
                <div className="panel-soft panel-glass rounded-xl p-2 text-center">
                  <Clock className="w-4 h-4 text-amber-300 mx-auto mb-1" />
                  <div className="text-white">{user._count.sessions}</div>
                  <div className="text-gray-500">{'\u0421\u0435\u0441\u0441\u0438\u0438'}</div>
                </div>
              </div>

              {showLastLogin && (
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434:'} {formatDate(user.lastLoginAt)}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              {showBio && (
                <div>
                  <div className="text-sm text-gray-300 mb-2">
                    {'\u041e \u0441\u0435\u0431\u0435'}
                  </div>
                  <div className="panel-soft panel-glass rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap">
                    {profile.bio}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {showPosition && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c'}</div>
                      <div className="text-sm text-white">{profile.position}</div>
                    </div>
                  </div>
                )}
                {showDepartment && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u041e\u0442\u0434\u0435\u043b'}</div>
                      <div className="text-sm text-white">{profile.department}</div>
                    </div>
                  </div>
                )}
                {showLocation && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u041b\u043e\u043a\u0430\u0446\u0438\u044f'}</div>
                      <div className="text-sm text-white">{profile.location}</div>
                    </div>
                  </div>
                )}
                {showTimezone && (
                  <div className="flex items-start gap-3">
                    <Globe2 className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0427\u0430\u0441\u043e\u0432\u043e\u0439 \u043f\u043e\u044f\u0441'}</div>
                      <div className="text-sm text-white">{profile.timezone}</div>
                    </div>
                  </div>
                )}
                {showPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">{'\u0422\u0435\u043b\u0435\u0444\u043e\u043d'}</div>
                      <div className="text-sm text-white">{profile.phone}</div>
                    </div>
                  </div>
                )}
                {showEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-emerald-400 mt-1" />
                    <div>
                      <div className="text-xs text-gray-400">Email</div>
                      <div className="text-sm text-white">{user.email}</div>
                    </div>
                  </div>
                )}
              </div>

              {showSkills && (
                <div>
                  <div className="text-sm text-gray-300 mb-2">
                    {'\u041d\u0430\u0432\u044b\u043a\u0438'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 rounded-full text-xs bg-white/10 border border-white/10 text-slate-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
