# ⚡ OmniChat AI v2 — Smart Mess Management PWA

> Production-ready single-file PWA. Zero build step, zero dependencies, opens directly in any browser or deploys to Netlify in one click.

---

## 🏗️ Architecture

**Everything is in one file** — `index.html`.

This deliberate choice means:
- ✅ Works as a local `file://` without any server
- ✅ No module bundler needed
- ✅ Deploy by dropping the folder anywhere
- ✅ All logic, styles, and markup in one place for easy editing

### How the code is organized inside `index.html`

```
<head>          → Google Fonts + Firebase SDK CDN scripts
<style>         → Full CSS (variables, glass, neon, all sections)
<body>          → Auth screen + App shell (topbar, 5 sections, nav, modals)
<script>        → All JS organized into clear sections:
  ├── Firebase Init
  ├── App State
  ├── Toast system
  ├── Modal helpers
  ├── Auth (login, register, profile setup)
  ├── SPA Router (History API + double-tap nav)
  ├── Listener Manager (prevent memory leaks)
  ├── Presence system
  ├── Home section (dashboard, meals, AI entry, forecast, notices, expenses)
  ├── Bazar section (shopping, inventory, tasks)
  ├── Chat section (real-time messages, polls, online count)
  ├── Analytics section (canvas chart, member stats, expense breakdown, EMF)
  └── Settings section (profile, QR payment, payment approval, members)
```

---

## 📁 Files

```
omnichat-v2/
├── index.html              ← The entire app (self-contained)
├── _redirects              ← Netlify SPA routing (/* /index.html 200)
├── manifest.json           ← PWA installable manifest
├── icon.svg                ← App icon (works as PWA icon)
├── database.rules.json     ← Firebase security rules to deploy
└── firebase-seed-data.json ← Sample data — import into Firebase Console
```

---

## 🚀 Setup (5 minutes)

### Step 1: Firebase Console
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Your project: **trib-b7ad1**
3. **Authentication** → Sign-in method → Enable **Email/Password**
4. **Realtime Database** → Create database → Start in **test mode** (then add rules)

### Step 2: Deploy Security Rules
Option A — Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase use trib-b7ad1
firebase deploy --only database
```
Option B — Firebase Console:
- Go to Realtime Database → Rules tab
- Paste contents of `database.rules.json` → Publish

### Step 3: Import Seed Data (optional but recommended)
- Firebase Console → Realtime Database → top-right (⋮) → **Import JSON**
- Upload `firebase-seed-data.json`

### Step 4: Run
```bash
# Any static server works:
npx serve .
# OR
python3 -m http.server 8080
# OR just open index.html in Chrome/Firefox directly
```

### Step 5: Deploy to Netlify
1. Push folder to GitHub
2. New site from Git → select repo
3. Build command: *(leave empty)*
4. Publish directory: `.` (root)
5. Deploy → done. `_redirects` handles all SPA routes automatically.

---

## 👑 First-time Setup

### Create Manager Account
1. Register with any email/password
2. When profile setup appears, enter name + Manager Code: **`MANAGER2024`**
3. You now have full Manager access

### Create Member Accounts
1. Register with a different email
2. Profile setup: enter name, **leave Manager Code blank**
3. Member gets read access + can chat, vote, add meals

---

## 🎮 Feature Reference

| Feature | Who | How |
|---------|-----|-----|
| Real-time Meal Rate | All | Auto-calculated: Total Expenses ÷ Total Meals |
| Meal Rate Chart | All | Analytics → custom canvas line chart |
| Smart AI Entry | Manager | Home → type "200tk chicken" → Parse → Confirm |
| Meal Forecast | All | Home → tap 🌞🌙 for each day |
| Meal Lock (9AM) | All | Home → Add Meal locks after 9AM automatically |
| Budget Progress | All | Home → neon bar, color changes red as limit approaches |
| Notice Board | Manager posts, All read | Home → last 5 pinned notices |
| Shopping List | Manager edits, All view | Bazar → checkbox marks purchased |
| Inventory Alerts | Manager edits, All view | Bazar → pulsing red when < 20% |
| Task/Duty Tracker | Manager assigns, All mark done | Bazar → today's tasks |
| Real-time Chat | All | Chat → live Firebase listener |
| Polls | Manager creates, All vote | Chat → vote with one tap |
| Online Presence | All | Chat → shows live online count |
| Expense Breakdown | All | Analytics → category bar chart |
| Member Balances | All | Analytics → deposits vs meal dues |
| Emergency Fund | Manager | Analytics → deposit/withdraw with history |
| QR Code Payment | Manager sets, Members pay | Settings → paste QR URL + number |
| Payment Approval | Manager | Settings → ✓/✗ approve submitted TxnIDs |
| Profile Edit | Self | Settings → tap name to edit |
| Monthly Budget | Manager | Settings → set budget, home shows progress |

---

## 🧭 Navigation Details

### Single Tap
→ Switches section + updates URL (`/home`, `/bazar`, `/chat`, `/analytics`, `/settings`)

### Double Tap (same icon within 280ms)
→ Smoothly scrolls current section back to top

### Browser Back/Forward
→ Fully supported via `history.pushState` + `popstate` listener

---

## 🔒 Security Model

| Node | Managers | Members | Unauthenticated |
|------|----------|---------|-----------------|
| `users` | Read+Write | Read+Write own | ✗ |
| `meals` | Read+Write | Read+Write | ✗ |
| `expenses` | Read+Write | Read only | ✗ |
| `budget` | Read+Write | Read only | ✗ |
| `shopping` | Read+Write | Read only | ✗ |
| `inventory` | Read+Write | Read only | ✗ |
| `tasks` | Read+Write | Read+Write | ✗ |
| `notices` | Read+Write | Read only | ✗ |
| `chat` | Read+Write | Read+Write | ✗ |
| `polls` | Read+Write | Read+Vote only | ✗ |
| `payments` | Read+Approve | Submit own | ✗ |
| `paymentInfo` | Read+Write | Read only | ✗ |
| `forecasts` | Read all | Read+Write own | ✗ |
| `emergencyFund` | Read+Write | Read only | ✗ |
| `presence` | Read all | Read all + Write own | ✗ |

---

## 🔧 Customization

### Change Manager Code
In `index.html`, find:
```js
const role = code === 'MANAGER2024' ? 'manager' : 'member';
```
Change `'MANAGER2024'` to any code you want.

### Change Meal Lock Time
```js
const locked = hr >= 9;  // Change 9 to any hour (24h format)
```

### Add/Change Neon Colors
In the CSS `:root` block:
```css
--c: #00f5ff;   /* cyan — primary accent */
--m: #ff00ff;   /* magenta — secondary */
--g: #00ff88;   /* lime — success/positive */
--o: #ff8c00;   /* orange — warning */
```

### Add PDF Export
Include jsPDF in `<head>`:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```
Then use `new jsPDF()` inside the `genReport()` function.
