import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Mic, MicOff, Search, Plus, Check, Trash2, Pencil, X,
  ChevronDown, ChevronRight, AlertTriangle, Target,
  Calendar, Clock, Lightbulb, Settings, Sparkles, Loader2, Eye, EyeOff,
  TrendingUp, BarChart2, Zap, ListTodo, ChevronUp, BookOpen, CheckSquare, Square,
  Wand2, Send, RotateCcw, MessageSquare, Home, Flame, Trophy, Repeat,
  Star, Award, Lock, LogIn, LogOut, Cloud, CloudOff, RefreshCw,
  DollarSign, CreditCard, PiggyBank, Wallet, TrendingDown, FileText, Upload, Percent, Euro
} from 'lucide-react'
import { supabase } from './supabase'

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

const REPEAT_OPTIONS = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

const XP_KEY           = 'lifeops_xp'
const ACHIEVEMENTS_KEY = 'lifeops_achievements'

const LEVELS = [
  { level: 1, name: 'Starter',    xpRequired: 0    },
  { level: 2, name: 'Hustler',    xpRequired: 100  },
  { level: 3, name: 'Builder',    xpRequired: 300  },
  { level: 4, name: 'Achiever',   xpRequired: 600  },
  { level: 5, name: 'Pro',        xpRequired: 1000 },
  { level: 6, name: 'Elite',      xpRequired: 1500 },
  { level: 7, name: 'Master',     xpRequired: 2200 },
  { level: 8, name: 'Legend',     xpRequired: 3200 },
]

const ACHIEVEMENTS_LIST = [
  { id: 'first_task',  icon: '🎯', title: 'First Step',           desc: 'Complete your first task',         xp: 15  },
  { id: 'tasks_10',    icon: '✅', title: 'Getting Things Done',  desc: 'Complete 10 tasks',                xp: 30  },
  { id: 'tasks_50',    icon: '⚡', title: 'Productivity Machine', desc: 'Complete 50 tasks',                xp: 75  },
  { id: 'first_habit', icon: '💪', title: 'Creature of Habit',    desc: 'Check in a habit for the first time', xp: 10 },
  { id: 'streak_7',    icon: '🔥', title: 'Week Warrior',         desc: '7-day habit streak',               xp: 35  },
  { id: 'streak_30',   icon: '🏆', title: 'Unstoppable',          desc: '30-day habit streak',              xp: 100 },
  { id: 'first_goal',  icon: '🌟', title: 'Dream Big',            desc: 'Set your first goal',              xp: 10  },
  { id: 'goal_done',   icon: '🎖️', title: 'Goal Crusher',         desc: 'Complete a goal (100%)',           xp: 75  },
  { id: 'speed_run',   icon: '🚀', title: 'Speed Run',            desc: 'Complete 5 tasks in one day',      xp: 40  },
  { id: 'high_five',   icon: '🎯', title: 'High Priorities',      desc: 'Complete 5 high-priority tasks',   xp: 30  },
  { id: 'all_habits',  icon: '💯', title: 'Perfect Day',          desc: 'Check all habits in one day',      xp: 25  },
  { id: 'level_5',     icon: '👑', title: 'Going Pro',            desc: 'Reach Level 5',                    xp: 50  },
]

const HABITS_KEY = 'lifeops_habits'
const GOALS_KEY  = 'lifeops_goals'
const BRIEF_KEY  = 'lifeops_daily_brief'
const FINANCE_KEY = 'lifeops_finance'

const DEFAULT_FINANCE = {
  salary: { net: 0, brut: 0 },
  subscriptions: [],
  expenses: [],
}

const SUB_PERIODS = [
  { id: 'monthly',    label: 'Monthly' },
  { id: 'yearly',     label: 'Yearly' },
  { id: 'weekly',     label: 'Weekly' },
  { id: 'quarterly',  label: 'Quarterly' },
]

const SAVINGS_VEHICLES = [
  { id: 'lep',        name: 'LEP',              rate: 4.0,   cap: 7700,   emoji: '⭐',
    desc: 'Best rate in France. For net salary ≤ €2,200/mo. Priority #1.' },
  { id: 'livret_a',   name: 'Livret A',          rate: 3.0,   cap: 22950,  emoji: '🏦',
    desc: 'Liquid, guaranteed, tax-free. Perfect emergency fund.' },
  { id: 'pea',        name: 'PEA',               rate: null,  cap: 150000, emoji: '📈',
    desc: 'Invest in EU stocks. 0% tax on gains after 5 years.' },
  { id: 'per',        name: 'PER',               rate: null,  cap: null,   emoji: '🏖️',
    desc: 'Pension savings. Deductible from taxable income.' },
  { id: 'assurance',  name: 'Assurance-vie',      rate: null,  cap: null,   emoji: '🛡️',
    desc: 'Flexible envelope. Advantageous after 8 years & inheritance.' },
  { id: 'prime',      name: "Prime d'activité",   rate: null,  cap: null,   emoji: '💶',
    desc: 'CAF benefit for workers. Free money — check eligibility.' },
]

const GOAL_TIMEFRAMES = [
  { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' }, { id: 'year', label: 'This year' },
]

const PRESET_HABITS = [
  { emoji: '💪', name: 'Exercise' }, { emoji: '💧', name: 'Drink water' },
  { emoji: '📚', name: 'Read' },     { emoji: '🧘', name: 'Meditate' },
  { emoji: '😴', name: 'Sleep 8h' }, { emoji: '✍️', name: 'Journal' },
  { emoji: '🥗', name: 'Eat healthy' }, { emoji: '🚶', name: 'Walk outside' },
  { emoji: '📵', name: 'No phone AM' }, { emoji: '🌱', name: 'No social media' },
]
const HABIT_EMOJIS = ['💪','💧','📚','🧘','😴','✍️','🥗','🚶','💊','🌱','🎯','💻','🎵','🏊','🏋️','🧹','📝','🌅','🍎','🚴','⚡','🎨','🤝','💰','🎯']

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

function getHabitStreak(history = {}) {
  const today = new Date(); today.setHours(0,0,0,0)
  const todayStr = toLocalDateStr(today)
  const d = new Date(today)
  if (!history[todayStr]) d.setDate(d.getDate() - 1)
  let streak = 0
  for (let i = 0; i < 400; i++) {
    if (history[toLocalDateStr(d)]) { streak++; d.setDate(d.getDate() - 1) } else break
  }
  return streak
}

function getLast7Days() {
  const today = new Date(); today.setHours(0,0,0,0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i))
    return { d, str: toLocalDateStr(d), label: d.toLocaleDateString('en-US', { weekday: 'narrow' }) }
  })
}

function fmtMoney(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function toMonthly(amount, period) {
  const a = amount || 0
  if (period === 'yearly')    return a / 12
  if (period === 'weekly')    return a * 52 / 12
  if (period === 'quarterly') return a / 3
  return a // monthly
}

function getNextRepeatDate(dateStr, repeat) {
  const base = dateStr || toLocalDateStr(new Date())
  const d = new Date(base + 'T00:00:00')
  if (repeat === 'daily')   d.setDate(d.getDate() + 1)
  if (repeat === 'weekly')  d.setDate(d.getDate() + 7)
  if (repeat === 'monthly') d.setMonth(d.getMonth() + 1)
  return toLocalDateStr(d)
}

function calcTaskXP(task) {
  let xp = 10
  if (task.priority === 'high')     xp += 10
  if (task.priority === 'low')      xp -= 3
  if (task.duration === 'half-day') xp += 10
  if (task.duration === '2h')       xp += 6
  if (task.duration === '1h')       xp += 4
  if (task.duration === '30m')      xp += 2
  if ((task.subtasks || []).some(s => s.done)) xp += 5
  return Math.max(5, xp)
}

function getLevel(totalXP) {
  let lvl = LEVELS[0]
  for (const l of LEVELS) {
    if (totalXP >= l.xpRequired) lvl = l
    else break
  }
  const next     = LEVELS.find(l => l.xpRequired > totalXP)
  const xpIn     = totalXP - lvl.xpRequired
  const xpNeeded = next ? next.xpRequired - lvl.xpRequired : 0
  const pct      = next ? Math.min(100, Math.round((xpIn / xpNeeded) * 100)) : 100
  return { ...lvl, next, xpIn, xpNeeded, pct }
}

function goalProgressColor(pct) {
  if (pct >= 75) return '#10B981'
  if (pct >= 40) return '#8B5CF6'
  if (pct >= 15) return '#F59E0B'
  return '#EF4444'
}

// ─── Supabase Row Converters ──────────────────────────────────────────────────

function taskToRow(t, uid) {
  return { id: t.id, user_id: uid, title: t.title, category: t.category, due_date: t.dueDate,
    priority: t.priority, type: t.type, notes: t.notes, duration: t.duration, repeat: t.repeat,
    subtasks: t.subtasks, completed: t.completed, completed_at: t.completedAt, created_at: t.createdAt }
}
function rowToTask(r) {
  return { id: r.id, title: r.title, category: r.category, dueDate: r.due_date,
    priority: r.priority, type: r.type, notes: r.notes, duration: r.duration, repeat: r.repeat,
    subtasks: r.subtasks || [], completed: r.completed, completedAt: r.completed_at, createdAt: r.created_at }
}
function habitToRow(h, uid) {
  return { id: h.id, user_id: uid, name: h.name, emoji: h.emoji, history: h.history,
    archived: h.archived, created_at: h.createdAt }
}
function rowToHabit(r) {
  return { id: r.id, name: r.name, emoji: r.emoji, history: r.history || {},
    archived: r.archived, createdAt: r.created_at }
}
function goalToRow(g, uid) {
  return { id: g.id, user_id: uid, title: g.title, emoji: g.emoji, timeframe: g.timeframe,
    description: g.description, progress: g.progress, status: g.status, created_at: g.createdAt }
}
function rowToGoal(r) {
  return { id: r.id, title: r.title, emoji: r.emoji, timeframe: r.timeframe,
    description: r.description, progress: r.progress || 0, status: r.status, createdAt: r.created_at }
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
    repeat:   ['daily', 'weekly', 'monthly'].includes(parsed.repeat) ? parsed.repeat : null,
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

  let repeat = null
  if (/\b(every\s*day|each\s*day|daily)\b/i.test(lower))   repeat = 'daily'
  else if (/\b(every\s*week|each\s*week|weekly)\b/i.test(lower)) repeat = 'weekly'
  else if (/\b(every\s*month|each\s*month|monthly)\b/i.test(lower)) repeat = 'monthly'

  return { title, category, dueDate, priority, type, notes: '', duration: null, repeat, subtasks: [] }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

// Helper: fire-and-forget Supabase write with error logging
function dbWrite(promise) {
  promise.then(({ error }) => { if (error) console.error('[sync]', error.message) })
}

function useTasks(userId) {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })

  // Load from Supabase (or localStorage if not logged in)
  const loadFromCloud = useCallback(async () => {
    if (!userId || !supabase) {
      try { setTasks(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
      return
    }
    const { data, error } = await supabase
      .from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) { console.error('[sync] tasks fetch failed:', error.message); return }
    if (data && data.length > 0) {
      setTasks(data.map(rowToTask))
    } else {
      // First login: migrate localStorage → Supabase
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (local.length > 0) {
        setTasks(local)
        dbWrite(supabase.from('tasks').insert(local.map(t => taskToRow(t, userId))))
      }
    }
  }, [userId])

  useEffect(() => { loadFromCloud() }, [loadFromCloud])

  // Always keep localStorage in sync (as offline cache) regardless of login state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)) } catch {}
  }, [tasks])

  // Upload any local tasks missing from Supabase (recovery after offline edits)
  const uploadMissing = useCallback(async () => {
    if (!userId || !supabase) return 0
    const { data } = await supabase.from('tasks').select('id').eq('user_id', userId)
    const cloudIds = new Set((data || []).map(r => r.id))
    const missing = tasks.filter(t => !cloudIds.has(t.id))
    if (missing.length > 0)
      dbWrite(supabase.from('tasks').upsert(missing.map(t => taskToRow(t, userId))))
    return missing.length
  }, [userId, tasks])

  const addTask = useCallback((parsed) => {
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ...parsed, completed: false, completedAt: null, createdAt: new Date().toISOString(),
    }
    setTasks(prev => [task, ...prev])
    if (userId && supabase) dbWrite(supabase.from('tasks').insert(taskToRow(task, userId)))
    return task
  }, [userId])

  const toggleTask = useCallback((id) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id)
      if (!task) return prev
      const isCompleting = !task.completed
      const updated = prev.map(t =>
        t.id === id
          ? { ...t, completed: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null }
          : t
      )
      const toggled = updated.find(t => t.id === id)
      if (userId && supabase) dbWrite(supabase.from('tasks').update({ completed: toggled.completed, completed_at: toggled.completedAt }).eq('id', id))
      if (isCompleting && task.repeat) {
        const next = {
          ...task,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          completed: false, completedAt: null, createdAt: new Date().toISOString(),
          dueDate: getNextRepeatDate(task.dueDate, task.repeat),
        }
        if (userId && supabase) dbWrite(supabase.from('tasks').insert(taskToRow(next, userId)))
        return [...updated, next]
      }
      return updated
    })
  }, [userId])

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (userId && supabase) dbWrite(supabase.from('tasks').delete().eq('id', id))
  }, [userId])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    if (userId && supabase) {
      const dbUp = {}
      if ('title'    in updates) dbUp.title       = updates.title
      if ('category' in updates) dbUp.category    = updates.category
      if ('dueDate'  in updates) dbUp.due_date    = updates.dueDate
      if ('priority' in updates) dbUp.priority    = updates.priority
      if ('type'     in updates) dbUp.type        = updates.type
      if ('notes'    in updates) dbUp.notes       = updates.notes
      if ('duration' in updates) dbUp.duration    = updates.duration
      if ('repeat'   in updates) dbUp.repeat      = updates.repeat
      if ('subtasks' in updates) dbUp.subtasks    = updates.subtasks
      if ('completed'   in updates) dbUp.completed    = updates.completed
      if ('completedAt' in updates) dbUp.completed_at = updates.completedAt
      dbWrite(supabase.from('tasks').update(dbUp).eq('id', id))
    }
  }, [userId])

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) }
          : t
      )
      if (userId && supabase) {
        const task = updated.find(t => t.id === taskId)
        if (task) dbWrite(supabase.from('tasks').update({ subtasks: task.subtasks }).eq('id', taskId))
      }
      return updated
    })
  }, [userId])

  const restoreTask = useCallback((task) => {
    setTasks(prev => [task, ...prev])
    if (userId && supabase) dbWrite(supabase.from('tasks').insert(taskToRow(task, userId)))
  }, [userId])

  const clearCompleted = useCallback(() => {
    setTasks(prev => {
      const ids = prev.filter(t => t.completed).map(t => t.id)
      if (userId && supabase && ids.length) dbWrite(supabase.from('tasks').delete().in('id', ids))
      return prev.filter(t => !t.completed)
    })
  }, [userId])

  return { tasks, addTask, toggleTask, deleteTask, restoreTask, updateTask, toggleSubtask, clearCompleted, loadFromCloud, uploadMissing }
}

