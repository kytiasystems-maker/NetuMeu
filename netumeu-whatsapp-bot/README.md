# NetuMeu WhatsApp Bot — Ghid complet de setup

Acest ghid te duce de la zero la un bot WhatsApp funcțional care primește mesaje vocale de la clienți și trimite email structurat la contabil.

**Timp estimat: 30-45 minute.**
**Cost lunar: 0 lei** (free tier Meta + Gmail + Railway/Render).

---

## Cuprins
1. Cont Meta for Developers
2. Creare app WhatsApp Business
3. Deploy server (Railway — gratuit)
4. Configurare Webhook
5. Email Setup (Gmail)
6. Testare
7. Trecere în producție

---

## 1. Cont Meta for Developers (5 min)

1. Mergi pe **https://developers.facebook.com**
2. Click "Get Started" / "Începe"
3. Loghează-te cu contul tău Facebook (sau creează unul)
4. Acceptă termenii Meta for Developers
5. Verifică-ți contul (email + telefon)

Acum ai acces la dashboard-ul developer.

---

## 2. Creare app WhatsApp Business (10 min)

### 2a. Creează aplicația
1. În dashboard: **My Apps → Create App**
2. Alege tipul: **Business**
3. Nume aplicație: `NetuMeu Bot`
4. Email contact: emailul tău
5. Click "Create App"

### 2b. Adaugă WhatsApp
1. În pagina aplicației, scrollează la **Add Products**
2. Găsește **WhatsApp** → click **Set Up**
3. Creează un **Meta Business Account** (sau selectează unul existent)
4. Meta îți oferă automat:
   - Un **număr de test** WhatsApp (îl poți folosi gratuit)
   - Un **temporary access token** (valabil 24h)

### 2c. Notează aceste valori
Din pagina **WhatsApp → API Setup**:
- **Phone Number ID**: un număr lung (ex: `123456789012345`)
- **WhatsApp Business Account ID**: alt număr lung
- **Temporary Access Token**: un string lung care începe cu `EAA...`

> ⚠️ Token-ul temporar expiră în 24h. Pentru producție, faci un permanent token (pas 7).

### 2d. Adaugă numere de test
1. În secțiunea **To**, click **Manage phone number list**
2. Adaugă numerele tale de telefon (ale tale + ale testatorilor)
3. Primești un cod de verificare pe WhatsApp — introdu-l

---

## 3. Deploy server pe Railway (10 min)

Railway oferă hosting gratuit (500 ore/lună, suficient pentru un bot).

### 3a. Pregătirea codului
1. Creează un repo nou pe GitHub
2. Push codul NetuMeu:
```bash
cd netumeu-whatsapp
git init
git add .
git commit -m "NetuMeu WhatsApp Bot v1.0"
git branch -M main
git remote add origin https://github.com/CONTUL_TAU/netumeu-whatsapp.git
git push -u origin main
```

### 3b. Deploy pe Railway
1. Mergi pe **https://railway.app** → Sign up cu GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Selectează repo-ul `netumeu-whatsapp`
4. Railway detectează automat Node.js și face deploy

### 3c. Setează variabilele de mediu
1. În Railway, mergi pe **Settings → Variables**
2. Adaugă fiecare variabilă din `.env.example`:

```
WA_PHONE_NUMBER_ID = (din pasul 2c)
WA_ACCESS_TOKEN = (din pasul 2c)
WA_VERIFY_TOKEN = netumeu_webhook_secret_2026
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = emailul_tau@gmail.com
SMTP_PASS = (app password Gmail — vezi pasul 5)
ACCOUNTANT_EMAIL = contabil@example.com
PORT = 3000
```

3. Railway face auto-redeploy când salvezi variabilele

### 3d. Obține URL-ul public
1. În Railway: **Settings → Networking → Generate Domain**
2. Vei primi un URL de tipul: `https://netumeu-whatsapp-production.up.railway.app`
3. Testează: deschide `https://URL_TAU/` în browser — trebuie să vezi mesajul JSON de status

**Alternativă la Railway**: Render.com (gratuit), Fly.io, sau orice VPS cu Node.js.

---

## 4. Configurare Webhook în Meta (5 min)

1. Mergi în **Meta for Developers → App → WhatsApp → Configuration**
2. La secțiunea **Webhook**:
   - **Callback URL**: `https://URL_TAU_RAILWAY/webhook`
   - **Verify Token**: `netumeu_webhook_secret_2026` (exact ce ai pus în env)
3. Click **Verify and Save**
   - Meta trimite un GET request la URL-ul tău
   - Serverul răspunde cu challenge-ul
   - Dacă totul e ok, vezi ✅ "Verified"
