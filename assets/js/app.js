/* ═══════════════════════════════════════════════════════
   GoRoute | app.js
   All auth + app logic powered by Supabase
   ═══════════════════════════════════════════════════════ */

// ── Supabase Init ──────────────────────────────────────
const SUPABASE_URL     = 'https://djyegteotxpiqsycpwuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVndGVvdHhwaXFzeWNwd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjE0NTMsImV4cCI6MjA5MzAzNzQ1M30.OFRtRheiZBlZ-3twI2o9vjakeETjacrZVJQhEygwZHc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Seat State ─────────────────────────────────────────
let currentScheduleId  = null;
let currentTicketPrice = 0;
let currentBusName     = '';
let currentOrigin      = '';
let currentDest        = '';
let selectedSeats      = [];
let currentAuthSession = null;

function getProfileInitials(session) {
  const meta = session?.user?.user_metadata || {};
  const fullName = (meta.full_name || meta.name || meta.display_name || '').trim();
  const email = (session?.user?.email || '').trim();
  const source = fullName || email;

  if (!source) return 'U';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return parts[0]?.[0]?.toUpperCase() || 'U';
}

function renderHeaderProfile() {
  const chip = document.getElementById('headerProfileBtn');
  const avatar = document.getElementById('headerProfileAvatar');
  if (!chip || !avatar) return;

  const session = currentAuthSession;
  const meta = session?.user?.user_metadata || {};
  const fullName = (meta.full_name || meta.name || meta.display_name || '').trim();
  const email = (session?.user?.email || '').trim();
  const avatarUrl = meta.avatar_url || meta.picture || meta.avatar || '';
  const label = fullName || email || 'Profile';

  chip.title = label;
  chip.setAttribute('aria-label', `${label} profile`);

  if (avatarUrl) {
    avatar.classList.add('has-photo');
    avatar.style.backgroundImage = `url("${avatarUrl}")`;
    avatar.textContent = '';
  } else {
    avatar.classList.remove('has-photo');
    avatar.style.backgroundImage = '';
    avatar.textContent = getProfileInitials(session);
  }
}

function setCurrentAuthSession(session) {
  currentAuthSession = session || null;
  renderHeaderProfile();
}

// ── Auth Routing ───────────────────────────────────────
sb.auth.getSession().then(({ data }) => {
  setCurrentAuthSession(data.session);
  const currentPage = window.location.pathname;
  if (data.session && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } else if (!data.session && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

sb.auth.onAuthStateChange((event, session) => {
  setCurrentAuthSession(session);
  const currentPage = window.location.pathname;
  if (event === 'SIGNED_IN' && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } else if (event === 'SIGNED_OUT' && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

document.addEventListener('DOMContentLoaded', renderHeaderProfile);

// ════════════════════════════════════════════════════════
//   SHARED TAB SWITCHER
// ════════════════════════════════════════════════════════
function switchTab(tab) {

  // ── Auth page: login ↔ signup ──────────────────────
  if (tab === 'login' || tab === 'signup') {
    hideAlert();
    const isLogin = tab === 'login';
    if (document.getElementById('loginForm'))
      document.getElementById('loginForm').style.display  = isLogin ? '' : 'none';
    if (document.getElementById('signupForm'))
      document.getElementById('signupForm').style.display = isLogin ? 'none' : '';
    if (document.getElementById('otpPanel'))
      document.getElementById('otpPanel').classList.remove('show');
    if (document.getElementById('socialSection'))
      document.getElementById('socialSection').style.display = '';
    if (document.getElementById('loginTab'))
      document.getElementById('loginTab').classList.toggle('active', isLogin);
    if (document.getElementById('signupTab'))
      document.getElementById('signupTab').classList.toggle('active', !isLogin);
    if (document.getElementById('switchText'))
      document.getElementById('switchText').innerHTML = isLogin
        ? "Don't have an account? <a href=\"#\" onclick=\"switchTab('signup');return false;\">Create one</a>"
        : "Already have an account? <a href=\"#\" onclick=\"switchTab('login');return false;\">Sign in</a>";
    return;
  }

  // ── Main app: hide all screens, then show target ───
  const allScreens = [
    'searchScreen', 'resultsScreen', 'seatScreen',
    'ticketsScreen', 'walletScreen', 'accountScreen', 'bookingFormScreen'
  ];
  allScreens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  ['home','tickets','wallet','account'].forEach(id => {
    const el = document.getElementById(`nav-${id}`);
    if (el) el.classList.remove('active');
  });

  if (tab === 'home') {
    if (document.getElementById('searchScreen'))
      document.getElementById('searchScreen').style.display = 'block';
    if (document.getElementById('nav-home'))
      document.getElementById('nav-home').classList.add('active');
  } else if (tab === 'tickets') {
    if (document.getElementById('ticketsScreen'))
      document.getElementById('ticketsScreen').style.display = 'block';
    if (document.getElementById('nav-tickets'))
      document.getElementById('nav-tickets').classList.add('active');
    loadMyTickets();
  } else if (tab === 'wallet') {
    if (document.getElementById('walletScreen'))
      document.getElementById('walletScreen').style.display = 'block';
    if (document.getElementById('nav-wallet'))
      document.getElementById('nav-wallet').classList.add('active');
    loadWallet();
  } else if (tab === 'account') {
    if (document.getElementById('accountScreen'))
      document.getElementById('accountScreen').style.display = 'block';
    if (document.getElementById('nav-account'))
      document.getElementById('nav-account').classList.add('active');
    loadAccount();
  }
}

// ════════════════════════════════════════════════════════
//   AUTH PAGE FUNCTIONS
// ════════════════════════════════════════════════════════

// ── Alert helpers ──
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertBox');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert ${type} show`;
}
function hideAlert() {
  const el = document.getElementById('alertBox');
  if (el) el.className = 'alert';
}

// ── Show/hide password ──
function togglePw(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
}

// ── Login ──
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();
  const btn = document.getElementById('loginBtn');
  btn.innerHTML = '<span class="spinner"></span>Signing in…';
  btn.disabled = true;
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    showAlert(error.message);
    btn.innerHTML = 'Sign In';
    btn.disabled = false;
  } else {
    btn.innerHTML = '✓ Redirecting…';
    // Admin door — change this to your admin email
    if (email.toLowerCase() === 'admin@goroute.com') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'index.html';
    }
  }
}

// ── Sign up ──
async function handleSignup(e) {
  e.preventDefault();
  hideAlert();
  const btn = document.getElementById('signupBtn');
  btn.innerHTML = '<span class="spinner"></span>Creating account…';
  btn.disabled = true;

  const first = document.getElementById('firstName').value.trim();
  const last  = document.getElementById('lastName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const pw    = document.getElementById('signupPassword').value;

  const { error } = await sb.auth.signUp({
    email, password: pw,
    options: { data: { full_name: `${first} ${last}`, phone } }
  });

  if (error) {
    showAlert(error.message);
    btn.innerHTML = 'Create Account';
    btn.disabled = false;
  } else {
    document.getElementById('signupForm').style.display  = 'none';
    document.getElementById('socialSection').style.display = 'none';
    document.getElementById('otpPanel').classList.add('show');
    document.getElementById('otpEmail').textContent = email;
    showAlert('Account created! Check your email to confirm it.', 'success');
  }
}

// ── OTP auto-advance ──
function otpInput(el, idx) {
  const boxes = document.querySelectorAll('.otp-box');
  if (el.value && idx < boxes.length - 1) boxes[idx + 1].focus();
  if (!el.value && idx > 0) boxes[idx - 1].focus();
}

async function verifyOtp() {
  const boxes = document.querySelectorAll('.otp-box');
  const code  = [...boxes].map(b => b.value).join('');
  const email = document.getElementById('otpEmail').textContent;
  if (code.length < 6) { showAlert('Enter the full 6-digit code.'); return; }
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) showAlert(error.message);
  else window.location.href = 'index.html';
}

async function resendOtp() {
  const email = document.getElementById('otpEmail').textContent;
  await sb.auth.resend({ type: 'signup', email });
  showAlert('Code resent! Check your email.', 'success');
}

// ── Forgot password ──
async function showForgot() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showAlert('Enter your email address above first.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth.html'
  });
  if (error) showAlert(error.message);
  else showAlert('Password reset link sent! Check your inbox.', 'success');
}

