'use client'

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'

export interface ParsedAddress {
  addressLine1: string
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
}

interface Suggestion {
  placeId: string
  mainText: string
  secondaryText: string
  fullText: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (parsed: ParsedAddress) => void
  placeholder?: string
  required?: boolean
  inputClassName?: string
  inputStyle?: React.CSSProperties
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  id?: string
}

export default function AddressAutocompleteInput({
  value, onChange, onPlaceSelect, placeholder, required,
  inputClassName, inputStyle, onFocus, onBlur, id,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipFetchRef = useRef(false) // set true after selecting so we don't re-fetch

  // Reposition dropdown whenever it opens or window scrolls/resizes
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return
    function reposition() {
      if (!inputRef.current) return
      const r = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`)
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setOpen((data.suggestions ?? []).length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(val: string) {
    onChange(val)
    if (skipFetchRef.current) { skipFetchRef.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  async function handleSelect(suggestion: Suggestion) {
    skipFetchRef.current = true
    onChange(suggestion.mainText)
    setOpen(false)
    setSuggestions([])

    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`)
      const parsed = await res.json()
      if (parsed.addressLine1 !== undefined) {
        onPlaceSelect(parsed as ParsedAddress)
      }
    } catch {
      // silently ignore — user can fill remaining fields manually
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />

      {open && suggestions.length > 0 && dropdownRect && (
        <ul
          style={{
            position: 'fixed',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #E4EAF0',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(13,27,42,0.10)',
            padding: '4px',
            margin: 0,
            listStyle: 'none',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                cursor: 'pointer',
                background: i === activeIndex ? '#F0FDFA' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#0D1B2A', display: 'block' }}>
                {s.mainText}
              </span>
              <span style={{ fontSize: '12px', color: '#5B6B80' }}>
                {s.secondaryText}
              </span>
            </li>
          ))}
          <li style={{ padding: '6px 12px 4px', borderTop: '1px solid #F1F5F9', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Powered by Google</span>
          </li>
        </ul>
      )}

      {loading && (
        <div style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          width: '14px', height: '14px', borderRadius: '50%',
          border: '2px solid #E4EAF0', borderTopColor: '#0D9488',
          animation: 'spin 0.6s linear infinite',
          pointerEvents: 'none',
        }} />
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