4. La **Webhook Fields**, bifează:
   - ✅ `messages` (obligatoriu — primim mesajele)

---

## 5. Email Setup — Gmail App Password (5 min)

Gmail blochează login-ul cu parola normală din aplicații externe.
Trebuie un "App Password":

1. Mergi pe **https://myaccount.google.com/security**
2. Asigură-te că ai **2-Factor Authentication** activat
3. Mergi la **Security → 2-Step Verification → App Passwords**
   (sau caută "App Passwords" în setări)
4. Generează un App Password:
   - App: `Mail`
   - Device: `Other` → scrie `NetuMeu Bot`
5. Copiază parola de 16 caractere (ex: `abcd efgh ijkl mnop`)
6. Folosește-o ca `SMTP_PASS` în Railway (fără spații)

---

## 6. Testare (5 min)

### Test 1: Mesaj text
1. Deschide WhatsApp pe telefon
2. Trimite un mesaj la **numărul de test Meta** (din pasul 2)
3. Scrie: `Facturează-i lui Popescu 3000 lei servicii IT pe martie`
4. Ar trebui să primești:
   - Reacție ⏳ pe mesaj (procesare)
   - Reacție ✅ (gata)
   - Mesaj confirmare cu datele extrase
5. Verifică email-ul contabilului — ar trebui să aibă emailul structurat

### Test 2: Mesaj vocal
1. Trimite un mesaj vocal pe WhatsApp: "Am plătit chiria pe birou, două mii de lei, la Gheorghe Marin"
2. Procesare va dura 3-5 secunde (download audio + transcriere + extracție)
3. Primești confirmarea pe WhatsApp + contabilul primește email

### Dacă nu merge:
- Verifică logs în Railway: **Deployments → View Logs**
- Asigură-te că webhook-ul e verified (pasul 4)
- Asigură-te că numerele de test sunt adăugate (pasul 2d)
- Verifică că variabilele de mediu sunt corecte

---

## 7. Trecere în producție

### 7a. Token permanent (obligatoriu)
Token-ul temporar expiră în 24h. Pentru producție:

1. În Meta Business Suite, mergi la **Business Settings → System Users**
2. Creează un System User (tip: Admin)
3. Generează un token cu permisiunile:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. Copiază token-ul permanent → actualizează `WA_ACCESS_TOKEN` în Railway

### 7b. Număr de telefon real
1. În Meta for Developers → WhatsApp → **Phone Numbers**
2. Click **Add Phone Number**
3. Adaugă un număr de telefon real (poate fi și un număr nou pe SIM prepaid)
4. Verifică-l cu codul primit pe WhatsApp
5. Actualizează `WA_PHONE_NUMBER_ID` în Railway

### 7c. Verificare Business
1. Meta cere verificare business pentru trafic mare
2. Upload: CUI firmă, document oficial
3. Durează 2-7 zile

### 7d. ffmpeg (pentru mesaje vocale)
Serverul folosește `ffmpeg` pentru conversie audio. 
- **Railway**: ffmpeg vine pre-instalat
- **Render**: adaugă `ffmpeg` în build command: `apt-get install -y ffmpeg && npm install`
- **VPS**: `sudo apt install ffmpeg`

---

## Structura proiectului

```
netumeu-whatsapp/
├── src/
│   ├── server.js         # Express server + routes
│   ├── webhook.js        # Handler mesaje WhatsApp
│   ├── whatsapp-api.js   # Trimite mesaje + descarcă media
│   ├── transcriber.js    # Audio → text (Google STT / Whisper)
│   ├── extractor.js      # Text → date contabile structurate
│   └── mailer.js         # Formatare + trimitere email HTML
├── .env.example          # Template variabile de mediu
├── package.json
└── README.md             # Acest fișier
```

---

## Upgrade Path

| Ce vrei | Cum faci | Cost |
|---------|----------|------|
| Transcriere mai bună | Decomentează Whisper în `transcriber.js`, setează `OPENAI_API_KEY` | ~$0.006/min |
| Extracție AI reală | Înlocuiește regex din `extractor.js` cu Claude API | ~$0.01/request |
| OCR pe poze bonuri | Adaugă Claude Vision în webhook.js pentru `image` type | ~$0.01/imagine |
| Dashboard contabil | Adaugă frontend Next.js + database | ~2 săptămâni dev |
| Mai mulți contabili | Adaugă routing pe nr. telefon + tabel asociere | ~1 săptămână dev |

---

## Suport

Probleme? Deschide un issue pe GitHub sau contactează-ne.
