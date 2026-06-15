import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/FrigoTransport'
const EMAIL = 'patron@frigotransport.fr'
const PASS  = 'FrigoAdmin2024!'
const WORKER_EMAIL = `testworker${Date.now()}@test.fr`
const WORKER_PASS  = 'Worker123!'

const br = await chromium.launch({ headless: true })

async function shot(page, name) {
  await page.screenshot({ path: `/tmp/frigo-${name}.png` })
}

const log = (icon, label, detail='') => console.log(`${icon} ${label}${detail ? ' → ' + detail : ''}`)

// ═══════════════════════════════════════════════
// CONTEXTE 1 : ADMIN
// ═══════════════════════════════════════════════
const adminCtx = await br.newContext({ viewport: { width: 1280, height: 800 } })
const page = await adminCtx.newPage()

// 1. Page login
await page.goto(`${BASE}/login/`, { waitUntil: 'networkidle' })
await shot(page, '01-login')
log('✅', 'Page login', await page.locator('h2').first().textContent())

// 2. Mauvais mot de passe
await page.fill('input[type="email"]', 'faux@test.fr')
await page.fill('input[type="password"]', 'mauvais')
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
const hasError = await page.locator('text=incorrect').count() + await page.locator('text=Erreur').count()
log(hasError ? '✅' : '❌', 'Erreur mauvais mdp', hasError ? 'message visible' : 'rien')
await shot(page, '02-wrong-pass')

// 3. Connexion admin
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
await page.waitForTimeout(3500)
const urlLogin = page.url()
const loginOk = urlLogin.includes('admin') || urlLogin.includes('worker')
log(loginOk ? '✅' : '❌', 'Connexion admin', urlLogin)
await shot(page, '03-after-login')

// 4. Dashboard admin
await page.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await shot(page, '04-dashboard')
const hasTopNav   = await page.locator('text=Overview').count()
const hasCards    = await page.locator('text=Activité du jour').count()
const hasMapDiv   = await page.locator('#live-map').count()
const hasTabs     = await page.locator('text=Actifs').count()
log(hasTopNav  ? '✅':'❌', 'Top nav Transcope', hasTopNav ? 'présent' : 'absent')
log(hasCards   ? '✅':'❌', 'Cards stats', hasCards ? 'présentes' : 'absentes')
log(hasMapDiv  ? '✅':'⚠️', 'Carte Leaflet #live-map', hasMapDiv ? 'chargée' : 'absente')
log(hasTabs    ? '✅':'❌', 'Onglets Tous/Actifs/Terminés', hasTabs ? 'présents' : 'absents')

// 5. Ajouter un camion
await page.goto(`${BASE}/admin/trucks/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await shot(page, '05-trucks')
const truckFormInput = page.locator('input[placeholder*="Camion"]')
if (await truckFormInput.count()) {
  await truckFormInput.fill('Camion Test 01')
  await page.locator('input[placeholder*="matriculation"]').fill('TT-001-TT')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
  const added = await page.locator('text=Camion Test 01').count()
  log(added ? '✅':'❌', 'Ajout camion', added ? 'apparu dans la liste' : 'non visible')
  await shot(page, '06-truck-added')

  // QR code
  const qrBtn = page.locator('text=QR Code').first()
  if (await qrBtn.count()) {
    await qrBtn.click()
    await page.waitForTimeout(2500)
    const qrCanvas = await page.locator('canvas').count()
    log(qrCanvas ? '✅':'⚠️', 'Modal QR code', qrCanvas ? 'canvas généré' : 'pas de canvas')
    await shot(page, '07-qr-modal')
    await page.keyboard.press('Escape')
  }
} else {
  log('⚠️', 'Formulaire camion non trouvé', 'auth perdue?')
}

// 6. Page ouvriers
await page.goto(`${BASE}/admin/workers/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await shot(page, '08-workers')
const workersTitle = await page.locator('h1').textContent().catch(() => '')
const createBtn = await page.locator('text=Créer un compte').count()
log(workersTitle ? '✅':'⚠️', 'Page ouvriers', workersTitle)
log(createBtn ? '✅':'❌', 'Bouton Créer un compte', createBtn ? 'présent' : 'absent')

await adminCtx.close()

// ═══════════════════════════════════════════════
// CONTEXTE 2 : INSCRIPTION OUVRIER
// ═══════════════════════════════════════════════
const workerCtx = await br.newContext({ viewport: { width: 1280, height: 800 } })
const wp = await workerCtx.newPage()

await wp.goto(`${BASE}/register/`, { waitUntil: 'networkidle' })
await shot(wp, '09-register')
log('✅', 'Page register', await wp.locator('h2').textContent().catch(() => ''))

// Remplir le formulaire
const firstInput = wp.locator('input[placeholder="Prénom"]')
if (await firstInput.count()) {
  await wp.fill('input[placeholder="Prénom"]', 'Test')
  await wp.fill('input[placeholder="Nom"]', 'Ouvrier')
  await wp.fill('input[type="email"]', WORKER_EMAIL)
  await wp.fill('input[type="password"]', WORKER_PASS)
  await wp.click('button[type="submit"]')
  await wp.waitForTimeout(4000)
  const afterRegUrl = wp.url()
  const regOk = afterRegUrl.includes('worker') || await wp.locator('text=Bienvenue').count() > 0
  log(regOk ? '✅':'❌', 'Inscription ouvrier + connexion auto', afterRegUrl)
  await shot(wp, '10-after-register')
} else {
  log('⚠️', 'Formulaire register non trouvé')
}

await workerCtx.close()

// ═══════════════════════════════════════════════
// CONTEXTE 3 : SÉCURITÉ (sans session)
// ═══════════════════════════════════════════════
const anonCtx = await br.newContext({ viewport: { width: 1280, height: 800 } })
const ap = await anonCtx.newPage()

await ap.goto(`${BASE}/worker/`, { waitUntil: 'networkidle' })
await ap.waitForTimeout(2500)
log(ap.url().includes('login') ? '✅':'❌', '[PROBE] /worker/ sans session', ap.url().includes('login') ? 'redirigé' : ap.url())

await ap.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' })
await ap.waitForTimeout(2500)
log(ap.url().includes('login') ? '✅':'❌', '[PROBE] /admin/ sans session', ap.url().includes('login') ? 'redirigé' : ap.url())
await shot(ap, '11-security')
await anonCtx.close()

// ═══════════════════════════════════════════════
// CONTEXTE 4 : MOBILE
// ═══════════════════════════════════════════════
const mCtx = await br.newContext({ viewport: { width: 390, height: 844 } })
const mp = await mCtx.newPage()
await mp.goto(`${BASE}/login/`, { waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
await mp.screenshot({ path: '/tmp/frigo-12-mobile.png' })
const bg = await mp.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
log(!bg.includes('255, 255, 255') ? '✅':'❌', 'Mobile fond sombre', bg)
await mCtx.close()

await br.close()
console.log('\n✅ Tests terminés — screenshots dans /tmp/frigo-*.png')
