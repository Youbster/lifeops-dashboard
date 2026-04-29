import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Mic, MicOff, Search, Plus, Check, Trash2, Pencil, X,
  ChevronDown, ChevronRight, AlertTriangle, Target,
  Calendar, Clock, Lightbulb, Settings, Sparkles, Loader2, Eye, EyeOff
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeops_tasks'
const AI_KEY_STORAGE = 'lifeops_api_key'

const CATEGORIES = [
  { id: 'work',       label: 'Work',        color: '#3B82F6' },
  { id: 'personal',   label: 'Personal',    color: '#10B981' },
  { id: 'money',      label: 'Money',       color: '#F59E0B' },
  { id: 'car',        label: 'Car',         color: '#8B5CF6' },
  { id: 'house',      label: 'House',       color: '#EC4899' },
  { id: 'shopping',   label: 'Shopping',    color: '#06B6D4' },
  { id: 'sidehustle', label: 'Side Hustle', color: '#EF4444' },
  { id: 'people',     label: 'People',      color: '#14B8A6' },
  { id: 'ideas',      label: 'Ideas',       color: '#A78BFA' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))
const PRIORITIES = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function classifyTask(task) {
  if (!task.dueDate) return 'upcoming'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(task.dueDate + 'T00:00:00')
  const diff = Math.floor((due - today) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'week'
  return 'upcoming'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((date - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)} days ago`
  if (diff <= 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── AI Parser ───────────────────────────────────────────────────────────────

function validateParsed(parsed, fallbackText) {
  const validCats = CATEGORIES.map(c => c.id)
  return {
    title: String(parsed.title || fallbackText).trim() || fallbackText,
    category: validCats.includes(parsed.category) ? parsed.category : 'personal',
    dueDate: parsed.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate) ? parsed.dueDate : null,
    priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
    type: ['todo', 'idea', 'purchase', 'follow-up', 'project'].includes(parsed.type) ? parsed.type : 'todo',
  }
}

async function parseWithAI(text, apiKey) {
  const today = new Date()
  const todayStr = toLocalDateStr(today)
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })

  // ── Try the Vercel proxy first (production + vercel dev) ──
  // Same-origin call → no CORS, API key stays server-side
  try {
    const resp = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, todayStr, dayName, apiKey }),
    })
    if (resp.ok) return validateParsed(await resp.json(), text)
    if (resp.status !== 404) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
      throw new Error(err.error || `HTTP ${resp.status}`)
    }
    // 404 = no proxy endpoint (plain npm run dev) → fall through to direct call
  } catch (e) {
    if (!e.message.includes('404') && !/fetch|failed to fetch|load failed/i.test(e.message)) throw e
  }

  // ── Fallback: direct browser call (local dev only) ──
  if (!apiKey) throw new Error('No API key — enter one in ✦ settings')

  const system = `You are a personal task parser. Extract structured info from natural language.
Today is ${todayStr} (${dayName}).
Return ONLY valid JSON: title (clean imperative, strip all filler/preamble), category (work|personal|money|car|house|shopping|sidehustle|people|ideas), dueDate (YYYY-MM-DD or null), priority (high|medium|low), type (todo|idea|purchase|follow-up|project).
Title rules: strip "ok", "so", "um", "I need to", "I should", "I want to", "remember to", "actually", "basically". Use imperative verb. Max 60 chars.`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: text }],
    }),
  })

  if (!resp.ok) throw new Error(`API ${resp.status}`)
  const data = await resp.json()
  const raw = data.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  return validateParsed(JSON.parse(raw), text)
}

// ─── Regex Fallback Parser ────────────────────────────────────────────────────

function parseNaturalInput(text) {
  const lower = text.toLowerCase().trim()
  let title = text.trim()
  let category = null
  let dueDate = null
  let priority = 'medium'
  let type = 'todo'

  if (/\b(urgent|asap|important|critical|high priority)\b/i.test(lower)) {
    priority = 'high'
    title = title.replace(/\b(urgent|asap|important|critical|high priority)\b/gi, '').trim()
  } else if (/\b(low priority|not urgent|whenever|no rush)\b/i.test(lower)) {
    priority = 'low'
    title = title.replace(/\b(low priority|not urgent|whenever|no rush)\b/gi, '').trim()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const datePatterns = [
    { regex: /\btoday\b/i,            calc: () => new Date(today) },
    { regex: /\btonight\b/i,          calc: () => new Date(today) },
    { regex: /\btomorrow\b/i,         calc: () => { const d = new Date(today); d.setDate(d.getDate() + 1); return d } },
    { regex: /\bday after tomorrow\b/i, calc: () => { const d = new Date(today); d.setDate(d.getDate() + 2); return d } },
    { regex: /\bthis week\b/i,        calc: () => { const d = new Date(today); d.setDate(d.getDate() + (7 - d.getDay())); return d } },
    { regex: /\bnext week\b/i,        calc: () => { const d = new Date(today); d.setDate(d.getDate() + 7); return d } },
    { regex: /\bnext month\b/i,       calc: () => { const d = new Date(today); d.setMonth(d.getMonth() + 1); return d } },
    { regex: /\bend of week\b/i,      calc: () => { const d = new Date(today); d.setDate(d.getDate() + (7 - d.getDay())); return d } },
    { regex: /\bend of month\b/i,     calc: () => { const d = new Date(today); d.setMonth(d.getMonth() + 1, 0); return d } },
    { regex: /\bin (\d+) days?\b/i,   calc: (m) => { const d = new Date(today); d.setDate(d.getDate() + parseInt(m[1])); return d } },
    { regex: /\bin (\d+) weeks?\b/i,  calc: (m) => { const d = new Date(today); d.setDate(d.getDate() + parseInt(m[1]) * 7); return d } },
    { regex: /\bin (\d+) months?\b/i, calc: (m) => { const d = new Date(today); d.setMonth(d.getMonth() + parseInt(m[1])); return d } },
  ]

  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  dayNames.forEach((day, idx) => {
    datePatterns.push({
      regex: new RegExp(`\\b(this )?${day}\\b`, 'i'),
      calc: () => {
        const d = new Date(today); const cur = d.getDay()
        let diff = idx - cur; if (diff <= 0) diff += 7
        d.setDate(d.getDate() + diff); return d
      }
    })
    datePatterns.push({
      regex: new RegExp(`\\bnext ${day}\\b`, 'i'),
      calc: () => {
        const d = new Date(today); const cur = d.getDay()
        let diff = idx - cur; if (diff <= 0) diff += 7; diff += 7
        d.setDate(d.getDate() + diff); return d
      }
    })
  })

  for (const p of datePatterns) {
    const m = lower.match(p.regex)
    if (m) {
      dueDate = toLocalDateStr(p.calc(m))
      title = title.replace(p.regex, '').trim()
      break
    }
  }

  const catKw = {
    work:       /\b(work|office|meeting|report|deadline|presentation|email|boss|colleague|project plan|sprint|standup|client)\b/i,
    personal:   /\b(personal|self|health|gym|exercise|workout|doctor|dentist|meditat|journal|haircut|appointment)\b/i,
    money:      /\b(money|pay|rent|bill|invoice|budget|savings?|invest|tax|bank|transfer|salary|expense|financial)\b/i,
    car:        /\b(car|vehicle|gas|fuel|oil change|tire|mechanic|parking|insurance|registration|drive|wash car)\b/i,
    house:      /\b(house|home|clean|fix|repair|bathroom|kitchen|bedroom|garage|lawn|garden|plumb|light|roof|paint|furniture|appliance)\b/i,
    shopping:   /\b(buy|shop|order|grocery|groceries|store|amazon|pickup|milk|bread|eggs|supplies|purchase)\b/i,
    sidehustle: /\b(side hustle|freelance|gig|youtube|podcast|blog|etsy|shopify|startup|launch|monetize|passive income|content)\b/i,
    people:     /\b(call|text|message|mom|dad|brother|sister|friend|family|birthday|anniversary|catch up|visit|meet|dinner with|lunch with|coffee with)\b/i,
    ideas:      /\b(idea|think about|maybe|concept|brainstorm|explore|research|consider|what if|could we|prototype|experiment)\b/i,
  }
  for (const [id, rx] of Object.entries(catKw)) {
    if (rx.test(lower)) { category = id; break }
  }
  if (!category) category = 'personal'

  if (/\b(idea|concept|brainstorm|what if)\b/i.test(lower)) type = 'idea'
  else if (/\b(buy|order|purchase|shop)\b/i.test(lower)) type = 'purchase'
  else if (/\b(follow up|check in|remind|ping|ask about)\b/i.test(lower)) type = 'follow-up'
  else if (/\b(project|build|create|develop|launch|start)\b/i.test(lower)) type = 'project'

  // Strip filler preambles — two passes to catch cascading residues
  const fillers = [
    /^(ok\s*,?\s*so\s*,?\s*)+/i,
    /^(ok\s*,?\s*)+/i,
    /^(so\s*,?\s*)+/i,
    /^(um+|uh+|err+|hmm+|ah+|right)\s*,?\s*/i,
    /\b(I\s+need\s+to\s+be\s+able\s+to|I\s+think\s+I\s+(?:need|should)\s+to|I\s+was\s+thinking\s+(?:I\s+should\s+)?)\s*/gi,
    /\b(I\s+(?:need|want|have|should|must)\s+to|remember\s+to|don't\s+forget\s+to|make\s+sure\s+to|gotta|gonna)\s*/gi,
    /\b(so\s+basically|basically|actually|literally|you\s+know|I\s+mean)\s*/gi,
    /^be\s+able\s+to\s+/i,   // catches "be able to …" left after stripping preamble
    /^(some\s+)?/i,          // catches leading "some " (e.g. "some grocery shopping")
  ]
  for (let pass = 0; pass < 2; pass++) {
    for (const rx of fillers) title = title.replace(rx, '').trimStart()
  }
  title = title.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '')
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1)
  if (!title) title = text.trim()

  return { title, category, dueDate, priority, type }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useTasks() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const addTask = useCallback((parsed) => {
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ...parsed,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [task, ...prev])
    return task
  }, [])

  const toggleTask  = useCallback((id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)), [])
  const deleteTask  = useCallback((id) => setTasks(prev => prev.filter(t => t.id !== id)), [])
  const updateTask  = useCallback((id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)), [])

  return { tasks, addTask, toggleTask, deleteTask, updateTask }
}

function useVoiceInput() {
  const [isListening, setIsListening]   = useState(false)
  const [isSupported, setIsSupported]   = useState(true)
  const [liveText, setLiveText]         = useState('')
  const recRef          = useRef(null)
  const shouldKeepRef   = useRef(false)   // true while user wants to keep recording
  const accumulatedRef  = useRef('')      // confirmed finals across restarts

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setIsSupported(false); return }

    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const word = e.results[i][0].transcript.trim()
          accumulatedRef.current = accumulatedRef.current
            ? accumulatedRef.current + ' ' + word
            : word
        } else {
          interim += e.results[i][0].transcript
        }
      }
      const display = [accumulatedRef.current, interim].filter(Boolean).join(' ')
      setLiveText(display)
    }

    rec.onerror = (e) => {
      // 'no-speech' is harmless in continuous mode — ignore it
      if (e.error === 'no-speech' || e.error === 'aborted') return
      shouldKeepRef.current = false
      setIsListening(false)
    }

    // iOS Safari stops recognition on silence even with continuous=true.
    // Auto-restart keeps the session alive until the user explicitly stops.
    rec.onend = () => {
      if (shouldKeepRef.current) {
        try { rec.start() } catch {}
      } else {
        setIsListening(false)
      }
    }

    recRef.current = rec
    return () => { shouldKeepRef.current = false; try { rec.stop() } catch {} }
  }, [])

  const start = useCallback(() => {
    if (!recRef.current) return
    accumulatedRef.current = ''
    setLiveText('')
    shouldKeepRef.current = true
    setIsListening(true)
    try { recRef.current.start() } catch {}
  }, [])

  // Returns the final captured text so QuickCapture can put it in the input
  const stop = useCallback(() => {
    shouldKeepRef.current = false
    try { recRef.current?.stop() } catch {}
    setIsListening(false)
    const result = accumulatedRef.current
    accumulatedRef.current = ''
    setLiveText('')
    return result
  }, [])

  return { isListening, isSupported, liveText, start, stop }
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((message, variant = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, variant, exiting: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250)
    }, 2500)
  }, [])
  return { toasts, add }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ apiKey, onSave, onClose }) {
  const [draft, setDraft] = useState(apiKey)
  const [show, setShow]   = useState(false)

  return (
    <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-5 animate-slide-down">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">AI Smart Parsing</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        <span className="text-green-400 font-medium">✓ AI is active</span> — the server API key is set on Vercel.
        You can optionally enter a personal key here to override it, or leave blank. Key is stored only on this device.
      </p>

      <div className="relative mb-3">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-4 pr-12
            text-white placeholder-slate-500 text-sm font-mono
            focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { onSave(draft.trim()); onClose() }}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium
            rounded-xl py-2.5 transition-all duration-200 active:scale-95"
        >
          {draft.trim() ? 'Save & Enable AI' : 'Save'}
        </button>
        {apiKey && (
          <button
            onClick={() => { onSave(''); onClose() }}
            className="px-4 bg-white/5 hover:bg-white/10 text-slate-400 text-sm
              rounded-xl py-2.5 transition-all duration-200"
          >
            Remove
          </button>
        )}
      </div>

      {draft.trim() && (
        <p className="text-[11px] text-slate-500 mt-3 text-center">
          Uses <span className="text-slate-400">claude-haiku-4-5</span> · ~$0.0001 per capture · API key never leaves your device
        </p>
      )}
    </div>
  )
}

// ─── Quick Capture ────────────────────────────────────────────────────────────

function QuickCapture({ onAdd, addToast, apiKey }) {
  const [input, setInput]         = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const inputRef = useRef(null)

  const { isListening, isSupported, liveText, start, stop } = useVoiceInput()

  // Mirror live voice text into the input field while recording
  useEffect(() => {
    if (isListening) setInput(liveText)
  }, [isListening, liveText])

  const handleMicClick = () => {
    if (isListening) {
      const captured = stop()
      // Put final text in input so user can review/edit before submitting
      setInput(captured || '')
      inputRef.current?.focus()
    } else {
      setInput('')
      start()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // If still recording, stop first and use what was captured
    if (isListening) { stop(); return }
    const trimmed = input.trim()
    if (!trimmed || isParsing) return

    setIsParsing(true)
    setInput('')

    let parsed
    let usedAI = false

    let aiError = null
    try {
      parsed = await parseWithAI(trimmed, apiKey)
      usedAI = true
    } catch (err) {
      const msg = err.message || String(err)
      console.error('[LifeOps AI]', msg)
      if (msg.includes('No API key')) {
        // No server key and no local key — silent fallback, no toast
      } else if (msg.includes('401')) aiError = 'Invalid API key — update it in ✦ settings'
      else if (msg.includes('429')) aiError = 'Rate limited — try again in a moment'
      else if (msg.includes('403')) aiError = 'Key lacks permission — check Anthropic Console'
      else if (/fetch|network|load failed|failed to/i.test(msg)) aiError = 'Network error'
      else aiError = msg.slice(0, 60)
      parsed = parseNaturalInput(trimmed)
    }

    setIsParsing(false)
    onAdd(parsed)
    if (aiError) {
      addToast(`⚠ ${aiError}`, 'error')
    } else {
      addToast(`${usedAI ? '✦ AI' : '✓'} Captured → ${CATEGORY_MAP[parsed.category]?.label || parsed.category}`)
    }
    inputRef.current?.focus()
  }

  const hasAI = true // server always has ANTHROPIC_API_KEY

  // Right-side padding: enough room for mic + optional AI badge
  const inputPr = isSupported ? (hasAI ? 'pr-24' : 'pr-12') : (hasAI ? 'pr-16' : 'pr-4')

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { if (!isListening) setInput(e.target.value) }}
            placeholder={hasAI ? 'Say anything — AI will understand…' : 'Quick capture — type or speak anything…'}
            disabled={isParsing}
            readOnly={isListening}
            className={`w-full bg-white/10 border rounded-2xl py-4 px-5 ${inputPr}
              text-white placeholder-slate-400 text-base
              focus:outline-none focus:ring-2 transition-all duration-200
              disabled:opacity-60
              ${isListening
                ? 'border-red-500/50 ring-2 ring-red-500/20'
                : hasAI
                  ? 'border-purple-500/20 focus:border-purple-500/50 focus:ring-purple-500/20'
                  : 'border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20'}`}
          />

          {/* Right-side controls */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSupported && (
              <button
                type="button"
                onClick={handleMicClick}
                className={`p-2 rounded-full transition-all duration-200
                  ${isListening
                    ? 'bg-red-500 text-white recording-dot'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            {hasAI && !isListening && (
              <span className="flex items-center gap-1 text-[10px] font-semibold
                text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                <Sparkles size={10} /> AI
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={(!input.trim() && !isListening) || isParsing}
          className={`text-white rounded-2xl p-4 transition-all duration-200 flex-shrink-0 active:scale-95
            ${isParsing
              ? 'bg-purple-600/70 cursor-wait'
              : hasAI
                ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500'
                : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500'}`}
        >
          {isParsing ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
        </button>
      </div>

      {isListening && (
        <p className="mt-2 text-center text-sm text-red-400">
          <span className="animate-pulse">●</span> Recording — tap mic to stop, then press +
        </p>
      )}
      {isParsing && (
        <p className="mt-2 text-center text-xs text-purple-400 animate-pulse">AI is thinking…</p>
      )}
    </form>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete, onUpdate }) {
  const [isEditing, setIsEditing]   = useState(false)
  const [editTitle, setEditTitle]   = useState(task.title)
  const [showActions, setShowActions] = useState(false)
  const cat    = CATEGORY_MAP[task.category] || CATEGORIES[0]
  const bucket = classifyTask(task)

  const handleSave = () => {
    if (editTitle.trim()) onUpdate(task.id, { title: editTitle.trim() })
    setIsEditing(false)
  }

  return (
    <div
      className={`group relative bg-white/5 border border-white/5 rounded-xl overflow-hidden
        transition-all duration-200 hover:bg-white/[0.07] hover:border-white/10
        ${task.completed ? 'opacity-50' : ''} animate-fade-in`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
    >
      <div className="h-1" style={{ backgroundColor: cat.color }} />

      <div className="p-4 flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id)}
          className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
            transition-all duration-200
            ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-emerald-400'}`}
        >
          {task.completed && <Check size={14} className="text-white animate-checkmark" />}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false) }}
                className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300 p-1"><Check size={16} /></button>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-300 p-1"><X size={16} /></button>
            </div>
          ) : (
            <p className={`text-sm leading-relaxed ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
              {task.title}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cat.color + '22', color: cat.color }}>
              {cat.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITIES[task.priority] }} />
              <span className="text-[11px] text-slate-500 capitalize">{task.priority}</span>
            </span>
            {task.dueDate && (
              <span className={`text-[11px] flex items-center gap-1 ${bucket === 'overdue' ? 'text-red-400' : 'text-slate-500'}`}>
                <Calendar size={11} />
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.type !== 'todo' && (
              <span className="text-[11px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded capitalize">
                {task.type}
              </span>
            )}
          </div>
        </div>

        <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-200
          ${showActions ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'}`}>
          <button
            onClick={() => { setIsEditing(true); setEditTitle(task.title) }}
            className="p-2 text-slate-500 hover:text-blue-400 rounded-lg hover:bg-white/5 transition-colors"
          ><Pencil size={14} /></button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
          ><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Section ─────────────────────────────────────────────────────────────

function TaskSection({ title, icon: Icon, tasks, color, badge, onToggle, onDelete, onUpdate, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 w-full text-left mb-3">
        {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
        <Icon size={16} style={{ color }} />
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color }}>{title}</span>
        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{tasks.length}</span>
        {badge && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle size={11} /> {badge}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="space-y-2 animate-slide-down">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({ search, setSearch, activeCategory, setActiveCategory, statusFilter, setStatusFilter }) {
  return (
    <div className="mb-6 space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4
            text-white placeholder-slate-500 text-sm focus:outline-none focus:border-white/10
            focus:ring-1 focus:ring-white/5 transition-all duration-200"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0
            ${!activeCategory ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
        >All</button>
        {CATEGORIES.map(cat => (
          <button key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0"
            style={activeCategory === cat.id
              ? { backgroundColor: cat.color + '33', color: cat.color }
              : { backgroundColor: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}
          >{cat.label}</button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {[{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'completed', l: 'Completed' }].map(f => (
          <button key={f.k} onClick={() => setStatusFilter(f.k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${statusFilter === f.k ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >{f.l}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Insights Panel ───────────────────────────────────────────────────────────

function InsightsPanel({ tasks }) {
  const active      = tasks.filter(t => !t.completed)
  const todayCount  = active.filter(t => classifyTask(t) === 'today').length
  const overdueCount = active.filter(t => classifyTask(t) === 'overdue').length
  const pct = tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/10">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Target size={15} className="text-blue-400" />
          <span className="text-slate-300"><span className="text-white font-semibold">{todayCount}</span> today</span>
        </span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="text-amber-300"><span className="font-semibold">{overdueCount}</span> overdue</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Check size={15} className="text-emerald-400" />
          <span className="text-slate-300"><span className="text-white font-semibold">{pct}%</span> complete</span>
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400 text-xs">
          {active.length === 0 ? 'All clear! Add something.' :
           overdueCount > 0 ? 'Handle overdue items first.' :
           todayCount > 0 ? 'Focus on today.' : "You're on track!"}
        </span>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-5 py-3 rounded-xl text-sm font-medium shadow-2xl backdrop-blur-sm
            ${t.variant === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}
            ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
        >{t.message}</div>
      ))}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { tasks, addTask, toggleTask, deleteTask, updateTask } = useTasks()
  const { toasts, add: addToast } = useToast()

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(AI_KEY_STORAGE) || '')
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch]             = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [statusFilter, setStatusFilter]     = useState('all')

  const saveApiKey = useCallback((key) => {
    setApiKey(key)
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  }, [])

  const handleDelete = useCallback((id) => {
    deleteTask(id); addToast('Task deleted', 'error')
  }, [deleteTask, addToast])

  const handleToggle = useCallback((id) => {
    const task = tasks.find(t => t.id === id)
    toggleTask(id)
    addToast(task?.completed ? 'Task reopened' : '✓ Task completed!')
  }, [tasks, toggleTask, addToast])

  const filtered = useMemo(() => {
    let r = tasks
    if (search) { const q = search.toLowerCase(); r = r.filter(t => t.title.toLowerCase().includes(q) || t.category.includes(q)) }
    if (activeCategory) r = r.filter(t => t.category === activeCategory)
    if (statusFilter === 'active') r = r.filter(t => !t.completed)
    else if (statusFilter === 'completed') r = r.filter(t => t.completed)
    return r
  }, [tasks, search, activeCategory, statusFilter])

  const sections = useMemo(() => {
    const a = filtered.filter(t => !t.completed)
    return {
      overdue:   a.filter(t => classifyTask(t) === 'overdue'),
      today:     a.filter(t => classifyTask(t) === 'today'),
      week:      a.filter(t => classifyTask(t) === 'week'),
      upcoming:  a.filter(t => classifyTask(t) === 'upcoming'),
      completed: filtered.filter(t => t.completed),
    }
  }, [filtered])

  const sharedSectionProps = { onToggle: handleToggle, onDelete: handleDelete, onUpdate: updateTask }

  return (
    <div className="min-h-screen min-h-[100dvh] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Header */}
        <header className="text-center mb-8 relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            LifeOps
          </h1>
          <p className="text-slate-500 text-sm mt-1">Your personal command center</p>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`absolute right-0 top-0 p-2 rounded-xl transition-all duration-200
              ${showSettings ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}
              ${apiKey ? 'text-purple-400' : ''}`}
            title="AI Settings"
          >
            {apiKey ? <Sparkles size={18} /> : <Settings size={18} />}
          </button>
        </header>

        {showSettings && (
          <SettingsPanel apiKey={apiKey} onSave={saveApiKey} onClose={() => setShowSettings(false)} />
        )}

        <InsightsPanel tasks={tasks} />
        <QuickCapture onAdd={addTask} addToast={addToast} apiKey={apiKey} />
        <FilterBar
          search={search} setSearch={setSearch}
          activeCategory={activeCategory} setActiveCategory={setActiveCategory}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        />

        <TaskSection title="Overdue"    icon={AlertTriangle} tasks={sections.overdue}   color="#EF4444"
          badge={sections.overdue.length > 0 ? `${sections.overdue.length} overdue` : null} {...sharedSectionProps} />
        <TaskSection title="Today"      icon={Target}         tasks={sections.today}    color="#3B82F6" {...sharedSectionProps} />
        <TaskSection title="This Week"  icon={Calendar}       tasks={sections.week}     color="#8B5CF6" {...sharedSectionProps} />
        <TaskSection title="Upcoming"   icon={Clock}          tasks={sections.upcoming} color="#06B6D4" {...sharedSectionProps} />
        {statusFilter !== 'active' && sections.completed.length > 0 && (
          <TaskSection title="Completed" icon={Check} tasks={sections.completed} color="#10B981" defaultOpen={false} {...sharedSectionProps} />
        )}

        {tasks.length === 0 && (
          <div className="text-center py-16">
            <Lightbulb size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg mb-2">No tasks yet</p>
            <p className="text-slate-600 text-sm max-w-xs mx-auto">
              {apiKey
                ? 'AI is ready. Say anything — "I need to call the dentist before end of week" works perfectly.'
                : 'Try: "Buy milk tomorrow" or "Call mom Friday urgent" or "Fix bathroom light"'}
            </p>
          </div>
        )}

        {tasks.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12">
            <Search size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No matching tasks</p>
          </div>
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  )
}
