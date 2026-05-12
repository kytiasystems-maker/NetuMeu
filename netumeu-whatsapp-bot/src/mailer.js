import axios from 'axios'

// ═══════════════════════════════════════════════
// Email sender via Resend API (HTTPS)
// Nu folosește SMTP — funcționează pe Railway fără probleme
// Free tier: 100 emailuri/zi, 3000/lună
// ═══════════════════════════════════════════════

export async function sendToAccountant({ clientName, clientPhone, timestamp, messageType, originalText, extracted }) {
  const typeLabels = {
    invoice: '📄 Factură nouă',
    expense: '🧾 Cheltuială',
    question: '❓ Întrebare',
    other: '📋 Mesaj nestructurat',
  }

  const typeColors = {
    invoice: '#1d4ed8',
    expense: '#ca8a04',
    question: '#7c3aed',
    other: '#6b7280',
  }

  const subject = `[NetuMeu] ${typeLabels[extracted.type] || '📋 Mesaj'} de la ${clientName}`
  const color = typeColors[extracted.type] || '#6b7280'

  const dataRows = Object.entries(extracted.data)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;width:40%">${capitalizeKey(key)}</td>
        <td style="padding:8px 12px;font-weight:600;font-size:13px;border-bottom:1px solid #f3f4f6">${val}</td>
      </tr>
    `).join('')

  const html = `
  <div style="max-width:560px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="background:${color};padding:16px 20px;color:#fff">
      <div style="font-size:18px;font-weight:700">${typeLabels[extracted.type] || 'Mesaj nou'}</div>
      <div style="font-size:13px;opacity:0.85;margin-top:4px">de la ${clientName} · ${formatPhone(clientPhone)}</div>
    </div>
    <div style="padding:12px 20px;background:#f0fdf4;border-bottom:1px solid #e5e7eb">
      <span style="font-size:12px;color:#16a34a;font-weight:600">Confidence AI: ${extracted.confidence}%</span>
      <span style="font-size:12px;color:#6b7280;float:right">${timestamp.toLocaleString('ro-RO')}</span>
    </div>
    <div style="padding:16px 20px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Date extrase automat</div>
      <table style="width:100%;border-collapse:collapse">${dataRows}</table>
    </div>
    <div style="padding:16px 20px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">
        Mesaj original (${messageType === 'audio' ? 'transcris din voce' : 'text'})
      </div>
      <div style="font-size:13px;color:#374151;line-height:1.6;font-style:italic;background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb">
        „${originalText}"
      </div>
    </div>
    <div style="padding:12px 20px;background:#fefce8;border-top:1px solid #fef08a;text-align:center">
      <span style="font-size:12px;color:#854d0e">Timp economisit: </span>
      <span style="font-size:14px;font-weight:700;color:#a16207">${formatTime(extracted.savings)}</span>
    </div>
    <div style="padding:12px 20px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb">
      Trimis automat de NetuMeu
    </div>
  </div>`

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY nu e setat!')
    logFallback(clientName, clientPhone, originalText, extracted)
    return
  }

  try {
    const res = await axios.post('https://api.resend.com/emails', {
      from: 'NetuMeu Bot <onboarding@resend.dev>',
      to: [process.env.ACCOUNTANT_EMAIL],
      subject,
      html,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    })

    console.log('✅ Email trimis cu succes via Resend! ID:', res.data.id)
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message
    console.error('❌ Eroare Resend:', errMsg)
    logFallback(clientName, clientPhone, originalText, extracted)
  }
}

function logFallback(clientName, clientPhone, originalText, extracted) {
  console.log('📧 EMAIL FALLBACK (nu s-a putut trimite):')
  console.log(`  De la: ${clientName} (${formatPhone(clientPhone)})`)
  console.log(`  Tip: ${extracted.type} | Confidence: ${extracted.confidence}%`)
  console.log(`  Text: "${originalText}"`)
  Object.entries(extracted.data).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

function formatPhone(phone) {
  if (phone.startsWith('40') && phone.length === 11) {
    return `+40 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`
  }
  return '+' + phone
}

function formatTime(seconds) {
  if (!seconds) return '~2 min'
  if (seconds < 60) return `${seconds} sec`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} min ${s} sec` : `${m} min`
}

function capitalizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ')
}
