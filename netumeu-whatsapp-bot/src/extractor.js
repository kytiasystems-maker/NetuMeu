// ═══════════════════════════════════════════════
// Extractor de date contabile din text românesc
// Funcționează fără AI extern — regex + keyword matching
// Upgrade path: Claude API pentru extracție inteligentă
// ═══════════════════════════════════════════════

export function extractData(text) {
  const t = text.toLowerCase().trim()

  // ─── Detectare tip operațiune (ordinea contează!) ───
  if (isInvoice(t)) return extractInvoice(t, text)
  if (isQuestion(t)) return extractQuestion(t, text)
  if (isExpense(t)) return extractExpense(t, text)
  return extractGeneric(text)
}

// ─── Detectoare de tip ───
function isInvoice(t) {
  return /factur|emite|trimite\s+factur|facturez|facturează/i.test(t)
}

function isExpense(t) {
  return /plat|plătit|am\s+dat|cheltui|alimentat|cumpăr|bon\s|chitanț|cost|comand/i.test(t)
}

function isQuestion(t) {
  return /cât|când|când|ce\s+trebuie|am\s+de\s+plat|termen|obligat|declar|statu|situaț/i.test(t)
}

// ─── Extragere sumă ───
function extractAmount(t) {
  // Patternuri: "5000 euro", "387,50 lei", "2.000 ron", "300 de lei"
  const patterns = [
    /(\d[\d.,]*)\s*(?:de\s+)?(euro|eur|€)/i,
    /(\d[\d.,]*)\s*(?:de\s+)?(lei|ron)/i,
    /(\d[\d.,]*)\s*(?:de\s+)?(lei|ron|euro|eur|€)/i,
    /(\d[\d.,]*)/  // fallback — doar număr
  ]

  for (const p of patterns) {
    const m = t.match(p)
    if (m) {
      let val = m[1].replace(/\./g, '').replace(',', '.')
      const num = parseFloat(val)
      if (isNaN(num) || num <= 0) continue
      const curr = m[2]?.match(/euro|eur|€/i) ? 'EUR' : 'RON'
      return { amount: num, currency: curr }
    }
  }
  return null
}

// ─── Extragere nume entitate (client/furnizor) ───
function extractEntityName(t) {
  const patterns = [
    /(?:lui|la|pentru|către|catre)\s+([A-ZȘȚĂÎÂa-zșțăîâ][\wăîâșțĂÎÂȘȚ\s.-]{2,35}?)(?:\s+\d|\s*,|\s+pe\s|\s+servic|\s+luna|$)/i,
    /(?:de la|dela)\s+([A-ZȘȚĂÎÂa-zșțăîâ][\wăîâșțĂÎÂȘȚ\s.-]{2,35}?)(?:\s+\d|\s*,|\s+cu|$)/i,
    /(?:firma|compania|srl|sa)\s+([A-ZȘȚĂÎÂa-zșțăîâ][\wăîâșțĂÎÂȘȚ\s.-]{2,35}?)(?:\s+\d|\s*,|$)/i,
  ]

  for (const p of patterns) {
    const m = t.match(p)
    if (m) {
      let name = m[1].trim()
      // Curăță cuvinte irelevante de la final
      name = name.replace(/\s+(pe|cu|din|pentru|servicii|luna|lei|euro|ron)$/i, '').trim()
      if (name.length >= 3) return capitalizeWords(name)
    }
  }
  return null
}

// ─── Detectare categorie contabilă ───
function detectCategory(t) {
  const categories = [
    { pattern: /benzin|motorin|carburant|alimentat|omv|petrom|mol|lukoil|rompetrol/i, code: '6022', name: 'Combustibil' },
    { pattern: /chiri|rent|închiri/i, code: '612', name: 'Chirii' },
    { pattern: /telefon|mobil|orange|vodafone|digi|internet/i, code: '626', name: 'Poștă și telecomunicații' },
    { pattern: /curent|enel|energie|electric|gaz|apa|apă/i, code: '605', name: 'Energie și apă' },
    { pattern: /birou|papetărie|toner|hârtie|cartuș|pixuri/i, code: '6021', name: 'Materiale consumabile' },
    { pattern: /masă|restaurant|mâncare|prânz|cafea|protocol/i, code: '625', name: 'Protocol și deplasări' },
    { pattern: /parcare|parking/i, code: '628', name: 'Alte cheltuieli (parcare)' },
    { pattern: /transport|taxi|uber|bolt|tren|avion|bilet/i, code: '624', name: 'Transport' },
    { pattern: /asigur/i, code: '613', name: 'Asigurări' },
    { pattern: /repar|service|mentenanț|întreținere/i, code: '611', name: 'Întreținere și reparații' },
    { pattern: /consultanț|avocat|notar|contabil/i, code: '622', name: 'Servicii profesionale' },
    { pattern: /reclam|market|publicitat|facebook|google ads/i, code: '623', name: 'Publicitate și reclamă' },
    { pattern: /salar|leafa|plată\s+angaj/i, code: '641', name: 'Salarii' },
  ]

  for (const cat of categories) {
    if (cat.pattern.test(t)) return `${cat.code} — ${cat.name}`
  }
  return '628 — Alte cheltuieli'
}

