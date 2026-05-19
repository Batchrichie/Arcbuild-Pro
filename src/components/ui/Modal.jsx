import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

const SIZE_CLASSES = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export default function Modal({ open, onClose, title, size = 'md', children, footer, className = '' }) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${SIZE_CLASSES[size] || SIZE_CLASSES.md} max-h-[95vh] overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40 ${className}`}
      >
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="space-y-6">{children}</div>

          {footer && <div className="mt-2 border-t border-white/10 pt-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  )
}
