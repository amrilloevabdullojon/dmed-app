'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/hooks/useUserPreferences'

const EnhancedDialog = DialogPrimitive.Root

const EnhancedDialogTrigger = DialogPrimitive.Trigger

const EnhancedDialogPortal = DialogPrimitive.Portal

const EnhancedDialogClose = DialogPrimitive.Close

const EnhancedDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const { preferences } = useUserPreferences()
  const modalAnimationsEnabled = preferences?.modalAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  const shouldAnimate = modalAnimationsEnabled && animationsEnabled

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
        shouldAnimate &&
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
})
EnhancedDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const EnhancedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { preferences } = useUserPreferences()
  const modalAnimationsEnabled = preferences?.modalAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  const shouldAnimate = modalAnimationsEnabled && animationsEnabled

  return (
    <EnhancedDialogPortal>
      <EnhancedDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 rounded-2xl border border-gray-700/60 bg-gray-800/95 p-6 shadow-2xl backdrop-blur-md',
          shouldAnimate &&
            'duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 opacity-70 transition-all hover:bg-gray-700/50 hover:text-white hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </EnhancedDialogPortal>
  )
})
EnhancedDialogContent.displayName = DialogPrimitive.Content.displayName

const EnhancedDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-left', className)}
    {...props}
  />
)
EnhancedDialogHeader.displayName = 'EnhancedDialogHeader'

const EnhancedDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
)
EnhancedDialogFooter.displayName = 'EnhancedDialogFooter'

const EnhancedDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-xl font-semibold leading-none tracking-tight text-white',
      className
    )}
    {...props}
  />
))
EnhancedDialogTitle.displayName = DialogPrimitive.Title.displayName

const EnhancedDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-gray-400', className)}
    {...props}
  />
))
EnhancedDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  EnhancedDialog,
  EnhancedDialogPortal,
  EnhancedDialogOverlay,
  EnhancedDialogTrigger,
  EnhancedDialogClose,
  EnhancedDialogContent,
  EnhancedDialogHeader,
  EnhancedDialogFooter,
  EnhancedDialogTitle,
  EnhancedDialogDescription,
}