// ── Social auth ──
async function handleGoogle() {
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/index.html' }
  });
}
async function handleFacebook() {
  await sb.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: window.location.origin + '/index.html' }
  });
}

// ── Logout ──
async function handleLogout() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}

// ── Date Button Logic ──
let finalBookingDate = new Date().toISOString().split('T')[0];
let selectedDate = 'today'; // Default to today

function triggerCalendar() {
  const calendar = document.getElementById('hiddenCalendar');
  const otherBtn = document.getElementById('otherBtn');
  if (!calendar || !otherBtn) return;

  calendar.min = new Date().toISOString().split('T')[0];
  selectDate(otherBtn, 'other');

  if (typeof calendar.showPicker === 'function') {
    calendar.showPicker();
  } else {
    calendar.click();
  }
}

function selectDate(btn, val) {
  document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');

  if (val === 'today' || val === 'tomorrow') {
    const d = new Date();
    if (val === 'tomorrow') d.setDate(d.getDate() + 1);
    finalBookingDate = d.toISOString().split('T')[0];
    const otherBtn = document.getElementById('otherBtn');
    if (otherBtn) otherBtn.innerText = 'Other';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    finalBookingDate = val;
  }

  selectedDate = val;
  console.log("Booking for:", finalBookingDate);
}

document.addEventListener('DOMContentLoaded', () => {
  const calendar = document.getElementById('hiddenCalendar');
  const otherBtn = document.getElementById('otherBtn');
  if (!calendar || !otherBtn) return;

  calendar.addEventListener('change', function(e) {
    const selected = e.target.value;
    if (!selected) return;

    finalBookingDate = selected;
    const dateObj = new Date(selected);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    otherBtn.innerText = formattedDate;
    selectDate(otherBtn, selected);
  });
});

// ── Simple Swap Logic ──
function swapLocations() {
  const origin = document.getElementById('searchOrigin');
  const dest = document.getElementById('searchDestination');

  const temp = origin.value;
  origin.value = dest.value;
  dest.value = temp;
}

