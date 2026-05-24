import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const WIDTH_CLASSES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  full: 'max-w-[42rem]',
}

/**
 * Standard right slide-over (z-index 60 backdrop / 70 panel per portal stack).
 */
export default function SlideOver({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'full',
  className = '',
}) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <button
        type="button"
        className="portal-slide-over-backdrop"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={`portal-slide-over-panel p-4 sm:p-6 ${WIDTH_CLASSES[width] || WIDTH_CLASSES.full} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'slide-over-title' : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 id="slide-over-title" className="portal-h2">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-touch shrink-0 rounded-full border border-border-soft bg-portal-inset px-4 py-2 text-sm text-portal-muted-strong transition hover:bg-portal-overlay"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        {footer && <div className="mt-6 border-t border-border-soft pt-4">{footer}</div>}
      </aside>
    </>,
    document.body
  )
}