function useHabits(userId) {
  const [habits, setHabits] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HABITS_KEY) || '[]') } catch { return [] }
  })

  const loadFromCloud = useCallback(async () => {
    if (!userId || !supabase) {
      try { setHabits(JSON.parse(localStorage.getItem(HABITS_KEY) || '[]')) } catch {}
      return
    }
    const { data, error } = await supabase.from('habits').select('*').eq('user_id', userId)
    if (error) { console.error('[sync] habits fetch failed:', error.message); return }
    if (data && data.length > 0) {
      setHabits(data.map(rowToHabit))
    } else {
      const local = JSON.parse(localStorage.getItem(HABITS_KEY) || '[]')
      if (local.length > 0) {
        setHabits(local)
        dbWrite(supabase.from('habits').insert(local.map(h => habitToRow(h, userId))))
      }
    }
  }, [userId])

  useEffect(() => { loadFromCloud() }, [loadFromCloud])
  useEffect(() => { try { localStorage.setItem(HABITS_KEY, JSON.stringify(habits)) } catch {} }, [habits])

  const addHabit = useCallback((data) => {
    const h = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), ...data, history: {}, archived: false, createdAt: new Date().toISOString() }
    setHabits(p => [...p, h])
    if (userId && supabase) dbWrite(supabase.from('habits').insert(habitToRow(h, userId)))
    return h
  }, [userId])

  const toggleToday = useCallback((id) => {
    const today = toLocalDateStr(new Date())
    setHabits(p => {
      const updated = p.map(h => h.id === id ? { ...h, history: { ...h.history, [today]: !h.history?.[today] } } : h)
      if (userId && supabase) {
        const habit = updated.find(h => h.id === id)
        if (habit) dbWrite(supabase.from('habits').update({ history: habit.history }).eq('id', id))
      }
      return updated
    })
  }, [userId])

  const removeHabit = useCallback((id) => {
    setHabits(p => p.filter(h => h.id !== id))
    if (userId && supabase) dbWrite(supabase.from('habits').delete().eq('id', id))
  }, [userId])

  const updateHabit = useCallback((id, upd) => {
    setHabits(p => p.map(h => h.id === id ? { ...h, ...upd } : h))
    if (userId && supabase) dbWrite(supabase.from('habits').update(upd).eq('id', id))
  }, [userId])

  return { habits: habits.filter(h => !h.archived), addHabit, toggleToday, removeHabit, updateHabit, loadFromCloud }
}

function useGoals(userId) {
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]') } catch { return [] }
  })

  const loadFromCloud = useCallback(async () => {
    if (!userId || !supabase) {
      try { setGoals(JSON.parse(localStorage.getItem(GOALS_KEY) || '[]')) } catch {}
      return
    }
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId)
    if (error) { console.error('[sync] goals fetch failed:', error.message); return }
    if (data && data.length > 0) {
      setGoals(data.map(rowToGoal))
    } else {
      const local = JSON.parse(localStorage.getItem(GOALS_KEY) || '[]')
      if (local.length > 0) {
        setGoals(local)
        dbWrite(supabase.from('goals').insert(local.map(g => goalToRow(g, userId))))
      }
    }
  }, [userId])

  useEffect(() => { loadFromCloud() }, [loadFromCloud])
  useEffect(() => { try { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)) } catch {} }, [goals])

  const addGoal = useCallback((data) => {
    const g = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), ...data, progress: 0, status: 'active', createdAt: new Date().toISOString() }
    setGoals(p => [...p, g])
    if (userId && supabase) dbWrite(supabase.from('goals').insert(goalToRow(g, userId)))
    return g
  }, [userId])

  const updateGoal = useCallback((id, upd) => {
    setGoals(p => p.map(g => g.id === id ? { ...g, ...upd } : g))
    if (userId && supabase) dbWrite(supabase.from('goals').update(upd).eq('id', id))
  }, [userId])

  const removeGoal = useCallback((id) => {
    setGoals(p => p.filter(g => g.id !== id))
    if (userId && supabase) dbWrite(supabase.from('goals').delete().eq('id', id))
  }, [userId])

  return { goals: goals.filter(g => g.status !== 'archived'), addGoal, updateGoal, removeGoal, loadFromCloud }
}

function useFinance(userId) {
  const [finance, setFinance] = useState(() => {
    try { return { ...DEFAULT_FINANCE, ...JSON.parse(localStorage.getItem(FINANCE_KEY) || '{}') } }
    catch { return { ...DEFAULT_FINANCE } }
  })

  useEffect(() => {
    if (!userId || !supabase) return
    supabase.from('finance').select('data').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data?.data) setFinance(prev => ({ ...DEFAULT_FINANCE, ...prev, ...data.data })) })
  }, [userId])

  const persist = useCallback((updated) => {
    try { localStorage.setItem(FINANCE_KEY, JSON.stringify(updated)) } catch {}
    if (userId && supabase) {
      dbWrite(supabase.from('finance').upsert({ user_id: userId, data: updated, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }))
    }
  }, [userId])

  const updateSalary = useCallback((s) => {
    setFinance(prev => { const n = { ...prev, salary: s }; persist(n); return n })
  }, [persist])

  const addSubscription = useCallback((sub) => {
    setFinance(prev => {
      const n = { ...prev, subscriptions: [...(prev.subscriptions||[]), { id: Date.now().toString(36) + Math.random().toString(36).slice(2,4), ...sub }] }
      persist(n); return n
    })
  }, [persist])

  const removeSubscription = useCallback((id) => {
    setFinance(prev => {
      const n = { ...prev, subscriptions: (prev.subscriptions||[]).filter(s => s.id !== id) }
      persist(n); return n
    })
  }, [persist])

  const updateSubscription = useCallback((id, upd) => {
    setFinance(prev => {
      const n = { ...prev, subscriptions: (prev.subscriptions||[]).map(s => s.id === id ? { ...s, ...upd } : s) }
      persist(n); return n
    })
  }, [persist])

  const addExpense = useCallback((exp) => {
    setFinance(prev => {
      const n = { ...prev, expenses: [...(prev.expenses||[]), { id: Date.now().toString(36) + Math.random().toString(36).slice(2,4), ...exp }] }
      persist(n); return n
    })
  }, [persist])

  const removeExpense = useCallback((id) => {
    setFinance(prev => {
      const n = { ...prev, expenses: (prev.expenses||[]).filter(e => e.id !== id) }
      persist(n); return n
    })
  }, [persist])

  const importData = useCallback((patch) => {
    setFinance(prev => { const n = { ...prev, ...patch }; persist(n); return n })
  }, [persist])

  return { finance, updateSalary, addSubscription, removeSubscription, updateSubscription, addExpense, removeExpense, importData }
}

function useXP(userId) {
  const [total, setTotal] = useState(() => {
    try { return Number(localStorage.getItem(XP_KEY) || '0') } catch { return 0 }
  })

  useEffect(() => {
    if (!userId || !supabase) return
    supabase.from('user_progress').select('total_xp').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data) setTotal(data.total_xp) })
  }, [userId])

  useEffect(() => {
    if (!userId) {
      localStorage.setItem(XP_KEY, String(total))
    } else if (supabase && total > 0) {
      supabase.from('user_progress').upsert({ user_id: userId, total_xp: total, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    }
  }, [total, userId])

  const addXP = useCallback((amount) => setTotal(p => p + amount), [])
  return { total, addXP }
}

function useAchievements(userId) {
  const [unlocked, setUnlocked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]') } catch { return [] }
  })
  const unlockedRef = useRef(unlocked)

  useEffect(() => {
    if (!userId || !supabase) return
    supabase.from('user_progress').select('unlocked_achievements').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.unlocked_achievements) {
          setUnlocked(data.unlocked_achievements)
          unlockedRef.current = data.unlocked_achievements
        }
      })
  }, [userId])

  useEffect(() => {
    unlockedRef.current = unlocked
    if (!userId) {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked))
    } else if (supabase) {
      supabase.from('user_progress').upsert({ user_id: userId, unlocked_achievements: unlocked, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    }
  }, [unlocked, userId])

  const tryUnlock = useCallback((id) => {
    if (unlockedRef.current.includes(id)) return false
    setUnlocked(prev => [...prev, id])
    return true
  }, [])
  return { unlocked, tryUnlock }
}

const GTOKEN_KEY = 'lifeops_google_token'

