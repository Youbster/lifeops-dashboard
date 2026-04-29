import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Mic, MicOff, Search, Plus, Check, Trash2, Pencil, X,
  ChevronDown, ChevronRight, AlertTriangle, Target,
  Calendar, Clock, Lightbulb, Settings, Sparkles, Loader2, Eye, EyeOff,
  TrendingUp, BarChart2, Zap, ListTodo, ChevronUp, BookOpen, CheckSquare, Square
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
const DURATION_LABELS = { quick: '< 5 min', '30m': '30 min', '1h': '1 hour', '2h': '2 hours', 'half-day': 'Half day' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToLocalDate(iso) {
  return toLocalDateStr(new Date(iso))
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
  if (diff < -1) return `${Math.abs(diff)}d ago`
  if (diff <= 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── AI Parser ───────────────────────────────────────────────────────────────

function validateParsed(parsed, fallbackText) {
  const validCats = CATEGORIES.map(c => c.id)
  const validDurations = ['quick', '30m', '1h', '2h', 'half-day']

  let subtasks = []
  if (Array.isArray(parsed.subtasks)) {
    subtasks = parsed.subtasks
      .filter(s => typeof s === 'string' && s.trim())
      .slice(0, 6)
      .map((text, i) => ({ id: `st_${Date.now()}_${i}`, text: text.trim(), done: false }))
  }

  return {
    title:    String(parsed.title || fallbackText).trim() || fallbackText,
    category: validCats.includes(parsed.category) ? parsed.category : 'personal',
    dueDate:  parsed.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate) ? parsed.dueDate : null,
    priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
    type:     ['todo', 'idea', 'purchase', 'follow-up', 'project'].includes(parsed.type) ? parsed.type : 'todo',
    notes:    typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 300) : '',
    duration: validDurations.includes(parsed.duration) ? parsed.duration : null,
    subtasks,
  }
}

async function parseWithAI(text, apiKey) {
  const today = new Date()
  const todayStr = toLocalDateStr(today)
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })

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
  } catch (e) {
    if (!e.message.includes('404') && !/fetch|failed to fetch|load failed/i.test(e.message)) throw e
  }

  throw new Error('No API key — enter one in ✦ settings')
}

// ─── Regex Fallback Parser ────────────────────────────────────────────────────