// ── Philippine Cities Data ──
const phCities = [
  "Alaminos", "Angeles City", "Antipolo", "Bacoor", "Bacolod", "Bago", "Baguio", "Bais", "Balanga", "Batac", 
  "Batangas City", "Bayawan", "Baybay", "Bayugan", "Biñan", "Bislig", "Bogo", "Borongan", "Butuan", "Cabadbaran",
   "Cabanatuan", "Cabuyao", "Cadiz", "Cagayan de Oro", "Calamba", "Calapan", "Calasiao", "Calbayog", "Caloocan", 
   "Candon", "Canlaon", "Carcar", "Catbalogan", "Cauayan", "Cavite City", "Cebu City", "Cotabato City", "Dagupan",
    "Danao", "Dapitan", "Dasmariñas", "Davao City", "Digos", "Dipolog", "Dumaguete", "El Salvador", "Escalante", 
    "Gapan", "General Santos", "General Trias", "Gingoog", "Guihulngan", "Himamaylan", "Ilagan", "Iligan", 
    "Iloilo City", "Imus", "Iriga", "Isabela City", "Kabankalan", "Kidapawan", "Koronadal", "La Carlota", 
    "Lamitan", "Laoag", "Lapu-Lapu", "Las Piñas", "Legazpi", "Ligao", "Lipa", "Lucena", "Maasin", "Mabalacat", 
    "Mandaluyong", "Mandaue", "Manila", "Marawi", "Marikina", "Masbate City", "Mati", "Meycauayan", "Muñoz", 
    "Muntinlupa", "Naga", "Navotas", "Olongapo", "Ormoc", "Oroquieta", "Ozamiz", "Pagadian", "Palayan", "Panabo", 
    "Pansol", "Parañaque", "Pasay", "Pasig", "Passi", "Puerto Princesa", "Quezon City", "Roxas City", "Sagay", 
    "Samal", "San Carlos (Negros)", "San Carlos (Pangasinan)", "San Fernando (La Union)", "San Fernando (Pampanga)", 
    "San Jose", "San Jose del Monte", "San Juan", "San Pablo", "San Pedro", "Santa Rosa", "Santiago", "Silay", 
    "Sorsogon City", "Surigao City", "Tabaco", "Tabuk", "Tacloban", "Tacurong", "Tagaytay", "Tagbilaran", "Taguig",
     "Tagum", "Talisay (Cebu)", "Talisay (Negros)", "Tanauan", "Tandag", "Tangub", "Tanjay", "Tarlac City", 
     "Tayabas", "Toledo", "Trece Martires", "Tuguegarao", "Urdaneta", "Valencia", "Valenzuela", "Victorias", 
     "Vigan", "Zamboanga City"
];

// ── Function to Populate Dropdowns ──
function initCityDropdowns() {
  const originSelect = document.getElementById('searchOrigin');
  const destSelect = document.getElementById('searchDestination');
  if (!originSelect || !destSelect) return;

  const sortedCities = [...phCities].sort();

  sortedCities.forEach(city => {
    const optOrigin = document.createElement('option');
    optOrigin.value = city;
    optOrigin.textContent = city;
    originSelect.appendChild(optOrigin);

    const optDest = document.createElement('option');
    optDest.value = city;
    optDest.textContent = city;
    destSelect.appendChild(optDest);
  });
}

document.addEventListener('DOMContentLoaded', initCityDropdowns);

// ── Multi-City Logic ──
let routeCount = 1;

function addRoute() {
  routeCount++;
  const container = document.getElementById('routesContainer');
  
  // We grab the destination of the PREVIOUS route to auto-fill the origin of the NEW route
  // (e.g., if Route 1 goes to Manila, Route 2 should automatically start in Manila!)
  const allDestInputs = document.querySelectorAll('.dest-input');
  const lastDestination = allDestInputs[allDestInputs.length - 1].value;

  const newRouteHTML = `
    <div class="route-segment" id="route-${routeCount}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 13px; font-weight: 700; color: #94A3B8;">Route ${routeCount}</span>
        <button type="button" class="remove-route-btn" onclick="removeRoute('route-${routeCount}')">✕ Remove</button>
      </div>
      
      <div style="position: relative; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <select class="finput origin-input" required>
          <option value="Cebu" ${lastDestination === 'Cebu' ? 'selected' : ''}>Cebu</option>
          <option value="Manila" ${lastDestination === 'Manila' ? 'selected' : ''}>Manila</option>
          <option value="Davao" ${lastDestination === 'Davao' ? 'selected' : ''}>Davao</option>
          <option value="Iloilo" ${lastDestination === 'Iloilo' ? 'selected' : ''}>Iloilo</option>
          <option value="Baguio" ${lastDestination === 'Baguio' ? 'selected' : ''}>Baguio</option>
        </select>
        
        <button type="button" class="swap-btn" onclick="swapDynamicLocations(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 10v12"></path><path d="M11 18l-4 4-4-4"></path><path d="M17 14V2"></path><path d="M21 6l-4-4-4 4"></path>
          </svg>
        </button>

        <select class="finput dest-input" required>
          <option value="" disabled selected>Going to...</option>
          <option value="Cebu">Cebu</option>
          <option value="Manila">Manila</option>
          <option value="Davao">Davao</option>
          <option value="Iloilo">Iloilo</option>
          <option value="Baguio">Baguio</option>
        </select>
      </div>
      
      <!-- Simple Date Input for additional routes -->
      <input type="date" class="finput" style="width: 100%; color: #64748B;">
    </div>
  `;
  
  // Inject the new route into the HTML
  container.insertAdjacentHTML('beforeend', newRouteHTML);
}

function removeRoute(routeId) {
  const routeToRemove = document.getElementById(routeId);
  if (routeToRemove) {
    routeToRemove.remove();
    routeCount--; // Optional: recalculate route numbers if you want to get fancy!
  }
}

// ── Smart Location Swap (Works on any route row!) ──
function swapDynamicLocations(btnElement) {
  // Find the exact inputs next to the specific button you clicked
  const container = btnElement.parentElement;
  const originInput = container.querySelector('.origin-input');
  const destInput = container.querySelector('.dest-input');
  
  // Swap their values
  const temp = originInput.value;
  originInput.value = destInput.value;
  destInput.value = temp;
}

