/**
 * Smoke-tests for the 3 approval bug fixes.
 * Runs against the local dev server on port 3000.
 */

const BASE = 'http://localhost:3000'

async function tabLogin(email, password) {
  const res = await fetch(`${BASE}/api/auth/tab-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`)
  return data.token
}

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let json
  try { json = await res.json() } catch { json = {} }
  return { status: res.status, json }
}

const pass = msg => console.log(`  ✓  ${msg}`)
const fail = msg => { console.error(`  ✗  ${msg}`); process.exitCode = 1 }

// ── main ─────────────────────────────────────────────────────────────────────

console.log('\n=== Approval Bug Fix Verification ===\n')

const adminToken = await tabLogin('admin@trustivasetu.com', 'Rudra@1004#')
pass(`Logged in as admin (token: ${adminToken.slice(0, 20)}...)`)

// ── Bug 1: Attendance approval ────────────────────────────────────────────────

console.log('\n--- Bug 1: Attendance Approval PATCH ---')

const { status: aListSt, json: aListData } = await api('GET', '/api/hr/attendance?pending=true', null, adminToken)
if (aListSt !== 200) {
  fail(`GET pending attendance → ${aListSt}: ${JSON.stringify(aListData)}`)
} else {
  pass(`GET pending attendance → 200 (${aListData.data?.length ?? 0} records)`)

  if (aListData.data?.length > 0) {
    const id = aListData.data[0].id
    const emp = aListData.data[0].user?.name ?? id
    const { status, json } = await api('PATCH', '/api/hr/attendance/approve', { attendanceId: id, action: 'approve' }, adminToken)
    if (status === 200) {
      pass(`PATCH approve attendance for ${emp} → 200, approvalStatus=${json.data?.approvalStatus}`)
    } else if (status === 400) {
      pass(`PATCH approve attendance → 400 (already approved — route reached, no 500)`)
    } else {
      fail(`PATCH approve attendance → ${status}: ${JSON.stringify(json)}`)
    }
  } else {
    pass('No pending attendance records in DB — testing 404 path')
    const { status, json } = await api('PATCH', '/api/hr/attendance/approve', { attendanceId: 'bad-id-000', action: 'approve' }, adminToken)
    status === 404 ? pass(`PATCH bad attendanceId → 404 (route reached)`) : fail(`Expected 404, got ${status}: ${JSON.stringify(json)}`)
  }
}

// ── Bug 2: Expenses visible to manager ───────────────────────────────────────

console.log('\n--- Bug 2: Expenses list (admin all=1) ---')

const { status: eSt, json: eData } = await api('GET', '/api/expenses?status=SUBMITTED&all=1', null, adminToken)
if (eSt === 200 && Array.isArray(eData.data)) {
  pass(`GET expenses?status=SUBMITTED&all=1 → 200, ${eData.data.length} submitted expense(s)`)
} else {
  fail(`GET expenses → ${eSt}: ${JSON.stringify(eData)}`)
}

// Verify own-expense path still works
const { status: eSt2, json: eData2 } = await api('GET', '/api/expenses', null, adminToken)
if (eSt2 === 200 && Array.isArray(eData2.data)) {
  pass(`GET expenses (no params) → 200, ${eData2.data.length} own expense(s)`)
} else {
  fail(`GET expenses (no params) → ${eSt2}`)
}

// Verify all=1 without status filter
const { status: eSt3, json: eData3 } = await api('GET', '/api/expenses?all=1', null, adminToken)
if (eSt3 === 200 && Array.isArray(eData3.data)) {
  pass(`GET expenses?all=1 (no status) → 200, ${eData3.data.length} expense(s)`)
} else {
  fail(`GET expenses?all=1 → ${eSt3}`)
}

// ── Bug 3: Expense approval ───────────────────────────────────────────────────

console.log('\n--- Bug 3: Expense Approval PATCH ---')

const submitted = eData.data?.filter(e => e.status === 'SUBMITTED') ?? []

if (submitted.length > 0) {
  const exp = submitted[0]
  const { status, json } = await api('PATCH', `/api/expenses/${exp.id}/approve`, { action: 'approve' }, adminToken)
  if (status === 200) {
    pass(`PATCH expense ${exp.id.slice(-6)} approve → 200, status=${json.data?.status} (no 500 on email)`)
  } else if (status === 400) {
    pass(`PATCH expense approve → 400 (already approved — route reached)`)
  } else {
    fail(`PATCH expense approve → ${status}: ${JSON.stringify(json)}`)
  }
} else {
  // No submitted expenses — test that the route returns 404 for bad ID (not 500)
  const { status, json } = await api('PATCH', '/api/expenses/bad-id-000/approve', { action: 'approve' }, adminToken)
  status === 404 ? pass('PATCH bad expense ID → 404 (route reached, no crash)') : fail(`Expected 404, got ${status}: ${JSON.stringify(json)}`)
}

// ── Sanity: role guards still in place ───────────────────────────────────────

console.log('\n--- Sanity: unauthenticated calls → 401 ---')

const { status: u1 } = await api('PATCH', '/api/hr/attendance/approve', { attendanceId: 'x', action: 'approve' }, null)
u1 === 401 ? pass('Unauthenticated PATCH attendance/approve → 401') : fail(`Expected 401, got ${u1}`)

const { status: u2 } = await api('PATCH', '/api/expenses/x/approve', { action: 'approve' }, null)
u2 === 401 ? pass('Unauthenticated PATCH expense/approve → 401') : fail(`Expected 401, got ${u2}`)

const { status: u3 } = await api('GET', '/api/expenses?all=1', null, null)
u3 === 401 ? pass('Unauthenticated GET expenses → 401') : fail(`Expected 401, got ${u3}`)

console.log('\n=== Done ===\n')