function parseNaturalInput(text) {
  const lower = text.toLowerCase().trim()
  let title    = text.trim()
  let dueDate  = null
  let priority = 'medium'
  let category = null
  let type     = 'todo'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const datePatterns = [
    { rx: /\b(today)\b/i,     calc: () => new Date(today) },
    { rx: /\b(tomorrow)\b/i,  calc: () => { const d = new Date(today); d.setDate(d.getDate() + 1); return d } },
    { rx: /\bthis (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, calc: (m) => {
      const days = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 }
      const d = new Date(today); const target = days[m[1].toLowerCase()]
      let diff = target - d.getDay(); if (diff <= 0) diff += 7; d.setDate(d.getDate() + diff); return d
    }},
    { rx: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, calc: (m) => {
      const days = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 }
      const d = new Date(today); const target = days[m[1].toLowerCase()]
      let diff = target - d.getDay(); if (diff <= 0) diff += 7; diff += 7; d.setDate(d.getDate() + diff); return d
    }},
    { rx: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, calc: (m) => {
      const days = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 }
      const d = new Date(today); const target = days[m[1].toLowerCase()]
      let diff = target - d.getDay(); if (diff <= 0) diff += 7; d.setDate(d.getDate() + diff); return d
    }},
    { rx: /\bnext week\b/i,   calc: () => { const d = new Date(today); d.setDate(d.getDate() + 7); return d } },
    { rx: /\bin (\d+) days?\b/i, calc: (m) => { const d = new Date(today); d.setDate(d.getDate() + parseInt(m[1])); return d } },
  ]

  for (const pattern of datePatterns) {
    const match = lower.match(pattern.rx)
    if (match) {
      const dd = pattern.calc(match)
      dueDate = toLocalDateStr(dd)
      break
    }
  }

  if (/\b(urgent|asap|critical|important|high priority|!\s*$)\b/i.test(lower)) priority = 'high'
  else if (/\b(low priority|whenever|eventually|someday|no rush)\b/i.test(lower)) priority = 'low'

  const catKw = {
    work:       /\b(work|office|meeting|boss|client|project|report|presentation|deadline|colleague|email)\b/i,
    money:      /\b(pay|bill|rent|invoice|bank|transfer|budget|insurance|tax|subscription|credit)\b/i,
    car:        /\b(car|tyre|fuel|petrol|mechanic|service|oil|vehicle|drive|parking)\b/i,
    house:      /\b(house|home|fix|repair|clean|furniture|kitchen|bathroom|garden|vacuum|plumb)\b/i,
    shopping:   /\b(buy|shop|purchase|order|grocery|groceries|supermarket|store|amazon)\b/i,
    sidehustle: /\b(freelance|side hustle|startup|client|invoice|portfolio|website|brand|launch)\b/i,
    people:     /\b(call|text|message|email|mom|dad|friend|family|meet|catch up|birthday|visit)\b/i,
    ideas:      /\b(idea|think about|maybe|concept|brainstorm|explore|research|consider|what if)\b/i,
  }
  for (const [id, rx] of Object.entries(catKw)) {
    if (rx.test(lower)) { category = id; break }
  }
  if (!category) category = 'personal'

  if (/\b(idea|concept|brainstorm|what if)\b/i.test(lower)) type = 'idea'
  else if (/\b(buy|order|purchase|shop)\b/i.test(lower)) type = 'purchase'
  else if (/\b(follow up|check in|remind|ping|ask about)\b/i.test(lower)) type = 'follow-up'
  else if (/\b(project|build|create|develop|launch|start)\b/i.test(lower)) type = 'project'

  const fillers = [
    /^(ok\s*,?\s*so\s*,?\s*)+/i,
    /^(ok\s*,?\s*)+/i,
    /^(so\s*,?\s*)+/i,
    /^(um+|uh+|err+|hmm+|ah+|right)\s*,?\s*/i,
    /\b(I\s+need\s+to\s+be\s+able\s+to|I\s+think\s+I\s+(?:need|should)\s+to|I\s+was\s+thinking\s+(?:I\s+should\s+)?)\s*/gi,
    /\b(I\s+(?:need|want|have|should|must)\s+to|remember\s+to|don't\s+forget\s+to|make\s+sure\s+to|gotta|gonna)\s*/gi,
    /\b(so\s+basically|basically|actually|literally|you\s+know|I\s+mean)\s*/gi,
    /^be\s+able\s+to\s+/i,
    /^(some\s+)?/i,
  ]
  for (let pass = 0; pass < 2; pass++) {
    for (const rx of fillers) title = title.replace(rx, '').trimStart()
  }
  title = title.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '')
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1)
  if (!title) title = text.trim()

  return { title, category, dueDate, priority, type, notes: '', duration: null, subtasks: [] }
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
      completedAt: null,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [task, ...prev])
    return task
  }, [])

  const toggleTask = useCallback((id) => setTasks(prev => prev.map(t =>
    t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t
  )), [])

  const deleteTask  = useCallback((id) => setTasks(prev => prev.filter(t => t.id !== id)), [])

  const updateTask  = useCallback((id, updates) => setTasks(prev => prev.map(t =>
    t.id === id ? { ...t, ...updates } : t
  )), [])

  const toggleSubtask = useCallback((taskId, subtaskId) => setTasks(prev => prev.map(t =>
    t.id === taskId
      ? { ...t, subtasks: (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) }
      : t
  )), [])

  const clearCompleted = useCallback(() => setTasks(prev => prev.filter(t => !t.completed)), [])

  return { tasks, addTask, toggleTask, deleteTask, updateTask, toggleSubtask, clearCompleted }
}