// ════════════════════════════════════════════════════════
//   BUS SEARCH
// ════════════════════════════════════════════════════════
async function resolveLocationId(locationName) {
  if (!locationName) return null;

  const { data, error } = await sb
    .from('locations')
    .select('id')
    .eq('name', locationName)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function findBuses() {
    // 1. Grab inputs
    const originName = document.getElementById('searchOrigin').value;
    const destName = document.getElementById('searchDestination').value;
    
    // Assumes you have a variable 'finalBookingDate' from your calendar/date pills
    // If you don't, it defaults to today.
    let searchDate = new Date(window.finalBookingDate || new Date());

    // 2. The Timezone Fix: Create a window from 00:00:00 to 23:59:59
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Searching from ${originName} to ${destName} on ${startOfDay.toDateString()}`);

    // 3. Query Supabase
    const { data, error } = await sb
        .from('schedules')
        .select(`
            id, price, departure_time, arrival_time,
            buses ( operator_name, bus_type ),
            origin:locations!origin_id ( name ),
            destination:locations!destination_id ( name )
        `)
        .eq('origin.name', originName)
        .eq('destination.name', destName)
        .gte('departure_time', startOfDay.toISOString())
        .lte('departure_time', endOfDay.toISOString())
        .order('departure_time', { ascending: true }); // Sort by earliest departure

    // 4. Handle Results
    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("0 Results found.");
        // Code to show your "No buses found" empty state here
    } else {
        console.log("Success! Found Buses:", data);
        // Code to render your bus ticket cards here
    }
}

async function searchBuses(originName, destName, selectedDate) {
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const originId = await resolveLocationId(originName);
  const destId = await resolveLocationId(destName);

  if (!originId || !destId) {
    showNoResults();
    return;
  }

  const { data, error } = await sb
    .from('schedules')
    .select(`
      *,
      buses (*),
      origin:origin_id(name),
      destination:destination_id(name)
    `)
    .eq('origin_id', originId)
    .eq('destination_id', destId)
    .gte('departure_time', startOfDay.toISOString())
    .lte('departure_time', endOfDay.toISOString());

  console.log("Database returned:", data);

  if (error) {
    console.error("Database Error:", error);
    alert("Error: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    showNoResults();
  } else {
    renderTickets(data);
  }
}

function showNoResults() {
  const resultsContainer = document.getElementById('resultsContainer');
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div style="text-align:center;padding:30px 20px;">
        <div style="font-size:28px;margin-bottom:10px;">🔍</div>
        <div style="font-size:13px;font-weight:700;color:var(--blue-dark);margin-bottom:4px;">No buses found</div>
        <div style="font-size:12px;color:var(--text3);">Try a different route or date.</div>
      </div>`;
  }

  document.getElementById('searchScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';
}

function renderTickets(data) {
  const resultsContainer = document.getElementById('resultsContainer');
  if (!resultsContainer) return;

  document.getElementById('searchScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';

  const routeTitle = document.querySelector('#resultsScreen .route-title');
  if (routeTitle && data[0]) {
    const routeSpans = routeTitle.querySelectorAll('span');
    if (routeSpans[0]) routeSpans[0].textContent = data[0].origin?.name || '';
    if (routeSpans[1]) routeSpans[1].textContent = data[0].destination?.name || '';
  }

  const dateBadge = document.querySelector('#resultsScreen .date-badge');
  if (dateBadge) {
    if (selectedDate === 'today') {
      dateBadge.textContent = 'Today';
    } else if (selectedDate === 'tomorrow') {
      dateBadge.textContent = 'Tomorrow';
    } else {
      dateBadge.textContent = new Date(finalBookingDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  resultsContainer.innerHTML = '';

  data.forEach((schedule, i) => {
    const depDate = new Date(schedule.departure_time);
    const arrDate = new Date(schedule.arrival_time);
    const depTime = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const arrTime = arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diffMs = arrDate - depDate;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.round((diffMs % 3600000) / 60000);
    const duration = diffMins > 0 ? `${diffHrs}h ${diffMins}m` : `${diffHrs}h`;
    const isFeatured = i === 0 ? 'featured' : '';

    resultsContainer.innerHTML += `
      <div class="bus-card ${isFeatured}" onclick="openSeatSelection(
        '${schedule.id}',
        ${schedule.price},
        '${(schedule.origin?.name || 'Origin').replace(/'/g,"\\'")}',
        '${(schedule.destination?.name || 'Destination').replace(/'/g,"\\'")}',
        '${duration}',
        '${(schedule.buses?.operator_name || 'Bus').replace(/'/g,"\\'")}',
        '${(schedule.buses?.bus_type || '').replace(/'/g,"\\'")}',
        ${schedule.buses?.total_seats || 20}
      )">
        <div class="bus-name">${schedule.buses?.operator_name || '—'}</div>
        <div class="bus-type">${schedule.buses?.bus_type || '—'} · ${duration}</div>
        <div class="bus-row">
          <div class="time-block">
            <div class="time">${depTime}</div>
            <div class="place">${schedule.origin?.name || '—'}</div>
          </div>
          <div class="duration">—— ${duration} ——</div>
          <div class="time-block" style="text-align:right">
            <div class="time">${arrTime}</div>
            <div class="place">${schedule.destination?.name || '—'}</div>
          </div>
        </div>
        <div class="bus-row" style="margin-top:6px">
          <div class="seats-left">${schedule.buses?.total_seats || '?'} seats available</div>
          <div class="price">₱ ${Number(schedule.price).toLocaleString()}</div>
        </div>
      </div>`;
  });
}

async function searchBusesLegacy() {
  const btn = document.querySelector('.find-buses-btn') || document.querySelector('.primary-btn') || document.querySelector('.search-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>Searching…';
  btn.disabled = true;
  const origin = document.getElementById('searchOrigin')?.value || '';
  const destination = document.getElementById('searchDestination')?.value || '';

  if (!origin || !destination) {
    alert('Please choose both an origin and a destination.');
    btn.innerHTML = originalText;
    btn.disabled = false;
    return;
  }

  try {
    const { data: schedules, error } = await sb
      .from('schedules')
      .select(`
        id,
        departure_time,
        arrival_time,
        price,
        buses ( operator_name, bus_type, total_seats ),
        origin:origin_id ( name ),
        destination:destination_id ( name )
      `)
      .eq('origin.name', origin)
      .eq('destination.name', destination);

    let filteredSchedules = schedules || [];

    if (error) {
      console.warn('Direct route filter failed, falling back to local filtering.', error);
      const fallback = await sb
        .from('schedules')
        .select(`
          id,
          departure_time,
          arrival_time,
          price,
          buses ( operator_name, bus_type, total_seats ),
          origin:origin_id ( name ),
          destination:destination_id ( name )
        `);
      if (fallback.error) throw fallback.error;
      filteredSchedules = (fallback.data || []).filter(schedule => {
        const scheduleOrigin = schedule.origin?.name || '';
        const scheduleDestination = schedule.destination?.name || '';
        return scheduleOrigin === origin && scheduleDestination === destination;
      });
    }

    document.getElementById('searchScreen').style.display  = 'none';
    document.getElementById('resultsScreen').style.display = 'block';

    const resultsRouteTitle = document.querySelector('#resultsScreen .route-title');
    if (resultsRouteTitle) {
      const routeSpans = resultsRouteTitle.querySelectorAll('span');
      if (routeSpans[0]) routeSpans[0].textContent = origin;
      if (routeSpans[1]) routeSpans[1].textContent = destination;
    }

    const dateBadge = document.querySelector('#resultsScreen .date-badge');
    if (dateBadge) {
      if (selectedDate === 'today') {
        dateBadge.textContent = 'Today';
      } else if (selectedDate === 'tomorrow') {
        dateBadge.textContent = 'Tomorrow';
      } else {
        dateBadge.textContent = new Date(finalBookingDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }

    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    if (!filteredSchedules.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:28px;margin-bottom:10px;">🔍</div>
          <div style="font-size:13px;font-weight:700;color:var(--blue-dark);margin-bottom:4px;">No buses found</div>
          <div style="font-size:12px;color:var(--text3);">Try a different route or date.</div>
        </div>`;
      return;
    }

    filteredSchedules.forEach((schedule, i) => {
      const depDate   = new Date(schedule.departure_time);
      const arrDate   = new Date(schedule.arrival_time);
      const depTime   = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const arrTime   = arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const diffMs    = arrDate - depDate;
      const diffHrs   = Math.floor(diffMs / 3600000);
      const diffMins  = Math.round((diffMs % 3600000) / 60000);
      const duration  = diffMins > 0 ? `${diffHrs}h ${diffMins}m` : `${diffHrs}h`;
      const isFeatured = i === 0 ? 'featured' : '';

      container.innerHTML += `
        <div class="bus-card ${isFeatured}" onclick="openSeatSelection(
            '${schedule.id}',
            ${schedule.price},
            '${(schedule.origin?.name || 'Origin').replace(/'/g,"\\'")}',
            '${(schedule.destination?.name || 'Destination').replace(/'/g,"\\'")}',
            '${duration}',
            '${(schedule.buses?.operator_name || 'Bus').replace(/'/g,"\\'")}',
            '${(schedule.buses?.bus_type || '').replace(/'/g,"\\'")}',
            ${schedule.buses?.total_seats || 20}
          )">
          <div class="bus-name">${schedule.buses?.operator_name || '—'}</div>
          <div class="bus-type">${schedule.buses?.bus_type || '—'} · ${duration}</div>
          <div class="bus-row">
            <div class="time-block">
              <div class="time">${depTime}</div>
              <div class="place">${schedule.origin?.name || '—'}</div>
            </div>
            <div class="duration">── ${duration} ──</div>
            <div class="time-block" style="text-align:right">
              <div class="time">${arrTime}</div>
              <div class="place">${schedule.destination?.name || '—'}</div>
            </div>
          </div>
          <div class="bus-row" style="margin-top:6px">
            <div class="seats-left">${schedule.buses?.total_seats || '?'} seats available</div>
            <div class="price">₱ ${Number(schedule.price).toLocaleString()}</div>
          </div>
        </div>`;
    });

  } catch (err) {
    alert('Error fetching buses: ' + err.message);
    document.getElementById('searchScreen').style.display  = 'block';
    document.getElementById('resultsScreen').style.display = 'none';
  } finally {
    btn.innerHTML = originalText;
    btn.disabled  = false;
  }
}

// ════════════════════════════════════════════════════════
//   SEAT SELECTION
// ════════════════════════════════════════════════════════
async function openSeatSelection(scheduleId, price, origin, dest, duration, busName, busType, totalSeats) {
  currentScheduleId  = scheduleId;
  currentTicketPrice = price;
  currentOrigin      = origin;
  currentDest        = dest;
  currentBusName     = busName;
  selectedSeats      = [];

  document.getElementById('seatOrigin').innerText    = origin;
  document.getElementById('seatDest').innerText      = dest;
  document.getElementById('seatPriceBadge').innerText = `₱ ${Number(price).toLocaleString()} · ${duration}`;
  updateSeatFooter();

  // Fetch already-booked seats for this schedule
  const { data: bookings } = await sb
    .from('bookings')
    .select('seat_number')
    .eq('schedule_id', scheduleId)
    .in('status', ['Confirmed', 'confirmed']);

  const bookedSeatNumbers = bookings ? bookings.map(b => b.seat_number) : [];

  // Generate seat grid (5 rows × 2+2 layout = 20 seats)
  const grid = document.getElementById('seatGrid');
  grid.innerHTML = '';
  const rows = 5;
  const cols = ['A', 'B', 'C', 'D'];

  for (let r = 1; r <= rows; r++) {
    cols.forEach(c => {
      const seatNum  = `${r}${c}`;
      const isBooked = bookedSeatNumbers.includes(seatNum);
      if (isBooked) {
        grid.innerHTML += `<div class="seat booked">${seatNum}</div>`;
      } else {
        grid.innerHTML += `<div class="seat avail" id="seat-${seatNum}" onclick="toggleSeat('${seatNum}')">${seatNum}</div>`;
      }
      if (c === 'B') grid.innerHTML += `<div class="aisle"></div>`;
    });
  }

  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('seatScreen').style.display    = 'block';
}

function toggleSeat(seatNum) {
  const seatEl = document.getElementById(`seat-${seatNum}`);
  if (!seatEl) return;

  if (selectedSeats.includes(seatNum)) {
    selectedSeats = selectedSeats.filter(s => s !== seatNum);
    seatEl.className = 'seat avail';
  } else {
    if (selectedSeats.length >= 4) {
      alert('You can select up to 4 seats at once.');
      return;
    }
    selectedSeats.push(seatNum);
    seatEl.className = 'seat selected';
  }
  updateSeatFooter();
}

function updateSeatFooter() {
  const count = selectedSeats.length;
  const total = count * currentTicketPrice;
  if (document.getElementById('selectedSeatsText'))
    document.getElementById('selectedSeatsText').innerText = count > 0 ? `Seats ${selectedSeats.join(', ')}` : 'None selected';
  if (document.getElementById('selectedCountText'))
    document.getElementById('selectedCountText').innerText = ` · ${count} seat${count !== 1 ? 's' : ''}`;
  if (document.getElementById('totalPriceText'))
    document.getElementById('totalPriceText').innerText = `₱ ${total.toLocaleString()}`;
}

// ════════════════════════════════════════════════════════
//   BOOKING FORM
// ════════════════════════════════════════════════════════
function showBookingForm() {
  if (selectedSeats.length === 0) {
    alert('Please select at least one seat to continue.');
    return;
  }

  const origin = document.getElementById('seatOrigin').innerText;
  const dest   = document.getElementById('seatDest').innerText;
  const total  = selectedSeats.length * currentTicketPrice;

  document.getElementById('formRoute').innerText      = `${origin} → ${dest}`;
  document.getElementById('formBusInfo').innerText    = `${currentBusName} · Seats: ${selectedSeats.join(', ')}`;
  document.getElementById('formTotalPrice').innerText = `₱ ${total.toLocaleString()}`;
  document.getElementById('formSeatCount').innerText  = `${selectedSeats.length} seat${selectedSeats.length !== 1 ? 's' : ''}`;

  // Dynamically build one passenger form per seat
  const container = document.getElementById('passengerFieldsContainer');
  container.innerHTML = '';
  selectedSeats.forEach((seat, index) => {
    container.innerHTML += `
      <div class="passenger-block">
        <div class="passenger-title">Passenger ${index + 1} — Seat ${seat}</div>
        <div class="form-row">
          <label>Full Name</label>
          <input type="text" class="finput" placeholder="Enter full name" id="passName_${index}" required>
        </div>
        <div class="form-row">
          <label>Age</label>
          <div style="display:flex;gap:8px;">
            <input type="number" class="finput" style="flex:1;" placeholder="Age" id="passAge_${index}" min="1" max="120">
            <select class="finput" style="flex:1.5;" id="passGender_${index}">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>
      ${index < selectedSeats.length - 1 ? '<div class="divider"></div>' : ''}
    `;
  });

  // Pre-fill email from session
  sb.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      document.getElementById('contactEmail').value = data.session.user.email;
    }
  });

  document.getElementById('seatScreen').style.display        = 'none';
  document.getElementById('bookingFormScreen').style.display = 'block';
}

// ════════════════════════════════════════════════════════
//   CONFIRM & PAY
// ════════════════════════════════════════════════════════
async function confirmAndPay() {
  const totalPrice = selectedSeats.length * currentTicketPrice;
  const mobile     = document.getElementById('contactMobile').value.trim();
  const email      = document.getElementById('contactEmail').value.trim();

  if (!mobile) { alert('Please enter your mobile number.'); return; }
  if (!email)  { alert('Please enter your contact email.');  return; }

  const btn = document.querySelector('.book-btn');
  const originalText = btn.innerText;
  btn.innerHTML = '<span class="spinner"></span>Processing Payment…';
  btn.disabled  = true;

  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) throw new Error('Session expired. Please log in again.');
    const userId = session.user.id;

    // ── Wallet check & deduct ──────────────────────────
    let { data: wallet } = await sb
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (!wallet) {
      // Create wallet with ₱5,000 starting balance for new users
      const { data: newWallet } = await sb
        .from('wallets')
        .insert([{ user_id: userId, balance: 5000 }])
        .select()
        .single();
      wallet = newWallet;
    }

    if (wallet.balance < totalPrice) {
      throw new Error(`Insufficient wallet balance. You have ₱${wallet.balance.toLocaleString()} but need ₱${totalPrice.toLocaleString()}.`);
    }

    // Deduct from wallet
    await sb
      .from('wallets')
      .update({ balance: wallet.balance - totalPrice })
      .eq('user_id', userId);

    // ── Build booking records ──────────────────────────
    const bookingsToInsert = selectedSeats.map((seatNum, index) => {
      const name   = document.getElementById(`passName_${index}`)?.value.trim() || 'N/A';
      const age    = parseInt(document.getElementById(`passAge_${index}`)?.value) || null;
      const gender = document.getElementById(`passGender_${index}`)?.value || 'N/A';
      return {
        schedule_id:      currentScheduleId,
        user_id:          userId,
        seat_number:      seatNum,
        passenger_name:   name,
        passenger_age:    age,
        passenger_gender: gender,
        status:           'Confirmed',
        contact_mobile:   mobile,
        contact_email:    email,
        price:            currentTicketPrice
      };
    });

    const { error: bookingError } = await sb.from('bookings').insert(bookingsToInsert);
    if (bookingError) throw bookingError;

    // ── Success ────────────────────────────────────────
    const passengerNames = bookingsToInsert.map(b => b.passenger_name).join(', ');
    alert(`✅ Booking confirmed!\n\n${selectedSeats.length} seat(s) booked for ${passengerNames}.\n₱${totalPrice.toLocaleString()} deducted from wallet.\n\nYour ticket is now in My Tickets.`);

    // Reset state
    selectedSeats      = [];
    currentScheduleId  = null;
    currentTicketPrice = 0;

    document.getElementById('bookingFormScreen').style.display = 'none';
    switchTab('tickets');

  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled  = false;
  }
}

// ════════════════════════════════════════════════════════
//   MY TICKETS
// ════════════════════════════════════════════════════════
async function loadMyTickets() {
  const listEl = document.getElementById('myTicketsList');
  listEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text3);">Loading tickets...</div>';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Fetch the user's bookings
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        seat_number,
        status,
        created_at,
        schedules (
          id,
          departure_time,
          arrival_time,
          buses ( operator_name ),
          origin:origin_id ( name ),
          destination:destination_id ( name )
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text3);">No tickets found. Time to book a trip!</div>';
      return;
    }

    // ── SMART GROUPING: Combine multiple seats for the same trip into ONE card! ──
    const groupedTrips = {};
    bookings.forEach(b => {
      const scheduleId = b.schedules.id;
      if (!groupedTrips[scheduleId]) {
        groupedTrips[scheduleId] = {
          scheduleId: scheduleId,
          status: b.status,
          created_at: b.created_at,
          schedules: b.schedules,
          seats: [] // Create an empty array for the seats
        };
      }
      groupedTrips[scheduleId].seats.push(b.seat_number); // Add the seat to the group
    });

    // Convert the grouped object back into an array to draw the HTML
    const tripsArray = Object.values(groupedTrips);

    // Draw the new grouped ticket cards
    listEl.innerHTML = tripsArray.map(trip => {
      const origin = trip.schedules?.origin?.name || "Unknown";
      const dest = trip.schedules?.destination?.name || "Unknown";
      const operator = trip.schedules?.buses?.operator_name || "GoRoute";
      
      const depTime = trip.schedules?.departure_time ? new Date(trip.schedules.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
      const arrTime = trip.schedules?.arrival_time ? new Date(trip.schedules.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
      const displayDate = new Date(trip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      let badgeClass = 'status-confirmed';
      if (trip.status.toLowerCase() === 'upcoming') badgeClass = 'status-upcoming';
      if (trip.status.toLowerCase() === 'completed') badgeClass = 'status-completed';

      // Join the seats together (e.g., "1A, 1B, 2C")
      const seatString = trip.seats.join(', ');
      const seatCountText = trip.seats.length === 1 ? '1 Seat' : `${trip.seats.length} Seats`;

      return `
      <div class="ticket-card" style="cursor: pointer;" onclick="openQR('${trip.scheduleId}', '${origin} → ${dest}', '${displayDate} · ${depTime}', '${seatString}')">
        
        <div class="ticket-left">
          <div class="ticket-no">PHB/Ticket No: ${trip.scheduleId.substring(0,8).toUpperCase()}</div>
          <div class="ticket-route">${origin} <span class="arrow">→</span> ${dest}</div>
          <div class="ticket-time">${depTime} <span class="arrow">→</span> ${arrTime}</div>
          <div class="ticket-meta-info">${operator} · ${seatCountText}</div>
        </div>
        
        <div class="ticket-right">
          <div class="status-badge ${badgeClass}">${trip.status}</div>
          <div class="ticket-date">${displayDate}</div>
        </div>
        
      </div>
      `}).join('');

  } catch (err) {
    listEl.innerHTML = `<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--accent);">Error: ${err.message}</div>`;
  }
}