function useAuth() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // With implicit flow, provider_token is in the URL hash on the redirect landing
  // Extract and save it immediately before Supabase clears the hash
  const extractHashToken = () => {
    try {
      const hash = window.location.hash
      if (hash && hash.includes('provider_token')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''))
        const pt = params.get('provider_token')
        if (pt) { localStorage.setItem(GTOKEN_KEY, pt); return pt }
      }
    } catch {}
    return null
  }

  const patchSession = (s) => {
    if (!s) return s
    // Persist provider_token when present
    if (s.provider_token) {
      localStorage.setItem(GTOKEN_KEY, s.provider_token)
      return s
    }
    // Re-attach cached token if session lost it after refresh
    const cached = localStorage.getItem(GTOKEN_KEY)
    if (cached) return { ...s, provider_token: cached }
    return s
  }

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    // Extract token from hash immediately on load (implicit flow redirect)
    extractHashToken()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(patchSession(session)); setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) localStorage.removeItem(GTOKEN_KEY)
      setSession(patchSession(s))
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(() => supabase?.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  }), [])

  const signOut = useCallback(() => supabase?.auth.signOut(), [])

  return { session, authLoading, signIn, signOut, userId: session?.user?.id ?? null }
}

function useCalendar(session) {
  const [todayEvents, setTodayEvents] = useState([])
  const [calLoading, setCalLoading]   = useState(false)
  const [calError, setCalError]       = useState(null) // null | {type, message}
  const token = session?.provider_token

  const fetchEvents = useCallback(async (dateStr) => {
    if (!token) return []
    const d    = new Date(dateStr + 'T00:00:00')
    const next = new Date(d); next.setDate(next.getDate() + 1)
    try {
      const params = new URLSearchParams({
        timeMin: d.toISOString(), timeMax: next.toISOString(),
        singleEvents: 'true', orderBy: 'startTime', maxResults: '20',
      })
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let message = `HTTP ${res.status}`
        try {
          const body = await res.json()
          message = body?.error?.message || body?.error || message
        } catch {}
        const type = (res.status === 401 || res.status === 403) ? 'auth' : 'network'
        if (type === 'auth') try { localStorage.removeItem('lifeops_google_token') } catch {}
        setCalError({ type, message })
        return []
      }
      setCalError(null)
      const data = await res.json()
      return data.items || []
    } catch (e) { setCalError({ type: 'network', message: e.message }); return [] }
  }, [token])

  const refetchToday = useCallback(() => {
    if (!token) return
    setCalLoading(true)
    fetchEvents(toLocalDateStr(new Date())).then(evts => {
      setTodayEvents(evts); setCalLoading(false)
    })
  }, [token, fetchEvents])

  useEffect(() => {
    if (!token) return
    setCalError(null)
    setCalLoading(true)
    fetchEvents(toLocalDateStr(new Date())).then(evts => {
      setTodayEvents(evts); setCalLoading(false)
    })
  }, [token, fetchEvents])

  return { todayEvents, calLoading, calError, fetchEvents, refetchToday }
}

function getFreeSlots(events, durationMins = 30) {
  const now       = new Date()
  const startDay  = new Date(); startDay.setHours(8, 0, 0, 0)
  const endDay    = new Date(); endDay.setHours(20, 0, 0, 0)
  const cursor0   = now > startDay ? now : startDay
  const timed     = events
    .filter(e => e.start?.dateTime)
    .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))
    .sort((a, b) => a.start - b.start)
  const slots = []
  let cursor = cursor0
  for (const ev of timed) {
    if (ev.start > cursor && (ev.start - cursor) / 60000 >= durationMins)
      slots.push({ start: new Date(cursor), end: new Date(ev.start) })
    if (ev.end > cursor) cursor = ev.end
  }
  if (cursor < endDay && (endDay - cursor) / 60000 >= durationMins)
    slots.push({ start: new Date(cursor), end: new Date(endDay) })
  return slots
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
  const timerRefs = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250)
  }, [])

  const add = useCallback((message, variant = 'success', onUndo = null) => {
    const id = Date.now()
    const duration = onUndo ? 5000 : 2500
    setToasts(prev => [...prev, { id, message, variant, exiting: false, onUndo }])
    timerRefs.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return { toasts, add, dismiss }
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
      if (offset >  70) { navigator.vibrate?.(40); onSwipeRight?.() }
      if (offset < -70) { navigator.vibrate?.([40, 30, 40]); onSwipeLeft?.() }
    }
    setOffset(0)
    startX.current = null
    locked.current = null
  }, [offset, onSwipeLeft, onSwipeRight])

  return { offset, onTouchStart, onTouchMove, onTouchEnd }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ apiKey, onSave, onClose, session, onSignIn, onSignOut, onSyncNow, onUploadLocal }) {
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

      {supabase && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-white">Cloud Sync</span>
          </div>
          {session ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                    {session.user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-white font-medium truncate max-w-[160px]">{session.user.email}</p>
                    <p className="text-[10px] text-green-400">● Connected</p>
                  </div>
                </div>
                <button onClick={onSignOut} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors">
                  <LogOut size={12} /> Sign out
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onSyncNow}
                  className="flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20
                    text-blue-400 text-xs rounded-xl py-2 transition-all active:scale-95">
                  <RefreshCw size={12} /> Pull from cloud
                </button>
                <button onClick={onUploadLocal}
                  className="flex items-center justify-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20
                    text-purple-400 text-xs rounded-xl py-2 transition-all active:scale-95">
                  <Cloud size={12} /> Push local data
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center">Use "Push" if tasks added offline aren't in cloud</p>
            </div>
          ) : (
            <button onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10
                text-white text-sm rounded-xl py-2.5 transition-all duration-200 active:scale-95">
              <LogIn size={15} className="text-purple-400" />
              Sign in with Google for cloud sync
            </button>
          )}
        </div>
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
    repeat:   task.repeat || '',
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

        {/* Duration + Repeat */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Estimated time</span>
            <select value={form.duration} onChange={e => set('duration', e.target.value)}
              style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
              <option value="">Unknown</option>
              {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-slate-500 mb-1.5 block">Repeats</span>
            <select value={form.repeat} onChange={e => set('repeat', e.target.value)}
              style={{ backgroundColor: '#1a1d27' }} className={selectCls}>
              <option value="">Never</option>
              {REPEAT_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        </div>

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
          onClick={() => { onSave({ ...form, dueDate: form.dueDate || null, duration: form.duration || null, repeat: form.repeat || null, subtasks }); onClose() }}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium
            rounded-xl py-3 transition-all duration-200 active:scale-95">
          Save changes
        </button>
      </div>
    </div>
  )
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

async function aiEditTask(instruction, task, apiKey) {
  const today   = new Date()
  const todayStr = toLocalDateStr(today)
  const dayName  = today.toLocaleDateString('en-US', { weekday: 'long' })
  const resp = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, task, todayStr, dayName, apiKey }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error || `HTTP ${resp.status}`)
  }
  return resp.json()
}

async function aiAssist(messages, tasks, apiKey, habits = [], goals = [], calendarEvents = []) {
  const today    = new Date()
  const todayStr = toLocalDateStr(today)
  const dayName  = today.toLocaleDateString('en-US', { weekday: 'long' })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const resp = await fetch('/api/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, tasks, habits, goals, calendarEvents, todayStr, dayName, apiKey, timezone }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error || `HTTP ${resp.status}`)
  }
  return resp.json()
}

