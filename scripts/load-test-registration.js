import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

// --- Config ---
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_KEY = __ENV.SUPABASE_KEY;
const PLATFORM_URL = __ENV.PLATFORM_URL || 'https://platform.konferanszamancarklari.com';

// Extract project ref from Supabase URL (e.g. "abcdef" from "https://abcdef.supabase.co")
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];

// HTTP Basic Auth for nginx
const BASIC_AUTH = encoding.b64encode('admin:dokuzdokuzdoksandokuz');

const CLUBS = [
  'Ege Rotaract Kulübü',
  'Karşıyaka Rotaract Kulübü',
  'Bornova Rotaract Kulübü',
  'Alsancak Rotaract Kulübü',
  'Buca Rotaract Kulübü',
];

const GOREVLER = ['uye', 'sekreter', 'sayman', 'komite-bsk', 'misafir'];
const GENDERS = ['Erkek', 'Kadın'];

// Minimal valid 1x1 PNG (68 bytes)
const FAKE_PNG = encoding.b64decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
);

// Stagger VU starts: 10 VUs, each gets a random delay to avoid rate limits
export const options = {
  scenarios: {
    registration: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 3, // 1 registration + 2 logins per VU
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.2'],
    http_req_duration: ['p(95)<5000'],
  },
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function supabaseHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
  };
}

// Build the Supabase SSR auth cookie from a verify response body.
// The SSR client expects: cookie name = `sb-<ref>-auth-token`
// Value = base64url-encoded JSON session, prefixed with `base64-`
function buildAuthCookie(verifyBody) {
  const session = JSON.stringify({
    access_token: verifyBody.access_token,
    refresh_token: verifyBody.refresh_token,
    expires_in: verifyBody.expires_in,
    expires_at: verifyBody.expires_at,
    token_type: verifyBody.token_type || 'bearer',
    user: verifyBody.user,
  });
  const encoded = encoding.b64encode(session, 'url');
  return `sb-${PROJECT_REF}-auth-token=base64-${encoded}`;
}

// --- Auth: OTP send + verify, returns { cookie, accessToken, userId } or null ---
function authenticate(phone, tag) {
  // Send OTP
  let res = http.post(
    `${SUPABASE_URL}/auth/v1/otp`,
    JSON.stringify({ phone }),
    { headers: supabaseHeaders(), tags: { step: 'send_otp' } }
  );
  if (!check(res, { 'otp sent': (r) => r.status === 200 })) {
    console.error(`[${tag}] OTP send failed: ${res.status} ${res.body}`);
    return null;
  }
  sleep(1);

  // Verify OTP
  res = http.post(
    `${SUPABASE_URL}/auth/v1/verify`,
    JSON.stringify({ phone, token: '12345678', type: 'sms' }),
    { headers: supabaseHeaders(), tags: { step: 'verify_otp' } }
  );
  if (!check(res, { 'otp verified': (r) => r.status === 200 })) {
    console.error(`[${tag}] OTP verify failed: ${res.status} ${res.body}`);
    return null;
  }

  const body = JSON.parse(res.body);
  if (!body.access_token || !body.user) {
    console.error(`[${tag}] No access token or user`);
    return null;
  }

  return {
    cookie: buildAuthCookie(body),
    accessToken: body.access_token,
    userId: body.user.id,
  };
}

// --- Registration flow (first iteration) ---
function register(phone, tag) {
  // Load signup page
  let res = http.get(`${PLATFORM_URL}/kayit`, { headers: { 'Authorization': `Basic ${BASIC_AUTH}` }, tags: { step: 'page_load' } });
  check(res, { 'signup page 200': (r) => r.status === 200 });
  sleep(1);

  // Authenticate
  const auth = authenticate(phone, tag);
  if (!auth) return;
  sleep(1);

  // Fetch packages
  res = http.get(
    `${SUPABASE_URL}/rest/v1/packages?select=*`,
    { headers: supabaseHeaders(auth.accessToken), tags: { step: 'fetch_packages' } }
  );
  check(res, { 'packages loaded': (r) => r.status === 200 });

  const packages = JSON.parse(res.body);
  if (!packages || packages.length === 0) {
    console.error(`[${tag}] No packages found`);
    return;
  }
  const pkg = pick(packages);
  sleep(1);

  // Upload dekont
  const filePath = `${auth.userId}/dekont.png`;
  res = http.post(
    `${SUPABASE_URL}/storage/v1/object/dekontlar/${filePath}`,
    FAKE_PNG,
    {
      headers: {
        'Content-Type': 'image/png',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${auth.accessToken}`,
        'x-upsert': 'true',
      },
      tags: { step: 'upload_dekont' },
    }
  );
  if (!check(res, { 'dekont uploaded': (r) => r.status === 200 })) {
    console.error(`[${tag}] Dekont upload failed: ${res.status} ${res.body}`);
    return;
  }
  sleep(0.5);

  // Complete profile — pass Supabase session as proper SSR cookie
  res = http.post(
    `${PLATFORM_URL}/api/complete-profile`,
    JSON.stringify({
      firstName: `Test${__VU}`,
      lastName: `Kullanıcı${__VU}`,
      club: pick(CLUBS),
      gorev: pick(GOREVLER),
      gender: pick(GENDERS),
      packageId: pkg.id,
      pricingType: 'early_bird',
      dekontPath: filePath,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${BASIC_AUTH}`,
        'Cookie': auth.cookie,
      },
      tags: { step: 'complete_profile' },
    }
  );
  check(res, { 'profile completed': (r) => r.status === 200 });
  if (res.status !== 200) {
    console.error(`[${tag}] Complete profile failed: ${res.status} ${res.body}`);
  }
  sleep(1);
}

// --- Login flow (subsequent iterations) ---
function login(phone, tag) {
  // Load login page
  let res = http.get(`${PLATFORM_URL}/giris`, { headers: { 'Authorization': `Basic ${BASIC_AUTH}` }, tags: { step: 'login_page' } });
  check(res, { 'login page 200': (r) => r.status === 200 });
  sleep(1);

  // Authenticate
  const auth = authenticate(phone, tag);
  if (!auth) return;
  sleep(1);

  // Browse authenticated pages
  res = http.get(`${PLATFORM_URL}/`, { headers: { 'Authorization': `Basic ${BASIC_AUTH}` }, tags: { step: 'dashboard' } });
  check(res, { 'dashboard loaded': (r) => r.status < 400 });
  sleep(1);

  res = http.get(`${PLATFORM_URL}/odemeler`, { headers: { 'Authorization': `Basic ${BASIC_AUTH}` }, tags: { step: 'payments' } });
  check(res, { 'payments loaded': (r) => r.status < 400 });
  sleep(1);
}

// --- Main ---
export default function () {
  // Stagger VU starts: each VU waits 0-3s based on its VU number to avoid rate limits
  if (__ITER === 0) {
    sleep((__VU - 1) * 0.3); // VU1 starts immediately, VU10 waits 2.7s
  }

  const phone = `+90555${String(__VU).padStart(7, '0')}`;
  const tag = `vu${__VU}-iter${__ITER}`;

  if (__ITER === 0) {
    register(phone, tag);
  } else {
    login(phone, tag);
  }

  // Small random delay between iterations to spread requests
  sleep(Math.random() * 2);
}