// ── QR Code Logic ──
let qrcodeObj = null; // Store the QR code so we can clear it later

function openQR(scheduleId, route, dateTime, seats) {
  // 1. Fill in the popup text
  document.getElementById('qrRoute').innerText = route;
  document.getElementById('qrDate').innerText = dateTime;
  document.getElementById('qrSeats').innerText = `Seats: ${seats}`;

  // 2. Clear out any old QR code image
  const qrContainer = document.getElementById('qrcode-container');
  qrContainer.innerHTML = ''; 

  // 3. Create the data payload for the scanner (Schedule ID and Seats)
  const qrDataPayload = JSON.stringify({ 
    app: "GoRoute",
    schedule: scheduleId,
    seats: seats 
  });

  // 4. Generate the new QR Code
  qrcodeObj = new QRCode(qrContainer, {
    text: qrDataPayload,
    width: 160,
    height: 160,
    colorDark : "#1A6FB0", // Draw it in GoRoute Blue!
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });

  // 5. Show the popup
  document.getElementById('qrModal').style.display = 'flex';
}

function closeQR() {
  document.getElementById('qrModal').style.display = 'none';
}

// ════════════════════════════════════════════════════════
//   WALLET
// ════════════════════════════════════════════════════════
async function loadWallet() {
  const screen = document.getElementById('walletScreen');
  
  // Show loading state while fetching the real balance
  screen.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text3);">Loading wallet securely...</div>';

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  // Fetch the actual real balance from Supabase!
  let { data: wallet } = await sb.from('wallets').select('*').eq('user_id', userId).single();

  // If new user, create a wallet with ₱5,000
  if (!wallet) {
    const { data: newWallet } = await sb.from('wallets').insert([{ user_id: userId, balance: 5000 }]).select().single();
    wallet = newWallet;
  }

  // Inject the beautiful new UI
  screen.innerHTML = `
    <!-- Top Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <h2 style="color: var(--blue-dark); font-size: 18px;">My Wallet</h2>
      <div style="width: 32px; height: 32px; background: #EBF5FD; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--blue-dark);">👤</div>
    </div>

    <!-- Blue Balance Card -->
    <div class="wallet-card">
      <div class="wallet-title">Wallet Balance</div>
      <div class="wallet-amount">₱ ${wallet.balance.toLocaleString()}</div>
      <button class="add-money-btn" onclick="alert('Payment gateway integration coming soon!')">+ Add Money</button>
    </div>

    <!-- Passbook List (Placeholder Data) -->
    <div class="passbook-container">
      <div class="passbook-header">Passbook</div>
      
      <div class="transaction-row">
        <div>
          <div class="tx-title">Added money to wallet</div>
          <div class="tx-date">18 Jan 2025 · 08:40 AM</div>
        </div>
        <div class="tx-amt tx-plus">+ ₱ 600</div>
      </div>

      <div class="transaction-row">
        <div>
          <div class="tx-title">Bus ticket — Cebu to Manila</div>
          <div class="tx-date">12 Jan 2025 · 02:15 PM</div>
        </div>
        <div class="tx-amt tx-minus">- ₱ 600</div>
      </div>

      <div class="transaction-row">
        <div>
          <div class="tx-title">Cashback earned</div>
          <div class="tx-date">03 Jan 2025 · 11:06 AM</div>
        </div>
        <div class="tx-amt tx-plus">+ ₱ 400</div>
      </div>
      
      <div class="transaction-row">
        <div>
          <div class="tx-title">Added money to wallet</div>
          <div class="tx-date">01 Jan 2025 · 09:00 AM</div>
        </div>
        <div class="tx-amt tx-plus">+ ₱ 100</div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════
//   ACCOUNT
// ════════════════════════════════════════════════════════
async function loadAccount() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const emailEl = document.getElementById('accountEmailText');
    if (emailEl) {
      const name  = session.user.user_metadata?.full_name || '';
      emailEl.innerHTML = name
        ? `<strong style="color:var(--blue-dark);display:block;font-size:16px;margin-bottom:4px;">${name}</strong>${session.user.email}`
        : session.user.email;
    }
  } catch (err) {
    console.error(err);
  }
}

// ════════════════════════════════════════════════════════
//   ADMIN
// ════════════════════════════════════════════════════════
async function loadAdminData() {
  const container = document.getElementById('adminBookingsList');
  if (!container) return;
  container.innerText = 'Loading data…';

  try {
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        seat_number,
        passenger_name,
        passenger_age,
        passenger_gender,
        status,
        price,
        created_at,
        schedules (
          departure_time,
          buses ( operator_name ),
          origin:origin_id ( name ),
          destination:destination_id ( name )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = '<p style="padding:20px;color:var(--text2);">No bookings have been made yet.</p>';
      return;
    }

    let html = `
      <table style="width:100%;text-align:left;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid #eee;color:var(--text2);">
            <th style="padding:10px 8px;">Ticket ID</th>
            <th style="padding:10px 8px;">Seat</th>
            <th style="padding:10px 8px;">Passenger</th>
            <th style="padding:10px 8px;">Route</th>
            <th style="padding:10px 8px;">Bus</th>
            <th style="padding:10px 8px;">Departure</th>
            <th style="padding:10px 8px;">Price</th>
            <th style="padding:10px 8px;">Status</th>
            <th style="padding:10px 8px;">Date</th>
          </tr>
        </thead>
        <tbody>`;

    bookings.forEach(b => {
      const s       = b.schedules;
      const route   = `${s?.origin?.name || '?'} → ${s?.destination?.name || '?'}`;
      const busName = s?.buses?.operator_name || '—';
      const dep     = s?.departure_time
        ? new Date(s.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';
      const date    = new Date(b.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
      const statusColor = b.status === 'Confirmed' ? 'var(--blue-light)' : '#FFF0F0';
      const statusText  = b.status === 'Confirmed' ? 'var(--blue-dark)' : 'var(--accent)';

      html += `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 8px;color:var(--text3);font-size:11px;">${b.id.substring(0, 8).toUpperCase()}</td>
          <td style="padding:10px 8px;font-weight:700;color:var(--blue);">${b.seat_number}</td>
          <td style="padding:10px 8px;">${b.passenger_name || 'N/A'}${b.passenger_age ? ', ' + b.passenger_age : ''}${b.passenger_gender ? ' (' + b.passenger_gender + ')' : ''}</td>
          <td style="padding:10px 8px;font-size:12px;">${route}</td>
          <td style="padding:10px 8px;font-size:12px;">${busName}</td>
          <td style="padding:10px 8px;font-size:12px;">${dep}</td>
          <td style="padding:10px 8px;font-weight:700;">₱ ${Number(b.price || 0).toLocaleString()}</td>
          <td style="padding:10px 8px;">
            <span style="background:${statusColor};color:${statusText};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">${b.status}</span>
          </td>
          <td style="padding:10px 8px;font-size:11px;color:var(--text3);">${date}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:red;padding:20px;">Error: ${err.message}</p>`;
  }
}

async function adminLogout() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}
