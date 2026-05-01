export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const allowed = ['https://lifeops-dashboard-pearl.vercel.app', 'http://localhost:5173', 'http://localhost:4173']
  if (!allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, tasks, habits = [], goals = [], calendarEvents = [], todayStr, dayName, apiKey, timezone = 'UTC', systemSuffix = '' } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey
  if (!key) return res.status(400).json({ error: 'No API key.' })

  const active    = tasks.filter(t => !t.completed)
  const done      = tasks.filter(t => t.completed)
  const overdue   = active.filter(t => { if (!t.dueDate) return false; return new Date(t.dueDate + 'T00:00:00') < new Date(todayStr + 'T00:00:00') })
  const today     = active.filter(t => t.dueDate === todayStr)
  const high      = active.filter(t => t.priority === 'high')

  const taskList = active.map(t => {
    const parts = [`[${t.priority.toUpperCase()}] ${t.title}`, t.category, t.type]
    if (t.dueDate) parts.push(`due ${t.dueDate}`)
    if (t.duration) parts.push(t.duration)
    if (t.notes) parts.push(`"${t.notes}"`)
    return parts.join(' | ')
  }).join('\n')

  const completedRecent = done.slice(0, 10).map(t => `✓ ${t.title}`).join('\n')

  // Habits summary
  const habitLines = habits.map(h => {
    const streak = (() => {
      const hist = h.history || {}
      const d = new Date(todayStr + 'T00:00:00')
      if (!hist[todayStr]) d.setDate(d.getDate() - 1)
      let s = 0
      for (let i = 0; i < 400; i++) {
        const key = d.toISOString().slice(0, 10)
        if (hist[key]) { s++; d.setDate(d.getDate() - 1) } else break
      }
      return s
    })()
    const doneToday = !!h.history?.[todayStr]
    return `${h.emoji} ${h.name} — streak: ${streak} day${streak !== 1 ? 's' : ''}, today: ${doneToday ? 'done' : 'not done'}`
  }).join('\n')

  // Goals summary
  const goalLines = goals.map(g => {
    return `${g.emoji} ${g.title} (${g.timeframe}) — ${g.progress || 0}% complete`
  }).join('\n')

  // Calendar summary
  const calLines = calendarEvents.map(ev => {
    if (!ev.start?.dateTime) return `• ${ev.summary || 'Untitled'} (all day)`
    const fmt = { hour: 'numeric', minute: '2-digit', timeZone: timezone }
    const start = new Date(ev.start.dateTime).toLocaleTimeString('en-US', fmt)
    const end   = new Date(ev.end.dateTime).toLocaleTimeString('en-US', fmt)
    return `• ${start}–${end}: ${ev.summary || 'Untitled'}${ev.location ? ` @ ${ev.location}` : ''}`
  }).join('\n')

  const system = `You are a smart personal productivity assistant inside LifeOps, a life task manager.
Today is ${todayStr} (${dayName}).

USER'S TASKS OVERVIEW:
- ${active.length} active tasks, ${done.length} completed total
- ${overdue.length} overdue, ${today.length} due today, ${high.length} high priority

ACTIVE TASKS:
${taskList || '(none)'}

RECENTLY COMPLETED:
${completedRecent || '(none)'}

HABITS (${habits.length} total):
${habitLines || '(none set)'}

GOALS (${goals.length} total):
${goalLines || '(none set)'}

TODAY'S CALENDAR (${calendarEvents.length} events):
${calLines || '(no events today)'}

You have full context of the user's life including their calendar. Be their smart, direct, friendly productivity and life coach.

BEHAVIOR:
- Be concise and actionable — no fluff
- Use bullet points for lists (start with "• ")
- Use **bold** for emphasis on key items
- Address the user as "you" not "the user"
- When suggesting priorities, be specific and explain briefly why
- For weekly reviews: structure as Wins → Needs attention → This week's focus
- For "what to focus on today": pick 3 max with reasoning, factor in their calendar
- For morning briefs: mention key meetings, free blocks, habit streaks, and top 2-3 tasks
- If they have back-to-back meetings, suggest what to do in free gaps
- Keep responses under 200 words unless a detailed review is requested${systemSuffix}`

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          { role: 'system', content: system },
          ...messages,
        ],
      }),
    })
    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 200)}` })
    }
    const data = await upstream.json()
    return res.status(200).json({ response: data.choices[0].message.content.trim() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