// ─── Detectare lună ───
function detectMonth(t) {
  const months = {
    ianuarie: 'Ianuarie', februarie: 'Februarie', martie: 'Martie', aprilie: 'Aprilie',
    mai: 'Mai', iunie: 'Iunie', iulie: 'Iulie', august: 'August',
    septembrie: 'Septembrie', octombrie: 'Octombrie', noiembrie: 'Noiembrie', decembrie: 'Decembrie'
  }
  for (const [key, val] of Object.entries(months)) {
    if (t.includes(key)) return val
  }
  return null
}

// ─── Extragere factură ───
function extractInvoice(t, original) {
  const amountInfo = extractAmount(t)
  const entityName = extractEntityName(t)
  const month = detectMonth(t)

  const amount = amountInfo?.amount || 0
  const currency = amountInfo?.currency || 'RON'
  const vat = (amount * 0.19).toFixed(2)
  const total = (amount * 1.19).toFixed(2)

  // Detectare descriere
  let description = 'Servicii profesionale'
  const descMatch = t.match(/servicii\s+([\wăîâșțĂÎÂȘȚ\s]+?)(?:\s+pe|\s+luna|\s*,|\s+termen|$)/i)
  if (descMatch) description = capitalizeWords(descMatch[1].trim())
  if (month) description += ` — ${month} 2026`

  // Termen plată
  const termMatch = t.match(/termen\s*(?:de\s*)?(?:plată?)?\s*(\d+)\s*zile/i)
  const term = termMatch ? `${termMatch[1]} zile` : '15 zile'

  return {
    type: 'invoice',
    confidence: calculateConfidence(amountInfo, entityName),
    savings: 420 + Math.floor(Math.random() * 60),
    data: {
      client: entityName || 'Client nespecificat',
      amount: `${amount.toLocaleString('ro-RO')} ${currency}`,
      vat: `${parseFloat(vat).toLocaleString('ro-RO')} ${currency} (19%)`,
      total: `${parseFloat(total).toLocaleString('ro-RO')} ${currency}`,
      description,
      paymentTerm: term,
    }
  }
}

// ─── Extragere cheltuială ───
function extractExpense(t, original) {
  const amountInfo = extractAmount(t)
  const entityName = extractEntityName(t)
  const category = detectCategory(t)

  const amount = amountInfo?.amount || 0
  const currency = amountInfo?.currency || 'RON'
  const vatAmount = (amount - amount / 1.19).toFixed(2)
  const netAmount = (amount / 1.19).toFixed(2)

  return {
    type: 'expense',
    confidence: calculateConfidence(amountInfo, entityName, true),
    savings: 240 + Math.floor(Math.random() * 60),
    data: {
      supplier: entityName || 'Furnizor nespecificat',
      amount: `${amount.toLocaleString('ro-RO')} ${currency}`,
      vat: `${parseFloat(vatAmount).toLocaleString('ro-RO')} ${currency} (19%)`,
      net: `${parseFloat(netAmount).toLocaleString('ro-RO')} ${currency}`,
      category,
      account: '401 — Furnizori',
    }
  }
}

// ─── Extragere întrebare ───
function extractQuestion(t, original) {
  return {
    type: 'question',
    confidence: 90,
    savings: 300,
    data: {
      topic: 'Întrebare fiscală / contabilă',
      content: original.slice(0, 200),
    }
  }
}

// ─── Extragere generică (fallback) ───
function extractGeneric(original) {
  return {
    type: 'other',
    confidence: 60,
    savings: 120,
    data: {
      content: original.slice(0, 200),
      note: 'Nu s-a putut clasifica automat — trimis pentru verificare manuală',
    }
  }
}

// ─── Calcul confidence ───
function calculateConfidence(amountInfo, entityName, isExpense = false) {
  let conf = 70
  if (amountInfo) conf += 15  // Am detectat o sumă
  if (entityName) conf += 10  // Am detectat un nume
  if (amountInfo?.currency) conf += 5  // Am detectat moneda
  return Math.min(conf, 98)
}

// ─── Helper ───
function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}
