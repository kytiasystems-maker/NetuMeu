import nodemailer from 'nodemailer'

// ─── Configurare transport SMTP ───
let transporter = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

// ─── Trimite email structurat la contabil ───
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

  // ─── Construim HTML email ───
  const dataRows = Object.entries(extracted.data)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;width:40%">${capitalizeKey(key)}</td>
        <td style="padding:8px 12px;font-weight:600;font-size:13px;border-bottom:1px solid #f3f4f6">${val}</td>
      </tr>
    `).join('')

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb">
    <div style="max-width:560px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      
      <!-- Header -->
      <div style="background:${color};padding:16px 20px;color:#fff">
        <div style="font-size:18px;font-weight:700">${typeLabels[extracted.type] || 'Mesaj nou'}</div>
        <div style="font-size:13px;opacity:0.85;margin-top:4px">de la ${clientName} · ${formatPhone(clientPhone)}</div>
      </div>

      <!-- Confidence -->
      <div style="padding:12px 20px;background:#f0fdf4;border-bottom:1px solid #e5e7eb;display:flex;align-items:center">
        <span style="font-size:12px;color:#16a34a;font-weight:600">Confidence AI: ${extracted.confidence}%</span>
        <span style="font-size:12px;color:#6b7280;margin-left:auto">${timestamp.toLocaleString('ro-RO')}</span>
      </div>

      <!-- Date extrase -->
      <div style="padding:16px 20px">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Date extrase automat</div>
        <table style="width:100%;border-collapse:collapse">
          ${dataRows}
        </table>
      </div>

      <!-- Mesaj original -->
      <div style="padding:16px 20px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">
          Mesaj original (${messageType === 'audio' ? 'transcris din voce' : 'text'})
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.6;font-style:italic;background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb">
          „${originalText}"
        </div>
      </div>

      <!-- Estimare economie -->
      <div style="padding:12px 20px;background:#fefce8;border-top:1px solid #fef08a;text-align:center">
        <span style="font-size:12px;color:#854d0e">Timp economisit pe această operațiune: </span>
        <span style="font-size:14px;font-weight:700;color:#a16207">${formatTime(extracted.savings)}</span>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb">
        Trimis automat de NetuMeu · <a href="https://netumeu.ro" style="color:${color}">netumeu.ro</a>
      </div>
    </div>
  </body>
  </html>`

  // Varianta text plain (fallback)
  const textContent = `
${typeLabels[extracted.type] || 'Mesaj'} de la ${clientName} (${formatPhone(clientPhone)})
${'-'.repeat(50)}
${Object.entries(extracted.data).map(([k, v]) => `${capitalizeKey(k)}: ${v}`).join('\n')}
${'-'.repeat(50)}
Mesaj original: "${originalText}"
Confidence AI: ${extracted.confidence}%
Timp economisit: ${formatTime(extracted.savings)}
${'-'.repeat(50)}
Trimis automat de NetuMeu
  `.trim()

  // ─── Trimitere ───
  try {
    await getTransporter().sendMail({
      from: `"NetuMeu Bot" <${process.env.SMTP_USER}>`,
      to: process.env.ACCOUNTANT_EMAIL,
      subject,
      text: textContent,
      html,
    })
  } catch (err) {
    console.error('❌ Eroare trimitere email:', err.message)
    // Fallback: logăm datele în consolă ca să nu se piardă
    console.log('📧 EMAIL FALLBACK (nu s-a putut trimite):')
    console.log(textContent)
  }
}

// ─── Helpers ───
function formatPhone(phone) {
  // Format: 40741234567 → +40 741 234 567
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
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/_/g, ' ')
}
