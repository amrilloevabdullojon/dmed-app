'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Report to Sentry in production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      import('@/lib/sentry').then(({ captureException }) => {
        captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
          },
        })
      })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">Что-то пошло не так</h2>
            <p className="mb-6 text-gray-400">
              Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернуться на
              главную.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 rounded-lg bg-gray-800 p-4 text-left">
                <summary className="mb-2 cursor-pointer text-red-400">Детали ошибки</summary>
                <pre className="max-h-40 overflow-auto text-xs text-gray-400">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700"
              >
                <RefreshCw className="h-4 w-4" />
                Попробовать снова
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-white transition hover:bg-gray-600"
              >
                <Home className="h-4 w-4" />
                На главную
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Функциональный компонент-обёртка для удобства
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
