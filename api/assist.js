export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, tasks, todayStr, dayName, apiKey } = req.body
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

  const system = `You are a smart personal productivity assistant inside LifeOps, a life task manager.
Today is ${todayStr} (${dayName}).

USER'S TASKS OVERVIEW:
- ${active.length} active tasks, ${done.length} completed total
- ${overdue.length} overdue, ${today.length} due today, ${high.length} high priority

ACTIVE TASKS:
${taskList || '(none)'}

RECENTLY COMPLETED:
${completedRecent || '(none)'}

You have full context of the user's life tasks. Be their smart, direct, friendly productivity coach.

BEHAVIOR:
- Be concise and actionable — no fluff
- Use bullet points for lists (start with "• ")
- Use **bold** for emphasis on key items
- Address the user as "you" not "the user"
- When suggesting priorities, be specific and explain briefly why
- For weekly reviews: structure as Wins → Needs attention → This week's focus
- For "what to focus on today": pick 3 max with reasoning
- Keep responses under 200 words unless a detailed review is requested`

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
