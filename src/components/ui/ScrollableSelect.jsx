import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

const PANEL_MAX_HEIGHT = 280
const PANEL_MIN_WIDTH = 240
const OPTION_MIN_HEIGHT_PX = 44

function ChevronIcon({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-teal-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function parseAccountLabel(label, value) {
  const text = String(label)
  if (!text.includes(' — ')) return { code: String(value), name: text }
  const [code, ...rest] = text.split(' — ')
  return { code: code.trim(), name: rest.join(' — ').trim() }
}

/**
 * Portal-based dropdown — never clipped by tables/cards.
 * Use for all selects and autocompletes across the portal.
 */
export default function ScrollableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  searchable = false,
  /** 'account' renders code left + name right in the list */
  optionLayout = 'default',
  /** When closed, show raw value (e.g. account code) instead of full label */
  showValueWhenClosed = false,
  className = '',
  searchPlaceholder = 'Search…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelPos, setPanelPos] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const searchRef = useRef(null)
  const listId = useId()

  const selected = options.find((o) => String(o.value) === String(value))

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(
      (o) =>
        String(o.label).toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q)
    )
  }, [options, query, searchable])

  const closedLabel = useMemo(() => {
    if (value === '' || value == null) return null
    if (showValueWhenClosed) return String(value)
    return selected?.label ?? String(value)
  }, [value, selected, showValueWhenClosed])

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow

    setPanelPos({
      left: rect.left,
      width: Math.max(rect.width, PANEL_MIN_WIDTH),
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      transform: openUpward ? 'translateY(-100%)' : undefined,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePanelPosition()
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('resize', updatePanelPosition)
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return undefined
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
      setQuery('')
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, searchable])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pick = (opt) => {
    onChange(opt.value)
    close()
  }

  const triggerCls =
    'flex w-full min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-border-soft bg-surface-2 px-4 py-2.5 text-left text-sm text-text-primary transition focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-50'

  const renderOptionContent = (opt) => {
    if (optionLayout === 'account') {
      const { code, name } = parseAccountLabel(opt.label, opt.value)
      return (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <span className="shrink-0 font-mono text-sm font-medium text-text-primary">{code}</span>
          <span className="min-w-0 truncate text-right text-sm text-text-muted">{name}</span>
        </span>
      )
    }
    return <span className="min-w-0 flex-1 truncate text-sm">{opt.label}</span>
  }

  const panel =
    open && !disabled && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="portal-dropdown-panel dropdown-scroll"
            style={{
              position: 'fixed',
              left: panelPos.left,
              top: panelPos.top,
              width: panelPos.width,
              maxHeight: PANEL_MAX_HEIGHT,
              transform: panelPos.transform,
              zIndex: 10000,
            }}
          >
            {searchable && (
              <div className="border-b border-border-soft p-2">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  className="w-full min-h-10 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filtered[0]) {
                      e.preventDefault()
                      pick(filtered[0])
                    }
                  }}
                />
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              className="m-0 max-h-[min(240px,calc(280px-3.5rem))] list-none overflow-y-auto p-1"
              style={{ maxHeight: searchable ? 'min(240px, calc(280px - 3.5rem))' : PANEL_MAX_HEIGHT - 8 }}
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-text-muted">No results found</li>
              ) : (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value)
                  return (
                    <li key={String(opt.value)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={opt.disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => !opt.disabled && pick(opt)}
                        className={`flex w-full min-h-11 items-center gap-2 rounded-md px-4 py-2 text-left transition hover:bg-surface-overlay focus:bg-surface-overlay focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                          active ? 'bg-teal-500/15 ring-1 ring-teal-400/30' : ''
                        }`}
                        style={{ minHeight: OPTION_MIN_HEIGHT_PX }}
                      >
                        {renderOptionContent(opt)}
                        {active ? <CheckIcon /> : <span className="w-4 shrink-0" aria-hidden />}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null

  return (
    <div className={`min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => {
          if (disabled) return
          if (open) {
            close()
          } else {
            setOpen(true)
            setQuery('')
          }
        }}
        className={triggerCls}
      >
        <span className={`min-w-0 flex-1 truncate ${closedLabel ? 'text-text-primary' : 'text-text-muted'}`}>
          {closedLabel ?? placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>
      {panel}
    </div>
  )
}
