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

  const systemPrompt = `You are a precise financial data extractor for French documents (bulletins de paie, relevés bancaires).

Return a JSON object with these fields (omit fields not present):
{
  "salary": { "net": <number EUR/month>, "brut": <number EUR/month> },
  "subscriptions": [{ "name": <string>, "amount": <number>, "period": <"monthly"|"yearly"|"quarterly"|"weekly">, "category": <"Streaming"|"Software"|"Fitness"|"Music"|"News"|"Gaming"|"Utilities"|"Other"> }],
  "expenses": [{ "name": <string>, "amount": <number EUR/month>, "category": <"Housing"|"Food"|"Transport"|"Health"|"Education"|"Clothing"|"Leisure"|"Other"> }]
}

═══ BULLETIN DE PAIE ═══
- salary.net = "Net à payer" or "Salaire net"
- salary.brut = "Salaire brut" or "Rémunération brute"
- If annual, divide by 12

═══ RELEVÉ BANCAIRE — STRICT RULES ═══
INCLUDE only lines starting with:
• "PRLV SEPA" — direct debit, always a real recurring charge (subscriptions, utilities, insurance)
• "VIR PERM" or "VIR PERMANENT" — standing order, always recurring (rent, savings)
• Salary credit lines ("VIR SEPA <employer name>") for salary.net only

NEVER INCLUDE:
• Lines starting with "CB" — card payments, almost always one-off purchases
• PayPal — amounts vary, not a subscription unless EXACT same amount every month
• Amazon — usually one-off unless clearly "Amazon Prime" with fixed amount
• Supermarkets (Carrefour, Leclerc, Monoprix, Auchan, Lidl, etc.)
• Restaurants, bars, fuel stations
• ATM withdrawals (DAB, RETRAIT)
• Variable-amount transfers

RECURRING CONFIDENCE RULES:
• PRLV SEPA → 95% confidence → always include
• VIR PERM → 95% confidence → always include as expense (Housing if "LOYER", else Other)
• Same merchant + same amount appearing 2+ times → include
• Same merchant + DIFFERENT amounts → one-off, exclude
• When in doubt → exclude, better to miss one than to add a wrong one

KNOWN FRENCH SUBSCRIPTIONS (PRLV SEPA):
Streaming: Netflix, Canal+, Disney+, OCS, Salto, Paramount+, Apple TV
Music: Spotify, Deezer, Apple Music, YouTube Premium
Telecom: Free, SFR, Bouygues, Orange, Iliad, NRJ Mobile
Utilities: EDF, Engie, Total Energies, Veolia, GRDF
Insurance: AXA, MAAF, MACIF, GMF, Allianz, MMA, Covéa, AG2R, April
Software: Adobe, Microsoft 365, iCloud, Google One, Dropbox, Figma
Sport: Decathlon+, Basic Fit, Keep Cool, Neoness, Gymlib
Other: Amazon Prime, Fnac+, FNAC Darty, BlaBlaCar Daily

Return ONLY valid JSON. No explanation. No markdown.`

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
        { role: 'user', content: finalText.slice(0, 14000) },
      ]
    }

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: isImage ? 'gpt-4o' : 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0,  // deterministic — same doc always gives same result
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
