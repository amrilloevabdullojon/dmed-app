import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем или создаём настройки пользователя
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    })

    // Если настроек нет, создаём с дефолтными значениями
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: session.user.id,
          theme: 'DARK',
          language: 'ru',
          density: 'COMFORTABLE',
          animations: true,
          backgroundAnimations: true,
          pageTransitions: true,
          microInteractions: true,
          listAnimations: true,
          modalAnimations: true,
          scrollAnimations: true,
          wallpaperStyle: 'AURORA',
          wallpaperIntensity: 60,
          snowfall: false,
          particles: false,
          soundNotifications: true,
          desktopNotifications: true,
        },
      })
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Failed to fetch user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Валидация входных данных
    const allowedFields = [
      'theme',
      'language',
      'density',
      'animations',
      'backgroundAnimations',
      'pageTransitions',
      'microInteractions',
      'listAnimations',
      'modalAnimations',
      'scrollAnimations',
      'wallpaperStyle',
      'wallpaperIntensity',
      'snowfall',
      'particles',
      'soundNotifications',
      'desktopNotifications',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    // Обновляем или создаём настройки
    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    })

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
