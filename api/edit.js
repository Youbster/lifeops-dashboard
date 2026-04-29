export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instruction, task, todayStr, dayName, apiKey } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey
  if (!key) return res.status(400).json({ error: 'No API key.' })
  if (!instruction || !task) return res.status(400).json({ error: 'Missing instruction or task.' })

  const system = `You are a task editor. Apply the user's instruction to modify a task.
Today is ${todayStr} (${dayName}).

Current task:
${JSON.stringify(task, null, 2)}

Return ONLY a valid JSON object with the fields that should CHANGE. Only include changed fields — do not repeat unchanged ones.

Editable fields:
- title (string, imperative verb, max 60 chars)
- category: work | personal | money | car | house | shopping | sidehustle | people | ideas
- dueDate: YYYY-MM-DD (use today ${todayStr} as reference) or null
- priority: high | medium | low
- type: todo | idea | purchase | follow-up | project
- notes: short context string or ""
- duration: quick | 30m | 1h | 2h | half-day | null

Day reference from today ${todayStr} (${dayName}):
- "tomorrow" = next calendar day
- "this Friday/Monday/..." = the coming named weekday
- "next week" = 7 days from today
- "end of month" = last day of current month

Examples (today = Wednesday 2026-04-29):
"move to Friday" → {"dueDate":"2026-05-01"}
"make it urgent" → {"priority":"high"}
"rename to Fix kitchen sink" → {"title":"Fix kitchen sink"}
"set category to house and high priority" → {"category":"house","priority":"high"}
"due next Monday and estimate 1 hour" → {"dueDate":"2026-05-04","duration":"1h"}
"clear the due date" → {"dueDate":null}
"add a note: bring insurance card" → {"notes":"bring insurance card"}`

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: instruction },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 200)}` })
    }
    const data = await upstream.json()
    const raw = data.choices[0].message.content.trim()
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