// Renders AI response: **bold**, • bullets, line breaks
function AiText({ text }) {
  return (
    <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
      {text.split('\n\n').map((para, i) => {
        const lines = para.split('\n').filter(Boolean)
        const isList = lines.length > 1 && lines.every(l => /^[•\-*]\s/.test(l.trim()))
        if (isList) return (
          <ul key={i} className="space-y-1.5 pl-1">
            {lines.map((line, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
                <span><InlineBold text={line.replace(/^[•\-*]\s/, '')} /></span>
              </li>
            ))}
          </ul>
        )
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>{j > 0 && <br />}<InlineBold text={line} /></span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function InlineBold({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-white font-semibold">{p.slice(2,-2)}</strong>
      : <span key={i}>{p}</span>
  )}</>
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete, onUpdate, onToggleSubtask, apiKey, addToast }) {
  const [expanded, setExpanded]     = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [showAIEdit, setShowAIEdit] = useState(false)
  const [aiInstruct, setAiInstruct] = useState('')
  const [aiEditing, setAiEditing]   = useState(false)
  const aiInputRef = useRef(null)

  const handleAIEdit = async () => {
    if (!aiInstruct.trim() || aiEditing) return
    setAiEditing(true)
    try {
      const changes = await aiEditTask(aiInstruct.trim(), task, apiKey)
      onUpdate(task.id, changes)
      const fields = Object.keys(changes).join(', ')
      addToast?.(`✦ Updated: ${fields}`)
      setShowAIEdit(false)
      setAiInstruct('')
    } catch (err) {
      addToast?.(`⚠ ${err.message.slice(0, 60)}`, 'error')
    }
    setAiEditing(false)
  }

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
                  {task.repeat && (
                    <span className="text-[11px] flex items-center gap-1 text-blue-400">
                      <Repeat size={10} /> {task.repeat}
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

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => { setShowAIEdit(e => !e); setTimeout(() => aiInputRef.current?.focus(), 50) }}
                  className={`p-2.5 rounded-lg transition-colors ${showAIEdit ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-purple-400 hover:bg-white/5'}`}
                  title="Edit with AI">
                  <Wand2 size={14} />
                </button>
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

            {/* AI Edit inline */}
            {showAIEdit && (
              <div className="mt-3 ml-9 animate-slide-down">
                <div className="flex gap-2 items-center">
                  <Wand2 size={12} className="text-purple-400 flex-shrink-0" />
                  <input
                    ref={aiInputRef}
                    value={aiInstruct}
                    onChange={e => setAiInstruct(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAIEdit(); if (e.key === 'Escape') setShowAIEdit(false) }}
                    placeholder='"move to Friday" · "make urgent" · "add note: bring ID"'
                    disabled={aiEditing}
                    className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2
                      text-white text-xs placeholder-slate-600 focus:outline-none focus:border-purple-500/50
                      disabled:opacity-50"
                  />
                  <button onClick={handleAIEdit} disabled={!aiInstruct.trim() || aiEditing}
                    className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg transition-colors flex-shrink-0">
                    {aiEditing
                      ? <Loader2 size={13} className="animate-spin text-white" />
                      : <Send size={13} className="text-white" />}
                  </button>
                </div>
              </div>
            )}

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

function TaskSection({ title, icon: Icon, tasks, color, badge, onToggle, onDelete, onUpdate, onToggleSubtask, apiKey, addToast, defaultOpen = true }) {
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
              onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
              onToggleSubtask={onToggleSubtask} apiKey={apiKey} addToast={addToast} />
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

function InsightsDashboard({ tasks, habits = [], goals = [], unlocked = [] }) {
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

      {/* Habits analytics */}
      {habits.length > 0 && (() => {
        const last7 = getLast7Days()
        const totalPossible = habits.length * 7
        const totalDone = habits.reduce((sum, h) =>
          sum + last7.filter(({ str }) => !!h.history?.[str]).length, 0)
        const weekRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0
        return (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Flame size={14} className="text-orange-400" /> Habits — last 7 days
              </h3>
              <span className="text-sm font-bold text-orange-400">{weekRate}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full mb-4">
              <div className="h-full bg-orange-400 rounded-full transition-all duration-700"
                style={{ width: `${weekRate}%` }} />
            </div>
            <div className="space-y-3">
              {habits.map(habit => {
                const streak  = getHabitStreak(habit.history)
                const weekDone = last7.filter(({ str }) => !!habit.history?.[str]).length
                return (
                  <div key={habit.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base leading-none">{habit.emoji}</span>
                      <span className="text-xs text-slate-300 flex-1">{habit.name}</span>
                      {streak > 0 && <span className="text-[11px] text-orange-400">🔥 {streak}</span>}
                      <span className="text-[11px] text-slate-500">{weekDone}/7</span>
                    </div>
                    <div className="flex gap-1">
                      {last7.map(({ str }) => (
                        <div key={str} className={`flex-1 h-2 rounded-full transition-all
                          ${habit.history?.[str] ? 'bg-emerald-500' : 'bg-white/5'}`} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Goals analytics */}
      {goals.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Trophy size={14} className="text-yellow-400" /> Goals
            </h3>
            <span className="text-xs text-slate-500">
              avg {Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length)}%
            </span>
          </div>
          <div className="space-y-4">
            {goals.map(goal => {
              const pct   = Math.min(100, Math.max(0, goal.progress || 0))
              const color = goalProgressColor(pct)
              const tf    = GOAL_TIMEFRAMES.find(t => t.id === goal.timeframe)
              return (
                <div key={goal.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base leading-none">{goal.emoji}</span>
                    <span className="text-xs text-slate-300 flex-1 truncate">{goal.title}</span>
                    {tf && <span className="text-[10px] text-slate-600">{tf.label}</span>}
                    <span className="text-xs font-bold flex-shrink-0" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Achievements */}
      <AchievementsSection unlocked={unlocked} />
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts, dismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-full max-w-sm px-4">
      {toasts.map(t => (
        <div key={t.id}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm
            font-medium shadow-2xl backdrop-blur-sm
            ${t.variant === 'success' ? 'bg-emerald-500/90 text-white' :
              t.variant === 'error'   ? 'bg-red-500/90 text-white' :
                                        'bg-slate-800 border border-white/10 text-white'}
            ${t.exiting ? 'toast-exit' : 'toast-enter'}`}>
          <span className="flex-1 truncate">{t.message}</span>
          {t.onUndo && (
            <button
              onClick={() => { t.onUndo(); dismiss(t.id) }}
              className="flex-shrink-0 text-xs font-bold underline underline-offset-2 hover:no-underline
                opacity-90 hover:opacity-100 transition-opacity">
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── AI Assistant Tab ─────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: "Today's focus",    text: "What should I focus on today? Pick 3 tasks max and explain why." },
  { label: 'Weekly review',    text: 'Give me a weekly review: what I accomplished, what needs attention, and my top 3 priorities for this week.' },
  { label: 'What\'s urgent?',  text: 'What are my most urgent and overdue tasks right now?' },
  { label: 'Quick wins',       text: 'What quick tasks (under 5 min) can I knock out right now?' },
  { label: 'Prioritize',       text: 'Help me prioritize my active tasks. What should I do first, second, third?' },
  { label: 'What am I forgetting?', text: 'Looking at my tasks, is there anything that seems neglected, risky, or that I might be forgetting?' },
]

function AssistantTab({ tasks, habits, goals, apiKey, calendarEvents }) {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || loading) return
    setInput('')
    const userMsg = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = [...messages, userMsg]
      const { response } = await aiAssist(
        history.map(m => ({ role: m.role, content: m.content })),
        tasks, apiKey, habits, goals, calendarEvents,
      )
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${err.message.slice(0, 80)}` }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [input, loading, messages, tasks, habits, goals, apiKey, calendarEvents])

  const activeTasks = tasks.filter(t => !t.completed)
  const overdue = activeTasks.filter(t => classifyTask(t) === 'overdue')

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 180px)' }}>

      {/* Context pill */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <Sparkles size={13} className="text-purple-400" />
        <span className="text-xs text-slate-500">
          Knows your {activeTasks.length} tasks
          {overdue.length > 0 && <span className="text-red-400 ml-1">· {overdue.length} overdue</span>}
          {calendarEvents.length > 0 && <span className="text-blue-400 ml-1">· {calendarEvents.length} events today</span>}
        </span>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])}
            className="ml-auto flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => send(p.text)}
                disabled={loading}
                className="px-3 py-2 bg-white/5 hover:bg-purple-500/15 border border-white/10
                  hover:border-purple-500/30 rounded-xl text-xs text-slate-400 hover:text-purple-300
                  transition-all duration-200 disabled:opacity-50">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <MessageSquare size={26} className="text-purple-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Ask me anything about your tasks</p>
          <p className="text-slate-600 text-xs max-w-xs">
            "What should I do today?", "What's overdue?", "Give me a weekly review" — I know your full task list.
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 space-y-4 mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                  <Sparkles size={13} className="text-purple-400" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-purple-600 text-white text-sm rounded-tr-sm'
                  : 'bg-white/5 border border-white/10 rounded-tl-sm'
              }`}>
                {m.role === 'user'
                  ? <p className="text-sm">{m.content}</p>
                  : <AiText text={m.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center mr-2 flex-shrink-0">
                <Sparkles size={13} className="text-purple-400" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 pt-3 pb-1">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about your tasks…"
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm
              placeholder-slate-500 focus:outline-none focus:border-purple-500/40 disabled:opacity-50
              transition-all duration-200"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="p-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
              text-white rounded-2xl transition-all duration-200 active:scale-95 flex-shrink-0">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Habit Modal ─────────────────────────────────────────────────────────

function AddHabitModal({ onAdd, onClose }) {
  const [name, setName]   = useState('')
  const [emoji, setEmoji] = useState('💪')

  const submit = () => {
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl p-5 animate-slide-down">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">New Habit</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Preset grid */}
        <p className="text-xs text-slate-500 mb-2">Quick pick</p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {PRESET_HABITS.map(p => (
            <button key={p.name} onClick={() => { setEmoji(p.emoji); setName(p.name) }}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                ${name === p.name
                  ? 'bg-purple-500/20 border-purple-500/40'
                  : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
              <span className="text-xl">{p.emoji}</span>
              <span className="text-[10px] text-slate-400 leading-tight text-center">{p.name}</span>
            </button>
          ))}
        </div>

        {/* Custom */}
        <p className="text-xs text-slate-500 mb-2">Or custom</p>
        <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
          {HABIT_EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`text-xl w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all
                ${emoji === e ? 'bg-purple-500/30 ring-1 ring-purple-500/50' : 'bg-white/5 hover:bg-white/10'}`}>
              {e}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Habit name…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
              placeholder-slate-600 focus:outline-none focus:border-purple-500/50" />
          <button onClick={submit} disabled={!name.trim()}
            className="px-5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
              text-white text-sm font-medium rounded-xl transition-all active:scale-95">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Habits Section ───────────────────────────────────────────────────────────

function HabitsSection({ habits, toggleToday, addHabit, removeHabit }) {
  const [showAdd, setShowAdd]   = useState(false)
  const [managing, setManaging] = useState(false)
  const todayStr = toLocalDateStr(new Date())
  const days     = getLast7Days()

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Flame size={15} className="text-orange-400" /> Habits
          </h2>
          <div className="flex gap-2">
            {habits.length > 0 && (
              <button onClick={() => setManaging(m => !m)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                {managing ? 'Done' : 'Manage'}
              </button>
            )}
            <button onClick={() => setShowAdd(true)}
              className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white
                px-2.5 py-1 rounded-lg transition-colors">
              + Add
            </button>
          </div>
        </div>

        {habits.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-3">Track daily habits to build streaks</p>
        ) : (
          <div className="space-y-4">
            {habits.map(habit => {
              const streak = getHabitStreak(habit.history)
              const done   = !!habit.history?.[todayStr]
              return (
                <div key={habit.id} className="flex items-center gap-3">
                  <button onClick={() => toggleToday(habit.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      transition-all duration-200 active:scale-90
                      ${done
                        ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-400 text-base'
                        : 'bg-white/5 hover:bg-white/10 text-xl'}`}>
                    {done ? <Check size={18} /> : habit.emoji}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-sm ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {habit.name}
                      </span>
                      {streak > 0 && (
                        <span className="text-[11px] text-orange-400 font-medium">🔥 {streak}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {days.map(({ str, label }) => (
                        <div key={str} className="flex flex-col items-center gap-0.5">
                          <div className={`w-4 h-4 rounded-full transition-all
                            ${habit.history?.[str]
                              ? 'bg-emerald-500'
                              : str === todayStr
                                ? 'bg-white/15 ring-1 ring-white/25'
                                : 'bg-white/5'}`} />
                          <span className="text-[9px] text-slate-700">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {managing && (
                    <button onClick={() => removeHabit(habit.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <AddHabitModal
          onAdd={(data) => { addHabit(data); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}

// ─── Add Goal Modal ───────────────────────────────────────────────────────────

function AddGoalModal({ onAdd, onClose }) {
  const [title, setTitle]           = useState('')
  const [emoji, setEmoji]           = useState('🎯')
  const [timeframe, setTimeframe]   = useState('month')
  const [description, setDescription] = useState('')

  const GOAL_EMOJIS = ['🎯','💰','🏋️','📚','💻','🌍','❤️','🏠','🚗','✈️','🎓','💡','🏆','🎨','🤝','🧘','🚀','💪']

  const submit = () => {
    if (!title.trim()) return
    onAdd({ title: title.trim(), emoji, timeframe, description: description.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl p-5 animate-slide-down">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">New Goal</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Emoji row */}
        <p className="text-xs text-slate-500 mb-2">Pick an emoji</p>
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {GOAL_EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`text-xl w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all
                ${emoji === e ? 'bg-purple-500/30 ring-1 ring-purple-500/50' : 'bg-white/5 hover:bg-white/10'}`}>
              {e}
            </button>
          ))}
        </div>

        <label className="block mb-3">
          <span className="text-xs text-slate-500 mb-1.5 block">Goal title</span>
          <input value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="e.g. Read 12 books, Save $5k, Learn Spanish"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
              placeholder-slate-600 focus:outline-none focus:border-purple-500/50" />
        </label>

        <div className="mb-3">
          <span className="text-xs text-slate-500 mb-1.5 block">Timeframe</span>
          <div className="grid grid-cols-4 gap-2">
            {GOAL_TIMEFRAMES.map(tf => (
              <button key={tf.id} onClick={() => setTimeframe(tf.id)}
                className={`py-2 text-xs rounded-xl border transition-all
                  ${timeframe === tf.id
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-5">
          <span className="text-xs text-slate-500 mb-1.5 block">Why it matters <span className="text-slate-700">(optional)</span></span>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Your motivation…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
              resize-none placeholder-slate-600 focus:outline-none focus:border-purple-500/50" />
        </label>

        <button onClick={submit} disabled={!title.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
            text-white text-sm font-medium rounded-xl py-3 transition-all active:scale-95">
          Add Goal
        </button>
      </div>
    </div>
  )
}

// ─── Goals Section ────────────────────────────────────────────────────────────

function GoalsSection({ goals, addGoal, updateGoal, removeGoal }) {
  const [showAdd, setShowAdd]               = useState(false)
  const [editingProgress, setEditingProgress] = useState(null)

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Trophy size={15} className="text-yellow-400" /> Goals
          </h2>
          <button onClick={() => setShowAdd(true)}
            className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white
              px-2.5 py-1 rounded-lg transition-colors">
            + Add
          </button>
        </div>

        {goals.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-3">Set goals and track your progress</p>
        ) : (
          <div className="space-y-5">
            {goals.map(goal => {
              const pct       = Math.min(100, Math.max(0, goal.progress || 0))
              const color     = goalProgressColor(pct)
              const tf        = GOAL_TIMEFRAMES.find(t => t.id === goal.timeframe)
              const isEditing = editingProgress === goal.id

              return (
                <div key={goal.id}>
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl flex-shrink-0">{goal.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-200 font-medium truncate">{goal.title}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                          <button onClick={() => setEditingProgress(isEditing ? null : goal.id)}
                            className="p-1 text-slate-600 hover:text-slate-300 transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => removeGoal(goal.id)}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      {tf && <span className="text-[11px] text-slate-600">{tf.label}</span>}
                      {goal.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{goal.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="h-2 bg-white/5 rounded-full overflow-hidden cursor-pointer"
                    onClick={() => setEditingProgress(isEditing ? null : goal.id)}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>

                  {isEditing && (
                    <div className="mt-3 animate-slide-down">
                      <input type="range" min={0} max={100} value={pct}
                        onChange={e => updateGoal(goal.id, { progress: Number(e.target.value) })}
                        className="w-full accent-purple-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-600 -mt-1">
                        <span>0%</span><span>50%</span><span>100%</span>
                      </div>
                      {pct === 100 && (
                        <button
                          onClick={() => { updateGoal(goal.id, { status: 'archived' }); setEditingProgress(null) }}
                          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                          <Check size={12} /> Mark complete & archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <AddGoalModal
          onAdd={(data) => { addGoal(data); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function CalendarStrip({ events, loading, hasToken, calError, onReconnect, onRefresh }) {
  if (!loading && !hasToken && !calError) return null

  const now = new Date()
  const hasError = !!calError

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className={`bg-white/5 border rounded-2xl p-5 ${hasError ? 'border-red-500/20' : 'border-white/10'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className={hasError ? 'text-red-400' : 'text-blue-400'} />
        <h3 className="text-sm font-semibold text-slate-300">Today's Schedule</h3>
        {!hasError && !loading && (
          <button onClick={onRefresh} title="Refresh calendar"
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
        {!hasError && !loading && (
          <span className="text-[10px] text-slate-600">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 animate-pulse">Loading calendar…</p>
      ) : calError?.type === 'auth' ? (
        <div className="py-2 space-y-1.5">
          <p className="text-xs text-red-400 font-medium">Calendar error: {calError.message}</p>
          <button onClick={onReconnect}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors">
            <RefreshCw size={11} /> Reconnect Google Calendar
          </button>
        </div>
      ) : calError?.type === 'network' ? (
        <div className="py-2 space-y-1.5">
          <p className="text-xs text-slate-500">Network error: {calError.message}</p>
          <button onClick={onRefresh}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      ) : !events.length ? (
        <p className="text-xs text-slate-600 text-center py-2">No events today — enjoy the free day 🎉</p>
      ) : (
        <div className="space-y-1.5">
          {events.map(ev => {
            const isAllDay  = !ev.start?.dateTime
            const start     = isAllDay ? null : new Date(ev.start.dateTime)
            const end       = isAllDay ? null : new Date(ev.end.dateTime)
            const isPast    = end ? end < now : false
            const isCurrent = start && end ? start <= now && now <= end : false

            return (
              <div key={ev.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                  ${isCurrent ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-white/5'}
                  ${isPast ? 'opacity-40' : ''}`}>
                <div className="w-16 flex-shrink-0 text-right">
                  {isAllDay
                    ? <span className="text-[10px] text-slate-500">All day</span>
                    : <><p className="text-xs font-medium text-blue-300">{formatTime(ev.start.dateTime)}</p>
                       <p className="text-[10px] text-slate-500">{formatTime(ev.end.dateTime)}</p></>
                  }
                </div>
                <div className={`w-0.5 h-8 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-400' : 'bg-white/10'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{ev.summary || 'Untitled'}</p>
                  {ev.location && <p className="text-[10px] text-slate-500 truncate">{ev.location}</p>}
                </div>
                {isCurrent && <span className="text-[10px] text-blue-400 font-medium flex-shrink-0">Now</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HomeTab({ tasks, habits, goals, finance, toggleToday, addHabit, removeHabit, addGoal, updateGoal, removeGoal, apiKey, totalXP, calendarEvents, calLoading, calError, hasToken, onCalReconnect, onCalRefresh }) {
  const todayStr = toLocalDateStr(new Date())
  const [brief, setBrief] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BRIEF_KEY) || 'null')
      if (saved?.date === todayStr) return saved.text
    } catch {}
    return null
  })
  const [briefLoading, setBriefLoading] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dayName  = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const activeTasks  = tasks.filter(t => !t.completed)
  const todayTasks   = activeTasks.filter(t => classifyTask(t) === 'today')
  const overdueTasks = activeTasks.filter(t => classifyTask(t) === 'overdue')
  const todayDone    = tasks.filter(t => t.completed && t.completedAt && isoToLocalDate(t.completedAt) === todayStr)
  const habitsToday  = habits.filter(h => !!h.history?.[todayStr])
  const habitsPct    = habits.length > 0 ? Math.round((habitsToday.length / habits.length) * 100) : 0

  // Top-3 focus: overdue first, then today, then high-priority — deduplicated
  const focusTasks = [...overdueTasks, ...todayTasks, ...activeTasks.filter(t => t.priority === 'high')]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .slice(0, 3)

  const fetchBrief = async () => {
    if (briefLoading) return
    setBriefLoading(true)
    try {
      const calCtx = calendarEvents.length
        ? ` I have ${calendarEvents.length} calendar event(s) today.`
        : ''
      const { response } = await aiAssist(
        [{ role: 'user', content: `Give me a quick morning brief. What's my situation today? Any overdue items, what's due today, top priorities, key meetings.${calCtx} Be direct and energizing. Under 120 words.` }],
        tasks, apiKey, habits, goals, calendarEvents,
      )
      setBrief(response)
      localStorage.setItem(BRIEF_KEY, JSON.stringify({ date: todayStr, text: response }))
    } catch (err) {
      setBrief(`⚠ ${err.message.slice(0, 60)}`)
    }
    setBriefLoading(false)
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Level card */}
      <LevelCard totalXP={totalXP} />

      {/* CEO Score */}
      <CeoScoreCard tasks={tasks} habits={habits} finance={finance} />

      {/* Greeting card */}
      <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent border border-white/10 rounded-2xl p-5">
        <p className="text-slate-400 text-sm">{dayName}, {dateStr}</p>
        <h2 className="text-xl font-bold text-white mt-0.5">{greeting} 👋</h2>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{todayTasks.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Due today</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-400' : 'text-white'}`}>
              {overdueTasks.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Overdue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{todayDone.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Done today</p>
          </div>
        </div>

        {habits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Today's habits</span>
              <span className="text-xs font-semibold text-orange-400">{habitsToday.length}/{habits.length}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${habitsPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Calendar Strip */}
      <CalendarStrip events={calendarEvents} loading={calLoading} hasToken={!!hasToken}
        calError={calError} onReconnect={onCalReconnect} onRefresh={onCalRefresh} />

      {/* AI Brief */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" /> AI Brief
          </h3>
          <button onClick={fetchBrief} disabled={briefLoading}
            className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-50
              flex items-center gap-1 transition-colors">
            {briefLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            {brief ? 'Refresh' : 'Generate'}
          </button>
        </div>
        {brief
          ? <AiText text={brief} />
          : briefLoading
            ? <p className="text-xs text-slate-500 animate-pulse">Analyzing your day…</p>
            : <p className="text-xs text-slate-600">Tap Generate for a personalized morning brief.</p>
        }
      </div>

      {/* Today's focus */}
      {focusTasks.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Target size={14} className="text-blue-400" /> Today's Focus
          </h3>
          <div className="space-y-2">
            {focusTasks.map((t, i) => {
              const cat       = CATEGORY_MAP[t.category]
              const isOverdue = classifyTask(t) === 'overdue'
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <span className="text-slate-600 font-mono text-xs w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: cat?.color }}>{cat?.label}</span>
                      {isOverdue && <span className="text-[10px] text-red-400">Overdue</span>}
                      {t.duration && <span className="text-[10px] text-slate-600">{DURATION_LABELS[t.duration]}</span>}
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PRIORITIES[t.priority] }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Habits */}
      <HabitsSection habits={habits} toggleToday={toggleToday} addHabit={addHabit} removeHabit={removeHabit} />

      {/* Goals */}
      <GoalsSection goals={goals} addGoal={addGoal} updateGoal={updateGoal} removeGoal={removeGoal} />
    </div>
  )
}

// ─── Level Card ──────────────────────────────────────────────────────────────

function LevelCard({ totalXP }) {
  const info = getLevel(totalXP)
  return (
    <div className="bg-gradient-to-r from-purple-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/40 to-amber-500/20 flex items-center justify-center">
            <Star size={18} className="text-amber-400" fill="currentColor" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Level {info.level} · {info.name}</p>
            <p className="text-xs text-slate-500">{totalXP.toLocaleString()} XP earned</p>
          </div>
        </div>
        {info.next && (
          <div className="text-right">
            <p className="text-xs text-amber-400 font-medium">{(info.xpNeeded - info.xpIn).toLocaleString()} XP</p>
            <p className="text-[10px] text-slate-600">to Level {info.next.level}</p>
          </div>
        )}
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-500 to-amber-400"
          style={{ width: `${info.pct}%` }} />
      </div>
    </div>
  )
}

// ─── Level Up Modal ───────────────────────────────────────────────────────────

function LevelUpModal({ levelInfo, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md"
      onClick={onClose}>
      <div className="text-center px-8 animate-slide-down">
        <div className="text-7xl mb-5 animate-bounce">⭐</div>
        <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Level Up!</p>
        <h2 className="text-6xl font-black text-white mb-2">{levelInfo.level}</h2>
        <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
          {levelInfo.name}
        </p>
        <p className="text-slate-500 text-sm mt-8">Tap to continue</p>
      </div>
    </div>
  )
}

// ─── Achievements Section ─────────────────────────────────────────────────────

function AchievementsSection({ unlocked }) {
  const earnedXP = ACHIEVEMENTS_LIST.filter(a => unlocked.includes(a.id)).reduce((s, a) => s + a.xp, 0)
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Award size={14} className="text-amber-400" /> Achievements
        </h3>
        <span className="text-xs text-slate-500">
          {unlocked.length}/{ACHIEVEMENTS_LIST.length} · {earnedXP} XP earned
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACHIEVEMENTS_LIST.map(a => {
          const done = unlocked.includes(a.id)
          return (
            <div key={a.id}
              className={`p-3 rounded-xl border transition-all ${
                done
                  ? 'bg-purple-500/10 border-purple-500/25'
                  : 'bg-white/[0.02] border-white/5 opacity-45'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl leading-none">{done ? a.icon : '🔒'}</span>
                <span className="text-xs font-semibold text-white truncate">{a.title}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight mb-1">{a.desc}</p>
              <p className="text-[10px] text-amber-400 font-medium">+{a.xp} XP</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Floating Capture ────────────────────────────────────────────────────────

function FloatingCapture({ onAdd, addToast, apiKey }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-purple-600 hover:bg-purple-500
          text-white rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center
          transition-all duration-200 active:scale-90 hover:scale-105">
        <Plus size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-t-2xl p-5 pb-8 animate-slide-down">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400" /> Capture anything
              </span>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <QuickCapture
              onAdd={(parsed) => { onAdd(parsed); setOpen(false) }}
              addToast={addToast}
              apiKey={apiKey}
            />
          </div>
        </div>
      )}
    </>
  )
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────

// ─── CEO Score Card ──────────────────────────────────────────────────────────

function CeoScoreCard({ tasks, habits, finance }) {
  const todayStr = toLocalDateStr(new Date())
  const completed  = tasks.filter(t => t.completed).length
  const total      = tasks.length
  const opsScore   = total > 0 ? Math.round((completed / total) * 100) : 0

  const netSalary  = finance?.salary?.net || 0
  const totalSubs  = (finance?.subscriptions || []).reduce((s, sub) => s + toMonthly(sub.amount, sub.period), 0)
  const totalExp   = (finance?.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)
  const disposable = netSalary - totalSubs - totalExp
  const finScore   = netSalary > 0 ? Math.max(0, Math.min(100, Math.round((disposable / netSalary) * 100))) : 0

  const habitsToday = habits.filter(h => !!h.history?.[todayStr]).length
  const habitPct    = habits.length > 0 ? Math.round((habitsToday / habits.length) * 100) : 0

  const overall = Math.round((opsScore + (netSalary > 0 ? finScore : opsScore) + habitPct) / (netSalary > 0 ? 3 : 2))

  const ScoreMeter = ({ label, score, color }) => (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${(score / 100) * 138.2} 138.2`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{score}</span>
      </div>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  )

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" /> CEO Score
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/30 to-purple-500/20 flex items-center justify-center">
            <span className="text-sm font-black text-amber-400">{overall}</span>
          </div>
          <span className="text-[10px] text-slate-500">Overall</span>
        </div>
      </div>
      <div className="flex justify-around">
        <ScoreMeter label="Operations" score={opsScore}  color="#8B5CF6" />
        <ScoreMeter label="Habits"     score={habitPct}  color="#F59E0B" />
        {netSalary > 0 && <ScoreMeter label="Finance"  score={finScore}  color="#10B981" />}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-amber-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${overall}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Finance Forms ────────────────────────────────────────────────────────────

function AddSubForm({ onAdd, onClose }) {
  const [name, setName]     = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('monthly')
  const [cat, setCat]       = useState('Streaming')

  const cats = ['Streaming','Software','Fitness','Music','News','Gaming','Utilities','Other']

  const submit = (e) => {
    e.preventDefault()
    if (!name || !amount) return
    onAdd({ name: name.trim(), amount: parseFloat(amount), period, category: cat })
    onClose()
  }
  return (
    <form onSubmit={submit} className="bg-[#0f1117] border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-white">Add subscription</span>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (Netflix, Spotify…)"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount €"
          min="0" step="0.01"
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50" />
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50">
          {SUB_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <select value={cat} onChange={e => setCat(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50">
        {cats.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors">
        Add Subscription
      </button>
    </form>
  )
}

function AddExpenseForm({ onAdd, onClose }) {
  const [name, setName]     = useState('')
  const [amount, setAmount] = useState('')
  const [cat, setCat]       = useState('Housing')

  const cats = ['Housing','Food','Transport','Health','Education','Clothing','Leisure','Other']

  const submit = (e) => {
    e.preventDefault()
    if (!name || !amount) return
    onAdd({ name: name.trim(), amount: parseFloat(amount), category: cat })
    onClose()
  }
  return (
    <form onSubmit={submit} className="bg-[#0f1117] border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-white">Add fixed expense</span>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (Rent, Insurance…)"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount €/mo"
          min="0" step="0.01"
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50" />
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50">
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors">
        Add Expense
      </button>
    </form>
  )
}

// ─── Finance Tab ──────────────────────────────────────────────────────────────

function FinanceTab({ finance, updateSalary, addSubscription, removeSubscription, addExpense, removeExpense, importData, apiKey, addToast }) {
  const [section, setSection]         = useState('summary')
  const [showSubForm, setShowSubForm] = useState(false)
  const [showExpForm, setShowExpForm] = useState(false)
  const [editSalary, setEditSalary]   = useState(false)
  const [salNet, setSalNet]           = useState(String(finance.salary?.net || ''))
  const [salBrut, setSalBrut]         = useState(String(finance.salary?.brut || ''))
  const [aiMessages, setAiMessages]   = useState([])
  const [aiInput, setAiInput]         = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [importText, setImportText]   = useState('')
  const [importing, setImporting]     = useState(false)
  const [importMode, setImportMode]   = useState('file')  // 'file' | 'paste'
  const [importFile, setImportFile]   = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const fileInputRef = useRef(null)

  const subs   = finance.subscriptions || []
  const exps   = finance.expenses || []
  const net    = finance.salary?.net || 0
  const brut   = finance.salary?.brut || 0

  const totalSubMonthly = subs.reduce((s, sub) => s + toMonthly(sub.amount, sub.period), 0)
  const totalExpMonthly = exps.reduce((s, e) => s + (e.amount || 0), 0)
  const totalFixed      = totalSubMonthly + totalExpMonthly
  const disposable      = net - totalFixed
  const savingsRate     = net > 0 ? Math.max(0, (disposable / net) * 100) : 0

  const saveSalary = () => {
    updateSalary({ net: parseFloat(salNet) || 0, brut: parseFloat(salBrut) || 0 })
    setEditSalary(false)
    addToast('✓ Salary saved')
  }

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return
    const userMsg = { role: 'user', content: aiInput.trim() }
    setAiMessages(p => [...p, userMsg])
    setAiInput('')
    setAiLoading(true)
    try {
      const finCtx = `My finances: net salary ${fmtMoney(net)}/mo (brut ${fmtMoney(brut)}), ${subs.length} subscriptions costing ${fmtMoney(totalSubMonthly)}/mo, fixed expenses ${fmtMoney(totalExpMonthly)}/mo, disposable ${fmtMoney(disposable)}/mo (${savingsRate.toFixed(0)}% savings rate). I'm in France.`
      const systemExtra = `\n\nFINANCE CONTEXT:\n${finCtx}\nYou are a French personal finance advisor. Give specific, actionable advice. Mention French specifics (LEP, Livret A, PEA, PER, CAF, impôts) where relevant. Under 150 words unless asked for detail.`
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...aiMessages, userMsg],
          tasks: [], habits: [], goals: [], calendarEvents: [],
          todayStr: toLocalDateStr(new Date()),
          dayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          apiKey,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          systemSuffix: systemExtra,
        }),
      })
      const data = await res.json()
      setAiMessages(p => [...p, { role: 'assistant', content: data.response || data.error || 'Error' }])
    } catch (err) {
      setAiMessages(p => [...p, { role: 'assistant', content: '⚠ ' + err.message }])
    }
    setAiLoading(false)
  }

  // ── shared: call the API and set importResult for preview ──
  const runParseApi = async ({ text, imageBase64, pdfBase64, mimeType, sourceName }) => {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/parse-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageBase64, pdfBase64, mimeType, apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const hasAnything = data.salary?.net || data.subscriptions?.length || data.expenses?.length
      if (!hasAnything) {
        addToast('⚠ No financial data detected in this document', 'info')
      } else {
        setImportResult({ data, sourceName })
      }
    } catch (err) {
      addToast('⚠ Parse failed: ' + err.message, 'error')
    }
    setImporting(false)
  }

  // ── apply parsed data to finance profile ──
  const applyImportResult = () => {
    if (!importResult) return
    const { data, sourceName } = importResult
    let count = 0
    if (data.salary?.net) {
      updateSalary({ net: data.salary.net, brut: data.salary.brut || 0 })
      setSalNet(String(data.salary.net)); setSalBrut(String(data.salary.brut || 0))
    }
    ;(data.subscriptions || []).forEach(s => { addSubscription(s); count++ })
    ;(data.expenses || []).forEach(e => { addExpense(e); count++ })
    const parts = []
    if (data.salary?.net) parts.push('salary updated')
    if (count > 0) parts.push(`${count} item${count !== 1 ? 's' : ''} added`)
    addToast(`✓ Imported from "${sourceName}": ${parts.join(', ')}`)
    setImportResult(null); setImportFile(null); setImportText('')
  }

  // ── handle file selection + analyze ──
  const handleFileAnalyze = async () => {
    if (!importFile || importing) return
    const file = importFile
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Send PDF as base64 to server — text extraction runs in Node.js there (no browser pdfjs needed)
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = e => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await runParseApi({ pdfBase64: base64, sourceName: file.name })

      } else if (file.type.startsWith('image/')) {
        // Send image to GPT-4o vision
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = e => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await runParseApi({ imageBase64: base64, mimeType: file.type, sourceName: file.name })

      } else {
        // CSV / TXT: read as plain text
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = e => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsText(file, 'UTF-8')
        })
        await runParseApi({ text, sourceName: file.name })
      }
    } catch (err) {
      addToast('⚠ Could not read file: ' + err.message, 'error')
      setImporting(false)
    }
  }

  // ── paste mode ──
  const handlePasteImport = async () => {
    if (!importText.trim() || importing) return
    await runParseApi({ text: importText, sourceName: 'pasted text' })
  }

  const pills = [
    { id: 'summary',  label: 'Summary',   emoji: '📊' },
    { id: 'subs',     label: 'Subs',      emoji: '📱' },
    { id: 'expenses', label: 'Expenses',  emoji: '🏠' },
    { id: 'cashflow', label: 'Cash Flow', emoji: '💸' },
    { id: 'savings',  label: 'Savings',   emoji: '🏦' },
    { id: 'import',   label: 'Import',    emoji: '📂' },
    { id: 'ai',       label: 'AI Tips',   emoji: '🤖' },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Euro size={20} className="text-emerald-400" /> Finance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Personal finance command center</p>
        </div>
        {net > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Disposable/mo</p>
            <p className={`text-base font-bold ${disposable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtMoney(disposable)}
            </p>
          </div>
        )}
      </div>

      {/* Pill nav */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {pills.map(p => (
          <button key={p.id} onClick={() => setSection(p.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${section === p.id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-500 border border-white/5 hover:text-white'}`}>
            <span>{p.emoji}</span> {p.label}
          </button>
        ))}
      </div>

      {/* ── Summary ── */}
      {section === 'summary' && (
        <div className="space-y-3">
          {/* Salary card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-400" /> Salary
              </h3>
              <button onClick={() => setEditSalary(e => !e)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                {editSalary ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editSalary ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Net / month</label>
                    <input type="number" value={salNet} onChange={e => setSalNet(e.target.value)}
                      placeholder="2500" min="0"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Brut / month</label>
                    <input type="number" value={salBrut} onChange={e => setSalBrut(e.target.value)}
                      placeholder="3200" min="0"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
                  </div>
                </div>
                <button onClick={saveSalary}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Save Salary
                </button>
              </div>
            ) : net > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500">Net</p>
                  <p className="text-lg font-bold text-emerald-400">{fmtMoney(net)}</p>
                  <p className="text-[10px] text-slate-600">per month</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500">Brut</p>
                  <p className="text-lg font-bold text-slate-300">{fmtMoney(brut)}</p>
                  <p className="text-[10px] text-slate-600">per month</p>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditSalary(true)}
                className="w-full py-3 border border-dashed border-white/10 rounded-xl text-sm text-slate-500 hover:text-white hover:border-white/20 transition-colors">
                + Add your salary
              </button>
            )}
          </div>

          {/* Flow summary grid */}
          {net > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-500/10 border border-red-500/15 rounded-2xl p-3">
                <p className="text-[10px] text-slate-500 flex items-center gap-1"><CreditCard size={10} /> Subscriptions</p>
                <p className="text-lg font-bold text-red-400">{fmtMoney(totalSubMonthly)}</p>
                <p className="text-[10px] text-slate-600">/month · {subs.length} active</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/15 rounded-2xl p-3">
                <p className="text-[10px] text-slate-500 flex items-center gap-1"><Wallet size={10} /> Fixed Expenses</p>
                <p className="text-lg font-bold text-orange-400">{fmtMoney(totalExpMonthly)}</p>
                <p className="text-[10px] text-slate-600">/month · {exps.length} items</p>
              </div>
              <div className={`col-span-2 border rounded-2xl p-3 ${disposable >= 0 ? 'bg-emerald-500/10 border-emerald-500/15' : 'bg-red-500/10 border-red-500/15'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><PiggyBank size={10} /> Disposable Income</p>
                    <p className={`text-2xl font-black ${disposable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(disposable)}</p>
                    <p className="text-[10px] text-slate-600">per month after all fixed costs</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {savingsRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-slate-500">savings rate</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Subscriptions ── */}
      {section === 'subs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Total: <span className="text-red-400 font-bold">{fmtMoney(totalSubMonthly)}/mo</span></p>
            <button onClick={() => setShowSubForm(true)}
              className="flex items-center gap-1.5 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-full hover:bg-purple-600/30 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
          {showSubForm && <AddSubForm onAdd={addSubscription} onClose={() => setShowSubForm(false)} />}
          {subs.length === 0 && !showSubForm ? (
            <div className="text-center py-12">
              <CreditCard size={36} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No subscriptions tracked yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subs.map(sub => {
                const monthly = toMonthly(sub.amount, sub.period)
                return (
                  <div key={sub.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{sub.name}</p>
                      <p className="text-[10px] text-slate-500">{sub.category || 'Other'} · {sub.period}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-red-400">{fmtMoney(monthly)}<span className="text-[10px] text-slate-500">/mo</span></p>
                      {sub.period !== 'monthly' && <p className="text-[10px] text-slate-600">{fmtMoney(sub.amount)} {sub.period}</p>}
                    </div>
                    <button onClick={() => removeSubscription(sub.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {subs.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Monthly total</span>
                <span className="font-bold text-red-400">{fmtMoney(totalSubMonthly)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500 text-xs">Yearly total</span>
                <span className="text-slate-400 text-xs">{fmtMoney(totalSubMonthly * 12)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Expenses ── */}
      {section === 'expenses' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Total: <span className="text-orange-400 font-bold">{fmtMoney(totalExpMonthly)}/mo</span></p>
            <button onClick={() => setShowExpForm(true)}
              className="flex items-center gap-1.5 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-full hover:bg-purple-600/30 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
          {showExpForm && <AddExpenseForm onAdd={addExpense} onClose={() => setShowExpForm(false)} />}
          {exps.length === 0 && !showExpForm ? (
            <div className="text-center py-12">
              <Wallet size={36} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No fixed expenses tracked yet</p>
              <p className="text-slate-600 text-xs mt-1">Add rent, insurance, loan payments…</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exps.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{exp.name}</p>
                    <p className="text-[10px] text-slate-500">{exp.category || 'Other'}</p>
                  </div>
                  <p className="text-sm font-bold text-orange-400 flex-shrink-0">{fmtMoney(exp.amount)}<span className="text-[10px] text-slate-500">/mo</span></p>
                  <button onClick={() => removeExpense(exp.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {exps.length > 0 && (
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total fixed/mo</span>
                <span className="font-bold text-orange-400">{fmtMoney(totalExpMonthly)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cash Flow Simulator ── */}
      {section === 'cashflow' && (
        <div className="space-y-3">
          {net === 0 ? (
            <div className="text-center py-12">
              <TrendingUp size={36} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Add your salary in Summary first</p>
              <button onClick={() => setSection('summary')} className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">→ Go to Summary</button>
            </div>
          ) : (
            <>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Monthly Cash Flow</h3>
                {[
                  { label: 'Net Salary',     value: net,              color: 'bg-emerald-500', pct: 100 },
                  { label: 'Subscriptions',  value: -totalSubMonthly, color: 'bg-red-500',     pct: net > 0 ? (totalSubMonthly/net)*100 : 0 },
                  { label: 'Fixed Expenses', value: -totalExpMonthly, color: 'bg-orange-500',  pct: net > 0 ? (totalExpMonthly/net)*100 : 0 },
                  { label: 'Disposable',     value: disposable,       color: disposable >= 0 ? 'bg-blue-500' : 'bg-red-600', pct: net > 0 ? Math.abs(disposable/net)*100 : 0 },
                ].map(row => (
                  <div key={row.label} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{row.label}</span>
                      <span className={row.value < 0 ? 'text-red-400' : 'text-emerald-400'}>{fmtMoney(row.value)}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color} transition-all duration-700`}
                        style={{ width: `${Math.min(100, Math.abs(row.pct)).toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Yearly savings', value: fmtMoney(Math.max(0, disposable * 12)), sub: 'if fully saved' },
                  { label: 'Savings rate',   value: `${savingsRate.toFixed(0)}%`,           sub: savingsRate >= 20 ? '🟢 Excellent' : savingsRate >= 10 ? '🟡 Good' : '🔴 Low' },
                  { label: 'Fixed costs',    value: fmtMoney(totalFixed),                   sub: 'per month' },
                ].map(card => (
                  <div key={card.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500 mb-1">{card.label}</p>
                    <p className="text-sm font-bold text-white">{card.value}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setSection('import')}
                className="w-full py-2.5 border border-dashed border-purple-500/30 text-purple-400 hover:bg-purple-500/5 text-xs rounded-xl transition-colors flex items-center justify-center gap-2">
                <Upload size={12} /> Import from payslip or bank statement
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Savings Opportunities ── */}
      {section === 'savings' && (
        <div className="space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-emerald-300 mb-1">🇫🇷 Épargne en France</h3>
            <p className="text-xs text-slate-500">Savings vehicles available in France, ordered by priority for most people.</p>
            {net > 0 && disposable > 0 && (
              <p className="text-xs text-emerald-400 mt-2 font-medium">
                You have {fmtMoney(disposable)}/mo to save — here's where to put it:
              </p>
            )}
          </div>
          <div className="space-y-2">
            {SAVINGS_VEHICLES.map((v, i) => (
              <div key={v.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{v.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{v.name}</p>
                      {v.rate && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">
                          {v.rate}%
                        </span>
                      )}
                      {v.cap && (
                        <span className="text-[10px] text-slate-500">cap {fmtMoney(v.cap)}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{v.desc}</p>
                    {v.id === 'lep' && net > 0 && (
                      <p className={`text-[10px] mt-1.5 font-medium ${net <= 2200 ? 'text-emerald-400' : 'text-yellow-500'}`}>
                        {net <= 2200 ? '✓ You likely qualify (net ≤ €2,200/mo)' : '⚠ Check eligibility — limit ~€2,200/mo net'}
                      </p>
                    )}
                    {v.id === 'prime' && net > 0 && (
                      <a href="https://www.caf.fr/allocataires/droits-et-prestations/s-informer-sur-les-aides/solidarite-et-insertion/la-prime-d-activite" target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 block">
                        → Simuler sur CAF.fr
                      </a>
                    )}
                  </div>
                  <span className="text-slate-600 text-xs flex-shrink-0 font-mono">#{i+1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Import ── */}
      {section === 'import' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-white/[0.06] rounded-xl p-1">
            <button onClick={() => setImportMode('file')}
              className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5
                ${importMode === 'file' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <FileText size={12} /> Upload File
            </button>
            <button onClick={() => setImportMode('paste')}
              className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5
                ${importMode === 'paste' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <Pencil size={12} /> Paste Text
            </button>
          </div>

          {importMode === 'file' ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setImportFile(f) }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                  ${importFile
                    ? 'border-purple-500/50 bg-purple-500/5'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/[0.02]'}`}>
                <input ref={fileInputRef} type="file" accept=".pdf,.csv,.txt,image/*" className="hidden"
                  onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null) }} />
                {importFile ? (
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                      <FileText size={18} className="text-purple-400" />
                    </div>
                    <p className="text-sm text-white font-medium truncate px-4">{importFile.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(importFile.size / 1024).toFixed(0)} KB</p>
                    <button onClick={e => { e.stopPropagation(); setImportFile(null); setImportResult(null) }}
                      className="text-xs text-red-400 hover:text-red-300 mt-2 transition-colors">× Remove</button>
                  </div>
                ) : (
                  <div>
                    <Upload size={28} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400 font-medium">Tap to select or drop a file</p>
                    <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                      {['PDF', 'CSV', 'TXT', 'JPG', 'PNG'].map(f => (
                        <span key={f} className="text-[10px] bg-white/5 text-slate-500 px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2">Bulletin de paie · Relevé bancaire · Screenshot</p>
                  </div>
                )}
              </div>

              <button onClick={handleFileAnalyze} disabled={!importFile || importing}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> Analyzing document…</>
                  : <><Sparkles size={14} /> Analyze with AI</>}
              </button>
            </>
          ) : (
            <>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                placeholder="Paste content from your bulletin de paie, relevé bancaire, or any financial document…"
                rows={7}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50 resize-none" />
              <button onClick={handlePasteImport} disabled={!importText.trim() || importing}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> Parsing…</>
                  : <><Sparkles size={14} /> Parse with AI</>}
              </button>
            </>
          )}

          {/* ── Result preview ── */}
          {importResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <Check size={14} /> Found in "{importResult.sourceName}"
                </h3>
                <button onClick={() => setImportResult(null)} className="text-slate-500 hover:text-white p-1"><X size={14}/></button>
              </div>
              {importResult.data.salary?.net && (
                <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5"><DollarSign size={11}/> Salary</span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {fmtMoney(importResult.data.salary.net)} net
                    {importResult.data.salary.brut ? ` · ${fmtMoney(importResult.data.salary.brut)} brut` : ''}
                  </span>
                </div>
              )}
              {(importResult.data.subscriptions || []).map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-red-500/5 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5"><CreditCard size={11}/> {s.name}</span>
                  <span className="text-xs font-medium text-red-400">{fmtMoney(toMonthly(s.amount, s.period))}/mo</span>
                </div>
              ))}
              {(importResult.data.expenses || []).map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-orange-500/5 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5"><Wallet size={11}/> {e.name}</span>
                  <span className="text-xs font-medium text-orange-400">{fmtMoney(e.amount)}/mo</span>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={applyImportResult}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  💾 Save to Finance Profile
                </button>
                <button onClick={() => setImportResult(null)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Privacy notice ── */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
            <button onClick={() => setPrivacyOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs transition-colors hover:bg-white/5">
              <span className="text-slate-500 flex items-center gap-2"><Lock size={11} className="text-slate-600"/> What happens to my documents?</span>
              {privacyOpen ? <ChevronUp size={12} className="text-slate-600"/> : <ChevronDown size={12} className="text-slate-600"/>}
            </button>
            {privacyOpen && (
              <div className="px-4 pb-4 space-y-2.5 border-t border-white/5 pt-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-emerald-400 font-medium">PDF</span> — Text is extracted page by page <strong>in your browser</strong> using PDF.js. Only the extracted text is sent to OpenAI. The file itself never leaves your device.
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-blue-400 font-medium">CSV / TXT</span> — Content is sent directly to OpenAI for analysis. No copy is stored on any LifeOps server.
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-purple-400 font-medium">Images (JPG, PNG, screenshot)</span> — The image is sent to OpenAI's vision API for analysis. No copy is stored on any LifeOps server.
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-amber-400 font-medium">After analysis</span> — Only structured data (salary, subscriptions, expenses) is saved in LifeOps. Raw document text and images are never stored.
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Per OpenAI's API terms, your data is <strong>not used to train AI models</strong>. It may be retained up to 30 days for safety/abuse monitoring only.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI Finance Advisor ── */}
      {section === 'ai' && (
        <div className="space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <p className="text-xs text-emerald-300 font-medium">🤖 AI Finance Advisor</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Personalized advice based on your financial profile. France-specific.</p>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {aiMessages.length === 0 && (
              <div className="space-y-2">
                {['How should I allocate my savings?', 'Am I spending too much on subscriptions?', 'What is the LEP and do I qualify?', 'How to optimize my taxes in France?'].map(q => (
                  <button key={q} onClick={() => { setAiInput(q) }}
                    className="w-full text-left text-xs text-slate-400 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-3 py-2.5 transition-colors">
                    → {q}
                  </button>
                ))}
              </div>
            )}
            {aiMessages.map((m, i) => (
              <div key={i} className={`rounded-xl p-3 text-sm ${m.role === 'user' ? 'bg-purple-600/20 text-white ml-8' : 'bg-white/5 text-slate-300 mr-4'}`}>
                {m.role === 'assistant' ? <AiText text={m.content} /> : m.content}
              </div>
            ))}
            {aiLoading && (
              <div className="bg-white/5 rounded-xl p-3 mr-4">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiSend()}
              placeholder="Ask about your finances…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50" />
            <button onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()}
              className="px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────

function BottomNav({ activeTab, setActiveTab, activeTasks }) {
  const tabs = [
    { id: 'home',     icon: Home,        label: 'Home',     badge: 0 },
    { id: 'tasks',    icon: ListTodo,    label: 'Tasks',    badge: activeTasks },
    { id: 'ai',       icon: Sparkles,    label: 'AI',       badge: 0 },
    { id: 'insights', icon: BarChart2,   label: 'Insights', badge: 0 },
    { id: 'finance',  icon: TrendingUp,  label: 'Finance',  badge: 0 },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40
      bg-[#0a0d14]/95 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto flex">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
              ${activeTab === t.id ? 'text-purple-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <div className="relative">
              <t.icon size={20} />
              {t.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 text-[9px] bg-purple-500 text-white
                  rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-bold leading-none">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { session, signIn, signOut, userId } = useAuth()
  const { toasts, add: addToast, dismiss } = useToast()
  const { tasks, addTask, toggleTask, deleteTask, restoreTask, updateTask, toggleSubtask, clearCompleted, loadFromCloud: loadTasks, uploadMissing } = useTasks(userId)
  const { habits, addHabit, toggleToday, removeHabit, loadFromCloud: loadHabits } = useHabits(userId)
  const { goals, addGoal, updateGoal, removeGoal, loadFromCloud: loadGoals } = useGoals(userId)
  const { finance, updateSalary, addSubscription, removeSubscription, updateSubscription, addExpense, removeExpense, importData } = useFinance(userId)
  const { total: totalXP, addXP } = useXP(userId)
  const { unlocked, tryUnlock } = useAchievements(userId)

  const handleSyncNow = useCallback(async () => {
    addToast('Syncing from cloud…', 'info')
    await Promise.all([loadTasks(), loadHabits(), loadGoals()])
    addToast('✓ Synced from cloud', 'success')
  }, [loadTasks, loadHabits, loadGoals, addToast])

  const handleUploadLocal = useCallback(async () => {
    addToast('Uploading missing local data…', 'info')
    const n = await uploadMissing()
    addToast(n > 0 ? `✓ Uploaded ${n} missing task${n > 1 ? 's' : ''}` : '✓ Nothing missing — all in sync', 'success')
  }, [uploadMissing, addToast])
  const { todayEvents: calendarEvents, calLoading, calError, fetchEvents, refetchToday } = useCalendar(session)

  const [apiKey, setApiKey]             = useState(() => localStorage.getItem(AI_KEY_STORAGE) || '')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab]       = useState('home')
  const [levelUpTarget, setLevelUpTarget] = useState(null)

  // Detect level-up
  const prevLevelRef = useRef(null)
  useEffect(() => {
    const cur = getLevel(totalXP).level
    if (prevLevelRef.current !== null && cur > prevLevelRef.current) {
      setLevelUpTarget(getLevel(totalXP))
      if (cur >= 5 && tryUnlock('level_5')) setTimeout(() => addToast('👑 Going Pro! +50 XP'), 800)
    }
    prevLevelRef.current = cur
  }, [totalXP])
  const [search, setSearch]       = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [statusFilter, setStatusFilter]     = useState('all')

  const saveApiKey = useCallback((key) => {
    setApiKey(key)
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  }, [])

  const handleAddTaskWithScheduling = useCallback(async (parsed) => {
    const task = addTask(parsed)
    const todayStr = toLocalDateStr(new Date())
    if (parsed.dueDate === todayStr && session?.provider_token) {
      const events = calendarEvents.length ? calendarEvents : await fetchEvents(todayStr)
      const slots  = getFreeSlots(events, (parsed.duration === 'quick' ? 10 : parsed.duration === '30m' ? 30 : parsed.duration === '1h' ? 60 : 30))
      if (slots.length > 0) {
        const slot = slots[0]
        const time = slot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        setTimeout(() => addToast(`📅 Free slot at ${time} — good time for "${task.title.slice(0, 25)}"`, 'info'), 600)
      }
    }
    return task
  }, [addTask, calendarEvents, fetchEvents, session, addToast])

  const handleDelete = useCallback((id) => {
    const task = tasks.find(t => t.id === id)
    deleteTask(id)
    if (task) addToast(`Deleted: ${task.title.slice(0, 28)}…`, 'error', () => restoreTask(task))
  }, [tasks, deleteTask, restoreTask, addToast])

  const handleToggle = useCallback((id) => {
    const task = tasks.find(t => t.id === id)
    toggleTask(id)
    if (!task?.completed) {
      const xp = calcTaskXP(task)
      addXP(xp)
      addToast(task.repeat ? `✓ Done! +${xp} XP — next ${task.repeat} scheduled` : `✓ Done! +${xp} XP`)
      const todayStr     = toLocalDateStr(new Date())
      const doneSoFar    = tasks.filter(t => t.completed).length + 1
      const highDone     = tasks.filter(t => t.completed && t.priority === 'high').length + (task.priority === 'high' ? 1 : 0)
      const todayDone    = tasks.filter(t => t.completed && t.completedAt && isoToLocalDate(t.completedAt) === todayStr).length + 1
      if (doneSoFar === 1  && tryUnlock('first_task')) setTimeout(() => { addXP(15); addToast('🎯 First Step! +15 XP') }, 700)
      if (doneSoFar === 10 && tryUnlock('tasks_10'))  setTimeout(() => { addXP(30); addToast('✅ Getting Things Done! +30 XP') }, 700)
      if (doneSoFar === 50 && tryUnlock('tasks_50'))  setTimeout(() => { addXP(75); addToast('⚡ Productivity Machine! +75 XP') }, 700)
      if (highDone  === 5  && tryUnlock('high_five')) setTimeout(() => { addXP(30); addToast('🎯 High Priorities! +30 XP') }, 700)
      if (todayDone === 5  && tryUnlock('speed_run')) setTimeout(() => { addXP(40); addToast('🚀 Speed Run! +40 XP') }, 700)
    } else {
      addToast('Task reopened')
    }
  }, [tasks, toggleTask, addXP, addToast, tryUnlock])

  const handleToggleHabit = useCallback((id) => {
    const todayStr = toLocalDateStr(new Date())
    const habit    = habits.find(h => h.id === id)
    const wasDone  = !!habit?.history?.[todayStr]
    toggleToday(id)
    if (!wasDone && habit) {
      const streak  = getHabitStreak({ ...habit.history, [todayStr]: true })
      const xp      = 5 + (streak >= 30 ? 10 : streak >= 7 ? 5 : 0)
      addXP(xp)
      addToast(`💪 ${habit.name} +${xp} XP`)
      if (tryUnlock('first_habit'))                      setTimeout(() => { addXP(10);  addToast('💪 Creature of Habit! +10 XP')  }, 700)
      if (streak >= 7  && tryUnlock('streak_7'))         setTimeout(() => { addXP(35);  addToast('🔥 Week Warrior! +35 XP')       }, 700)
      if (streak >= 30 && tryUnlock('streak_30'))        setTimeout(() => { addXP(100); addToast('🏆 Unstoppable! +100 XP')       }, 700)
      const allDone = habits.every(h => h.id === id ? true : !!h.history?.[todayStr])
      if (allDone && habits.length > 1 && tryUnlock('all_habits')) setTimeout(() => { addXP(25); addToast('💯 Perfect Day! +25 XP') }, 700)
    }
  }, [habits, toggleToday, addXP, addToast, tryUnlock])

  const handleAddGoal = useCallback((data) => {
    addGoal(data)
    if (goals.length === 0 && tryUnlock('first_goal')) setTimeout(() => { addXP(10); addToast('🌟 Dream Big! +10 XP') }, 700)
  }, [goals, addGoal, addXP, addToast, tryUnlock])

  const handleUpdateGoal = useCallback((id, upd) => {
    updateGoal(id, upd)
    if (upd.progress === 100) {
      addXP(20)
      addToast('🎯 Goal at 100%! +20 XP')
      if (tryUnlock('goal_done')) setTimeout(() => { addXP(75); addToast('🎖️ Goal Crusher! +75 XP') }, 700)
    }
  }, [updateGoal, addXP, addToast, tryUnlock])

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

  const sharedProps = { onToggle: handleToggle, onDelete: handleDelete, onUpdate: updateTask, onToggleSubtask: toggleSubtask, apiKey, addToast }
  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div className="min-h-screen min-h-[100dvh] text-white">
      <div className="max-w-2xl mx-auto px-4 pb-32"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))' }}>

        {/* Header */}
        <header className="text-center mb-6 relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            LifeOps
          </h1>
          <p className="text-slate-500 text-sm mt-1">Your personal command center</p>
          <div className="absolute right-0 top-0 flex items-center gap-1">
            {supabase && (
              <button onClick={() => setShowSettings(s => !s)} title={session ? `Synced as ${session.user.email}` : 'Sign in for cloud sync'}
                className="p-2 rounded-xl transition-all duration-200 text-slate-500 hover:text-white hover:bg-white/5">
                {session ? <Cloud size={16} className="text-green-400" /> : <CloudOff size={16} />}
              </button>
            )}
            <button
              onClick={() => setShowSettings(s => !s)}
              className={`p-2 rounded-xl transition-all duration-200
                ${showSettings ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              title="AI Settings">
              {apiKey ? <Sparkles size={18} className="text-purple-400" /> : <Settings size={18} />}
            </button>
          </div>
        </header>

        {showSettings && (
          <SettingsPanel apiKey={apiKey} onSave={saveApiKey} onClose={() => setShowSettings(false)}
            session={session} onSignIn={signIn} onSignOut={signOut}
            onSyncNow={handleSyncNow} onUploadLocal={handleUploadLocal} />
        )}

        {/* Tasks tab */}
        {activeTab === 'tasks' && (
          <>
            <QuickCapture onAdd={handleAddTaskWithScheduling} addToast={addToast} apiKey={apiKey} />
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

        {/* Home tab */}
        {activeTab === 'home' && (
          <HomeTab
            tasks={tasks} habits={habits} goals={goals} finance={finance}
            toggleToday={handleToggleHabit} addHabit={addHabit} removeHabit={removeHabit}
            addGoal={handleAddGoal} updateGoal={handleUpdateGoal} removeGoal={removeGoal}
            apiKey={apiKey} totalXP={totalXP}
            calendarEvents={calendarEvents} calLoading={calLoading} calError={calError}
            hasToken={!!session?.provider_token}
            onCalReconnect={signIn} onCalRefresh={refetchToday}
          />
        )}

        {/* AI Assistant tab */}
        {activeTab === 'ai' && <AssistantTab tasks={tasks} habits={habits} goals={goals} apiKey={apiKey} calendarEvents={calendarEvents} />}

        {/* Insights tab */}
        {activeTab === 'insights' && <InsightsDashboard tasks={tasks} habits={habits} goals={goals} unlocked={unlocked} />}

        {/* Finance tab */}
        {activeTab === 'finance' && (
          <FinanceTab
            finance={finance}
            updateSalary={updateSalary}
            addSubscription={addSubscription}
            removeSubscription={removeSubscription}
            addExpense={addExpense}
            removeExpense={removeExpense}
            importData={importData}
            apiKey={apiKey}
            addToast={addToast}
          />
        )}
      </div>

      {levelUpTarget && <LevelUpModal levelInfo={levelUpTarget} onClose={() => setLevelUpTarget(null)} />}
      <FloatingCapture onAdd={handleAddTaskWithScheduling} addToast={addToast} apiKey={apiKey} />
      <Toast toasts={toasts} dismiss={dismiss} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} activeTasks={tasks.filter(t => !t.completed).length} />
    </div>
  )
}
