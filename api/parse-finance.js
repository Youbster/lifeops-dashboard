import { extractText } from 'unpdf'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const allowed = ['https://lifeops-dashboard-pearl.vercel.app', 'http://localhost:5173', 'http://localhost:4173']
  if (!allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, imageBase64, pdfBase64, mimeType, apiKey } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey
  if (!key) return res.status(400).json({ error: 'No API key.' })
  if (!text && !imageBase64 && !pdfBase64) return res.status(400).json({ error: 'No content provided.' })

  const systemPrompt = `You are a financial data extractor specialized in French documents (bulletins de paie, relevés bancaires).

Extract all financial data and return a JSON object (omit fields not found):
{
  "salary": {
    "net": <number, net monthly salary EUR — look for "Net à payer", "Salaire net">,
    "brut": <number, gross monthly salary EUR — look for "Salaire brut", "Rémunération brute">
  },
  "subscriptions": [
    { "name": <string>, "amount": <number EUR>, "period": <"monthly"|"yearly"|"weekly"|"quarterly">, "category": <"Streaming"|"Software"|"Fitness"|"Music"|"News"|"Gaming"|"Utilities"|"Other"> }
  ],
  "expenses": [
    { "name": <string>, "amount": <number EUR/month>, "category": <"Housing"|"Food"|"Transport"|"Health"|"Education"|"Clothing"|"Leisure"|"Other"> }
  ]
}

Rules:
- Amounts must be positive numbers in EUR
- If salary appears per year, divide by 12
- For bank statements: only include recurring charges, not one-off purchases
- Common French subscriptions: Netflix, Spotify, Canal+, Amazon Prime, Free, SFR, Bouygues, Orange, EDF, Darty, etc.
- Only include items you are confident about
- Return ONLY valid JSON, no explanation`

  let finalText = text || ''
  const isImage = !!imageBase64

  // ── PDF: extract text with unpdf (ESM-native, serverless-safe) ──
  if (pdfBase64) {
    try {
      const buffer = Buffer.from(pdfBase64, 'base64')
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
      finalText = text || ''

      if (!finalText.trim()) {
        return res.status(422).json({
          error: 'This PDF has no selectable text (likely a scanned image). Please take a screenshot and upload as JPG/PNG instead.',
        })
      }
    } catch (pdfErr) {
      console.error('[parse-finance] unpdf error:', pdfErr.message)
      return res.status(500).json({ error: 'Could not read PDF: ' + pdfErr.message })
    }
  }

  try {
    let messages
    if (isImage) {
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`, detail: 'high' } },
            { type: 'text', text: 'Extract all financial data from this document.' },
          ],
        },
      ]
    } else {
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalText.slice(0, 8000) },
      ]
    }

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: isImage ? 'gpt-4o' : 'gpt-4o-mini',
        max_tokens: 1000,
        ...(isImage ? {} : { response_format: { type: 'json_object' } }),
        messages,
      }),
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 300)}` })
    }

    const data = await upstream.json()
    const raw = data.choices[0].message.content.trim()

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
      if (match) {
        parsed = JSON.parse(match[1].trim())
      } else {
        throw new Error('Model did not return valid JSON')
      }
    }

    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