function useVoiceInput() {
  const [isListening, setIsListening]   = useState(false)
  const [isSupported, setIsSupported]   = useState(true)
  const [liveText, setLiveText]         = useState('')
  const recRef         = useRef(null)
  const shouldKeepRef  = useRef(false)
  const accumulatedRef = useRef('')

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
          accumulatedRef.current = accumulatedRef.current ? accumulatedRef.current + ' ' + word : word
        } else {
          interim += e.results[i][0].transcript
        }
      }
      setLiveText([accumulatedRef.current, interim].filter(Boolean).join(' '))
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      shouldKeepRef.current = false
      setIsListening(false)
    }

    rec.onend = () => {
      if (shouldKeepRef.current) { try { rec.start() } catch {} }
      else setIsListening(false)
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

function useSwipeGesture(onSwipeLeft, onSwipeRight) {
  const [offset, setOffset]   = useState(0)
  const startX  = useRef(null)
  const startY  = useRef(null)
  const locked  = useRef(null) // 'h' | 'v' | null

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    locked.current = null
    setOffset(0)
  }, [])

  const onTouchMove = useCallback((e) => {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!locked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      locked.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    if (locked.current === 'h')
      setOffset(Math.max(-110, Math.min(110, dx)))
  }, [])

  const onTouchEnd = useCallback(() => {
    if (locked.current === 'h') {
      if (offset >  70) onSwipeRight?.()
      if (offset < -70) onSwipeLeft?.()
    }
    setOffset(0)
    startX.current = null
    locked.current = null
  }, [offset, onSwipeLeft, onSwipeRight])

  return { offset, onTouchStart, onTouchMove, onTouchEnd }
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
        <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={16} /></button>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        <span className="text-green-400 font-medium">✓ AI is active</span> — server key is set on Vercel.
        Optionally enter a personal key to override it. Stored only on this device.
      </p>

      <div className="relative mb-3">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-proj-…"
          className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-4 pr-12
            text-white placeholder-slate-500 text-sm font-mono
            focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => { onSave(draft.trim()); onClose() }}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium
            rounded-xl py-2.5 transition-all duration-200 active:scale-95">
          {draft.trim() ? 'Save & Enable AI' : 'Save'}
        </button>
        {apiKey && (
          <button onClick={() => { onSave(''); onClose() }}
            className="px-4 bg-white/5 hover:bg-white/10 text-slate-400 text-sm rounded-xl py-2.5 transition-all duration-200">
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Quick Capture ────────────────────────────────────────────────────────────

function QuickCapture({ onAdd, addToast, apiKey }) {
  const [input, setInput]         = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const inputRef = useRef(null)
  const { isListening, isSupported, liveText, start, stop } = useVoiceInput()

  useEffect(() => { if (isListening) setInput(liveText) }, [isListening, liveText])

  const handleMicClick = () => {
    if (isListening) { const captured = stop(); setInput(captured || ''); inputRef.current?.focus() }
    else { setInput(''); start() }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isListening) { stop(); return }
    const trimmed = input.trim()
    if (!trimmed || isParsing) return

    setIsParsing(true)
    setInput('')

    let parsed, usedAI = false, aiError = null
    try {
      parsed = await parseWithAI(trimmed, apiKey)
      usedAI = true
    } catch (err) {
      const msg = err.message || String(err)
      console.error('[LifeOps AI]', msg)
      if (!msg.includes('No API key')) {
        if (msg.includes('401')) aiError = 'Invalid API key — update in ✦ settings'
        else if (msg.includes('429')) aiError = 'Rate limited — try again in a moment'
        else if (/fetch|network|load failed|failed to/i.test(msg)) aiError = 'Network error'
        else aiError = msg.slice(0, 60)
      }
      parsed = parseNaturalInput(trimmed)
    }

    setIsParsing(false)
    onAdd(parsed)
    if (aiError) addToast(`⚠ ${aiError}`, 'error')
    else addToast(`${usedAI ? '✦ AI' : '✓'} Captured → ${CATEGORY_MAP[parsed.category]?.label || parsed.category}`)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { if (!isListening) setInput(e.target.value) }}
            placeholder="Say anything — AI will understand…"
            disabled={isParsing}
            readOnly={isListening}
            className={`w-full bg-white/10 border rounded-2xl py-4 px-5 pr-24
              text-white placeholder-slate-400 text-base
              focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-60
              ${isListening
                ? 'border-red-500/50 ring-2 ring-red-500/20'
                : 'border-purple-500/20 focus:border-purple-500/50 focus:ring-purple-500/20'}`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSupported && (
              <button type="button" onClick={handleMicClick}
                className={`p-2 rounded-full transition-all duration-200
                  ${isListening ? 'bg-red-500 text-white recording-dot' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            {!isListening && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                <Sparkles size={10} /> AI
              </span>
            )}
          </div>
        </div>
        <button type="submit"
          disabled={(!input.trim() && !isListening) || isParsing}
          className={`text-white rounded-2xl p-4 transition-all duration-200 flex-shrink-0 active:scale-95
            ${isParsing ? 'bg-purple-600/70 cursor-wait' : 'bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500'}`}>
          {isParsing ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
        </button>
      </div>
      {isListening && (
        <p className="mt-2 text-center text-sm text-red-400">
          <span className="animate-pulse">●</span> Recording — tap mic to stop, then press +
        </p>
      )}
      {isParsing && <p className="mt-2 text-center text-xs text-purple-400 animate-pulse">AI is thinking…</p>}
    </form>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ task, onSave, onClose }) {
  const [form, setForm] = useState({
    title:    task.title,
    category: task.category,
    priority: task.priority,
    dueDate:  task.dueDate || '',
    type:     task.type,
    notes:    task.notes || '',
    duration: task.duration || '',
  })
  const [subtasks, setSubtasks] = useState(task.subtasks || [])
  const [newSub, setNewSub]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addSub = () => {
    if (!newSub.trim()) return
    setSubtasks(prev => [...prev, { id: `st_${Date.now()}`, text: newSub.trim(), done: false }])
    setNewSub('')
  }

  const selectCls = `w-full border border-white/10 rounded-xl px-4 py-3 text-white text-sm
    focus:outline-none focus:border-purple-500/50 appearance-none`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl p-5
        max-h-[90vh] overflow-y-auto animate-slide-down">

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Edit Task</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Title */}
        <label className="block mb-3">
          <span className="text-xs text-slate-500 mb-1.5 block">Title</span>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
              focus:outline-none focus:border-purple-500/50" />
        </label>

        {/* Notes */}
        <label className="block mb-3">
          <span className="text-xs text-slate-500 mb-1.5 block">Notes</span>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Additional context…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
              resize-none focus:outline-none focus:border-purple-500/50 placeholder-slate-600" />
        </label>

        {/* Category + Priority */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Category</span>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Priority</span>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        {/* Due date + Type */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Due date</span>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              style={{ backgroundColor: '#1a1d27', colorScheme: 'dark' }}
              className="w-full border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                focus:outline-none focus:border-purple-500/50" />
          </label>
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Type</span>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
              <option value="todo">Todo</option>
              <option value="idea">Idea</option>
              <option value="purchase">Purchase</option>
              <option value="follow-up">Follow-up</option>
              <option value="project">Project</option>
            </select>
          </label>
        </div>

        {/* Duration */}
        <label className="block mb-4">
          <span className="text-xs text-slate-500 mb-1.5 block">Estimated time</span>
          <select value={form.duration} onChange={e => set('duration', e.target.value)}
            style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
            <option value="">Unknown</option>
            {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        {/* Subtasks */}
        <div className="mb-5">
          <span className="text-xs text-slate-500 mb-2 block">Subtasks</span>
          {subtasks.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <button type="button" onClick={() => setSubtasks(prev => prev.map(x => x.id === s.id ? { ...x, done: !x.done } : x))}
                    className="flex-shrink-0">
                    {s.done
                      ? <CheckSquare size={14} className="text-emerald-400" />
                      : <Square size={14} className="text-slate-500" />}
                  </button>
                  <span className={`text-xs flex-1 ${s.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>{s.text}</span>
                  <button type="button" onClick={() => setSubtasks(prev => prev.filter(x => x.id !== s.id))}
                    className="text-slate-600 hover:text-red-400 p-0.5"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={newSub} onChange={e => setNewSub(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }}
              placeholder="Add subtask…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs
                placeholder-slate-600 focus:outline-none focus:border-purple-500/40" />
            <button type="button" onClick={addSub}
              className="px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs transition-colors">
              Add
            </button>
          </div>
        </div>

        <button
          onClick={() => { onSave({ ...form, dueDate: form.dueDate || null, duration: form.duration || null, subtasks }); onClose() }}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium
            rounded-xl py-3 transition-all duration-200 active:scale-95">
          Save changes
        </button>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete, onUpdate, onToggleSubtask }) {
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const cat      = CATEGORY_MAP[task.category] || CATEGORIES[0]
  const bucket   = classifyTask(task)
  const subtasks = task.subtasks || []
  const doneSubs = subtasks.filter(s => s.done).length
  const hasExtra = task.notes || subtasks.length > 0

  const { offset, onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture(
    () => onDelete(task.id),
    () => onToggle(task.id),
  )

  const swipeProgress  = Math.min(Math.abs(offset) / 70, 1)
  const isSwipingRight = offset > 8
  const isSwipingLeft  = offset < -8
  const bgColor = isSwipingRight
    ? `rgba(16,185,129,${swipeProgress * 0.85})`
    : isSwipingLeft
      ? `rgba(239,68,68,${swipeProgress * 0.85})`
      : 'transparent'

  return (
    <>
      {/* Swipe container */}
      <div className={`relative rounded-xl overflow-hidden animate-fade-in ${task.completed ? 'opacity-50' : ''}`}
        style={{ backgroundColor: bgColor }}>

        {/* Swipe hint icons (revealed behind sliding card) */}
        <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none">
          <div className="flex items-center gap-2" style={{ opacity: isSwipingRight ? swipeProgress : 0 }}>
            <Check size={18} className="text-white" />
            <span className="text-white text-xs font-semibold">{task.completed ? 'Undo' : 'Done'}</span>
          </div>
          <div className="flex items-center gap-2" style={{ opacity: isSwipingLeft ? swipeProgress : 0 }}>
            <span className="text-white text-xs font-semibold">Delete</span>
            <Trash2 size={18} className="text-white" />
          </div>
        </div>

        {/* Sliding card */}
        <div
          className="group relative bg-white/5 border border-white/5 rounded-xl overflow-hidden
            hover:bg-white/[0.07] hover:border-white/10 transition-colors duration-200"
          style={{
            transform: `translateX(${offset}px)`,
            transition: offset === 0 ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* category color bar */}
          <div className="h-1" style={{ backgroundColor: cat.color }} />

          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button onClick={() => onToggle(task.id)}
                className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                  transition-all duration-200
                  ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-emerald-400'}`}>
                {task.completed && <Check size={14} className="text-white animate-checkmark" />}
              </button>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {task.title}
                </p>

                {/* Meta row */}
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
                  {task.duration && (
                    <span className="text-[11px] flex items-center gap-1 text-slate-500">
                      <Zap size={10} className="text-amber-500" />
                      {DURATION_LABELS[task.duration]}
                    </span>
                  )}
                  {task.type !== 'todo' && (
                    <span className="text-[11px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded capitalize">
                      {task.type}
                    </span>
                  )}
                  {subtasks.length > 0 && (
                    <span className="text-[11px] text-slate-500">{doneSubs}/{subtasks.length} steps</span>
                  )}
                </div>

                {/* Expand toggle */}
                {hasExtra && (
                  <button onClick={() => setExpanded(e => !e)}
                    className="mt-2 flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {expanded ? 'Less' : 'Details'}
                  </button>
                )}
              </div>

              {/* Edit button — always visible; trash only on desktop hover */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => setShowEdit(true)}
                  className="p-2.5 text-slate-500 hover:text-blue-400 rounded-lg hover:bg-white/5 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(task.id)}
                  className="p-2.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors
                    opacity-0 group-hover:opacity-100 sm:block hidden">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expanded && hasExtra && (
              <div className="mt-3 ml-9 space-y-3 animate-slide-down">
                {task.notes && (
                  <div className="flex gap-2">
                    <BookOpen size={12} className="text-slate-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-400 leading-relaxed">{task.notes}</p>
                  </div>
                )}
                {subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {subtasks.map(s => (
                      <button key={s.id} onClick={() => onToggleSubtask(task.id, s.id)}
                        className="flex items-center gap-2 w-full text-left group/sub">
                        {s.done
                          ? <CheckSquare size={13} className="text-emerald-400 flex-shrink-0" />
                          : <Square size={13} className="text-slate-600 group-hover/sub:text-slate-400 flex-shrink-0" />}
                        <span className={`text-xs ${s.done ? 'line-through text-slate-600' : 'text-slate-400 group-hover/sub:text-slate-300'}`}>
                          {s.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <EditModal
          task={task}
          onSave={(updates) => onUpdate(task.id, updates)}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}

// ─── Task Section ─────────────────────────────────────────────────────────────

function TaskSection({ title, icon: Icon, tasks, color, badge, onToggle, onDelete, onUpdate, onToggleSubtask, defaultOpen = true }) {
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
            <TaskCard key={task.id} task={task}
              onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} onToggleSubtask={onToggleSubtask} />
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
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4
            text-white placeholder-slate-500 text-sm focus:outline-none focus:border-white/10
            focus:ring-1 focus:ring-white/5 transition-all duration-200" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0
            ${!activeCategory ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0"
            style={activeCategory === cat.id
              ? { backgroundColor: cat.color + '33', color: cat.color }
              : { backgroundColor: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {[{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'completed', l: 'Completed' }].map(f => (
          <button key={f.k} onClick={() => setStatusFilter(f.k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${statusFilter === f.k ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {f.l}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Compact Stats Bar ────────────────────────────────────────────────────────

function CompactStats({ tasks }) {
  const active       = tasks.filter(t => !t.completed)
  const todayCount   = active.filter(t => classifyTask(t) === 'today').length
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
        <span className="text-slate-500 hidden sm:inline">|</span>
        <span className="text-slate-400 text-xs">
          {active.length === 0 ? 'All clear! Add something.' :
           overdueCount > 0 ? 'Handle overdue items first.' :
           todayCount > 0 ? 'Focus on today.' : "You're on track!"}
        </span>
      </div>
    </div>
  )
}

// ─── Insights Dashboard ───────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color = 'slate', sub }) {
  const colors = {
    blue:    'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red:     'text-red-400 bg-red-500/10',
    purple:  'text-purple-400 bg-purple-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    slate:   'text-slate-400 bg-white/5',
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{label}</span>
        <div className={`p-1.5 rounded-lg ${colors[color] || colors.slate}`}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function InsightsDashboard({ tasks }) {
  const todayD   = new Date()
  todayD.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateStr(todayD)

  const active          = tasks.filter(t => !t.completed)
  const completedTasks  = tasks.filter(t => t.completed)
  const completedToday  = completedTasks.filter(t => t.completedAt && isoToLocalDate(t.completedAt) === todayStr)
  const overdueItems    = active.filter(t => classifyTask(t) === 'overdue')

  // Last 7 days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayD); d.setDate(d.getDate() - (6 - i)); return d
  })
  const weekDayStrs    = weekDays.map(d => toLocalDateStr(d))
  const weekCompleted  = weekDayStrs.map(ds => completedTasks.filter(t => t.completedAt && isoToLocalDate(t.completedAt) === ds).length)
  const weekAdded      = weekDayStrs.map(ds => tasks.filter(t => t.createdAt && isoToLocalDate(t.createdAt) === ds).length)
  const maxBar         = Math.max(...weekCompleted, ...weekAdded, 1)
  const totalDone      = weekCompleted.reduce((a, b) => a + b, 0)
  const totalAdded     = weekAdded.reduce((a, b) => a + b, 0)
  const weekRate       = totalAdded > 0 ? Math.round((totalDone / totalAdded) * 100) : 0

  // Category breakdown
  const catData = CATEGORIES.map(c => ({
    ...c,
    active: active.filter(t => t.category === c.id).length,
    done:   completedTasks.filter(t => t.category === c.id).length,
  })).filter(c => c.active + c.done > 0).sort((a, b) => b.active - a.active)

  // Priority
  const priData = [
    { label: 'High',   color: '#EF4444', count: active.filter(t => t.priority === 'high').length },
    { label: 'Medium', color: '#F59E0B', count: active.filter(t => t.priority === 'medium').length },
    { label: 'Low',    color: '#6B7280', count: active.filter(t => t.priority === 'low').length },
  ]

  // Quick wins
  const quickWins = active.filter(t => t.duration === 'quick')

  // Needs attention: overdue + high priority today
  const needsAttention = [
    ...overdueItems,
    ...active.filter(t => t.priority === 'high' && classifyTask(t) === 'today'),
  ].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 5)

  // Duration breakdown (active tasks with known duration)
  const durData = Object.entries(DURATION_LABELS).map(([k, v]) => ({
    key: k, label: v, count: active.filter(t => t.duration === k).length,
  })).filter(d => d.count > 0)

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart2 size={48} className="mx-auto text-slate-700 mb-4" />
        <p className="text-slate-500 text-lg mb-1">No data yet</p>
        <p className="text-slate-600 text-sm">Add tasks to see your insights</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Active tasks"  value={active.length}           icon={ListTodo}      color="blue" />
        <StatCard label="Done today"    value={completedToday.length}   icon={Check}         color="emerald" />
        <StatCard label="Overdue"       value={overdueItems.length}     icon={AlertTriangle} color={overdueItems.length > 0 ? 'red' : 'slate'} />
        <StatCard label="This week"     value={`${weekRate}%`}          icon={TrendingUp}    color="purple"
          sub={`${totalDone} of ${totalAdded} done`} />
      </div>

      {/* 7-day chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">7-day activity</h3>
          <span className="text-xs text-slate-500">{totalDone} completed this week</span>
        </div>
        <div className="flex items-end gap-2" style={{ height: '80px' }}>
          {weekDays.map((d, i) => {
            const isToday = toLocalDateStr(d) === todayStr
            const addedH  = Math.max((weekAdded[i] / maxBar) * 60, weekAdded[i] > 0 ? 4 : 0)
            const doneH   = Math.max((weekCompleted[i] / maxBar) * 60, weekCompleted[i] > 0 ? 4 : 0)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="relative w-full" style={{ height: '60px' }}>
                  {/* added bar (faint background) */}
                  {weekAdded[i] > 0 && (
                    <div className="absolute bottom-0 w-full rounded-sm bg-purple-500/20"
                      style={{ height: `${addedH}px` }} />
                  )}
                  {/* completed bar (solid) */}
                  {weekCompleted[i] > 0 && (
                    <div className={`absolute bottom-0 w-full rounded-sm transition-all ${isToday ? 'bg-purple-400' : 'bg-purple-600'}`}
                      style={{ height: `${doneH}px` }} />
                  )}
                  {weekAdded[i] === 0 && weekCompleted[i] === 0 && (
                    <div className="absolute bottom-0 w-full rounded-sm bg-white/5" style={{ height: '3px' }} />
                  )}
                </div>
                <span className={`text-[10px] ${isToday ? 'text-purple-400 font-bold' : 'text-slate-600'}`}>
                  {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/20 inline-block" />Added
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-600 inline-block" />Completed
          </span>
        </div>
      </div>

      {/* Category breakdown */}
      {catData.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Categories</h3>
          <div className="space-y-3">
            {catData.map(c => {
              const total   = c.active + c.done
              const donePct = total > 0 ? (c.done / total) * 100 : 0
              const actPct  = total > 0 ? (c.active / total) * 100 : 0
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-400">{c.label}</span>
                    <div className="flex items-center gap-2">
                      {c.done > 0 && <span className="text-[10px] text-emerald-600">{c.done} done</span>}
                      <span className="text-xs font-medium" style={{ color: c.color }}>{c.active} active</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                    <div className="h-full transition-all duration-700 bg-emerald-500/40"
                      style={{ width: `${donePct}%` }} />
                    <div className="h-full transition-all duration-700"
                      style={{ width: `${actPct}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority + Quick Wins */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3">By priority</h3>
          <div className="space-y-2.5">
            {priData.map(p => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[11px] text-slate-400 flex-1">{p.label}</span>
                <span className="text-sm font-bold text-white">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-1">Quick wins</h3>
          <p className="text-3xl font-bold text-white mt-2">{quickWins.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">tasks under 5 min</p>
          {quickWins.length > 0 && (
            <p className="text-[10px] text-purple-400 mt-2 truncate">{quickWins[0].title}</p>
          )}
        </div>
      </div>

      {/* Duration breakdown */}
      {durData.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3">Effort breakdown</h3>
          <div className="grid grid-cols-2 gap-2">
            {durData.map(d => (
              <div key={d.key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="text-[11px] text-slate-400">{d.label}</span>
                <span className="text-sm font-bold text-amber-400">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Needs attention
          </h3>
          <div className="space-y-2">
            {needsAttention.map(t => {
              const cat = CATEGORY_MAP[t.category]
              const isOv = classifyTask(t) === 'overdue'
              return (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color }} />
                  <span className="text-xs text-slate-300 flex-1 truncate">{t.title}</span>
                  <span className={`text-[10px] flex-shrink-0 ${isOv ? 'text-red-400' : 'text-amber-400'}`}>
                    {t.dueDate ? formatDate(t.dueDate) : 'High priority'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All-time totals */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 mb-3">All time</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-white">{tasks.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total tasks</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-400">{completedTasks.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Completed</p>
          </div>
          <div>
            <p className="text-xl font-bold text-purple-400">
              {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Success rate</p>
          </div>
        </div>
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
            ${t.exiting ? 'toast-exit' : 'toast-enter'}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────

function BottomNav({ activeTab, setActiveTab, activeTasks }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40
      bg-[#0a0d14]/95 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto flex">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
            ${activeTab === 'tasks' ? 'text-purple-400' : 'text-slate-600 hover:text-slate-400'}`}>
          <div className="relative">
            <ListTodo size={22} />
            {activeTasks > 0 && (
              <span className="absolute -top-1.5 -right-2.5 text-[9px] bg-purple-500 text-white
                rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-bold leading-none">
                {activeTasks > 99 ? '99+' : activeTasks}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Tasks</span>
        </button>

        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
            ${activeTab === 'insights' ? 'text-purple-400' : 'text-slate-600 hover:text-slate-400'}`}>
          <BarChart2 size={22} />
          <span className="text-[10px] font-medium">Insights</span>
        </button>
      </div>
    </nav>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { tasks, addTask, toggleTask, deleteTask, updateTask, toggleSubtask, clearCompleted } = useTasks()
  const { toasts, add: addToast } = useToast()

  const [apiKey, setApiKey]       = useState(() => localStorage.getItem(AI_KEY_STORAGE) || '')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('tasks')
  const [search, setSearch]       = useState('')
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
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(t => t.title.toLowerCase().includes(q) || t.category.includes(q) || (t.notes || '').toLowerCase().includes(q))
    }
    if (activeCategory) r = r.filter(t => t.category === activeCategory)
    if (statusFilter === 'active')    r = r.filter(t => !t.completed)
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

  const sharedProps = { onToggle: handleToggle, onDelete: handleDelete, onUpdate: updateTask, onToggleSubtask: toggleSubtask }
  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div className="min-h-screen min-h-[100dvh] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">

        {/* Header */}
        <header className="text-center mb-6 relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            LifeOps
          </h1>
          <p className="text-slate-500 text-sm mt-1">Your personal command center</p>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`absolute right-0 top-0 p-2 rounded-xl transition-all duration-200
              ${showSettings ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            title="AI Settings">
            {apiKey ? <Sparkles size={18} className="text-purple-400" /> : <Settings size={18} />}
          </button>
        </header>

        {showSettings && (
          <SettingsPanel apiKey={apiKey} onSave={saveApiKey} onClose={() => setShowSettings(false)} />
        )}

        <QuickCapture onAdd={addTask} addToast={addToast} apiKey={apiKey} />

        {/* Tasks tab */}
        {activeTab === 'tasks' && (
          <>
            <CompactStats tasks={tasks} />
            <FilterBar
              search={search} setSearch={setSearch}
              activeCategory={activeCategory} setActiveCategory={setActiveCategory}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />

            <TaskSection title="Overdue"   icon={AlertTriangle} tasks={sections.overdue}  color="#EF4444"
              badge={sections.overdue.length > 0 ? `${sections.overdue.length} overdue` : null} {...sharedProps} />
            <TaskSection title="Today"     icon={Target}        tasks={sections.today}    color="#3B82F6" {...sharedProps} />
            <TaskSection title="This Week" icon={Calendar}      tasks={sections.week}     color="#8B5CF6" {...sharedProps} />
            <TaskSection title="Upcoming"  icon={Clock}         tasks={sections.upcoming} color="#06B6D4" {...sharedProps} />
            {statusFilter !== 'active' && sections.completed.length > 0 && (
              <TaskSection title="Completed" icon={Check} tasks={sections.completed} color="#10B981" defaultOpen={false} {...sharedProps} />
            )}

            {/* Clear completed */}
            {completedCount > 0 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => { clearCompleted(); addToast(`Cleared ${completedCount} completed tasks`) }}
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                  Clear {completedCount} completed task{completedCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-16">
                <Lightbulb size={48} className="mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg mb-2">No tasks yet</p>
                <p className="text-slate-600 text-sm max-w-xs mx-auto">
                  AI is ready. Try: "I need to call the dentist before Friday" or "build a portfolio website this month"
                </p>
              </div>
            )}
            {tasks.length > 0 && filtered.length === 0 && (
              <div className="text-center py-12">
                <Search size={36} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No matching tasks</p>
              </div>
            )}
          </>
        )}

        {/* Insights tab */}
        {activeTab === 'insights' && <InsightsDashboard tasks={tasks} />}
      </div>

      <Toast toasts={toasts} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} activeTasks={tasks.filter(t => !t.completed).length} />
    </div>
  )
}
