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

// ── Auth Routing ───────────────────────────────────────
sb.auth.getSession().then(({ data }) => {
  const currentPage = window.location.pathname;
  if (data.session && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } else if (!data.session && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

sb.auth.onAuthStateChange((event, session) => {
  const currentPage = window.location.pathname;
  if (event === 'SIGNED_IN' && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } else if (event === 'SIGNED_OUT' && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

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

// ════════════════════════════════════════════════════════
//   BUS SEARCH
// ════════════════════════════════════════════════════════
async function searchBuses() {
  const btn = document.querySelector('.search-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>Searching…';
  btn.disabled = true;

  try {
    // Fetch schedules joined with buses + location names
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
      `);

    if (error) throw error;

    document.getElementById('searchScreen').style.display  = 'none';
    document.getElementById('resultsScreen').style.display = 'block';

    const container = document.getElementById('busResultsList');
    container.innerHTML = '';

    if (!schedules || schedules.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:28px;margin-bottom:10px;">🔍</div>
          <div style="font-size:13px;font-weight:700;color:var(--blue-dark);margin-bottom:4px;">No buses found</div>
          <div style="font-size:12px;color:var(--text3);">Try a different route or date.</div>
        </div>`;
      return;
    }

    schedules.forEach((schedule, i) => {
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
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text3);">Loading tickets…</div>';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Fetch bookings and join with schedule → bus + location names
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        seat_number,
        passenger_name,
        passenger_age,
        status,
        price,
        created_at,
        schedules (
          departure_time,
          arrival_time,
          buses ( operator_name, bus_type ),
          origin:origin_id ( name ),
          destination:destination_id ( name )
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:32px;margin-bottom:10px;">🎫</div>
          <div style="font-size:13px;font-weight:700;color:var(--blue-dark);margin-bottom:6px;">No tickets yet</div>
          <div style="font-size:12px;color:var(--text3);">Book your first trip to see your tickets here!</div>
        </div>`;
      return;
    }

    const statusStyle = {
      confirmed: { bg: 'var(--blue-light)',  color: 'var(--blue-dark)' },
      Confirmed: { bg: 'var(--blue-light)',  color: 'var(--blue-dark)' },
      pending:   { bg: '#FFF4E5',            color: '#E67E00'          },
      cancelled: { bg: '#F5F5F5',            color: '#999'             },
      Cancelled: { bg: '#F5F5F5',            color: '#999'             },
    };

    listEl.innerHTML = bookings.map(b => {
      const s       = b.schedules;
      const origin  = s?.origin?.name || '—';
      const dest    = s?.destination?.name || '—';
      const busName = s?.buses?.operator_name || '—';
      const busType = s?.buses?.bus_type || '';
      const depTime = s?.departure_time
        ? new Date(s.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';
      const date    = new Date(b.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
      const sc      = statusStyle[b.status] || statusStyle.confirmed;

      return `
        <div class="ticket-card">
          <div class="ticket-no">Ticket #${b.id.substring(0, 8).toUpperCase()}</div>
          <div class="ticket-route">
            <span class="city">${origin}</span>
            <span style="margin:0 5px;color:var(--blue);font-weight:700;">→</span>
            <span class="city">${dest}</span>
          </div>
          <div class="ticket-meta">
            <div>
              <div style="font-weight:700;font-size:11px;">${depTime} · Seat ${b.seat_number}</div>
              <div style="font-size:10px;color:var(--text3);">${busName}${busType ? ' · ' + busType : ''}</div>
              <div style="font-size:10px;color:var(--text2);margin-top:2px;">👤 ${b.passenger_name}${b.passenger_age ? ', ' + b.passenger_age + ' yrs' : ''}</div>
            </div>
            <div style="text-align:right">
              <span class="ticket-status" style="background:${sc.bg};color:${sc.color};">${b.status}</span>
              <div style="font-size:10px;color:var(--text3);margin-top:4px;">${date}</div>
              <div style="font-size:12px;font-weight:800;color:var(--accent);margin-top:2px;">₱ ${Number(b.price || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div style="text-align:center;padding:20px;font-size:12px;color:var(--accent);">Error loading tickets: ${err.message}</div>`;
  }
}

// ════════════════════════════════════════════════════════
//   WALLET
// ════════════════════════════════════════════════════════
async function loadWallet() {
  const balanceEl = document.getElementById('liveWalletBalance');
  if (!balanceEl) return;
  balanceEl.innerText = 'Loading…';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    let { data: wallet } = await sb
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Auto-create wallet with ₱5,000 starter if new user
    if (!wallet) {
      const { data: newWallet } = await sb
        .from('wallets')
        .insert([{ user_id: userId, balance: 5000 }])
        .select()
        .single();
      wallet = newWallet;
    }

    balanceEl.innerText = `₱ ${Number(wallet.balance).toLocaleString()}`;

    // ── Passbook: last 10 bookings as transactions ──
    const { data: txns } = await sb
      .from('bookings')
      .select('id, seat_number, price, status, created_at, schedules(origin:origin_id(name), destination:destination_id(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const passbook = document.querySelector('.passbook');
    if (passbook && txns && txns.length > 0) {
      const rows = txns.map(t => {
        const origin = t.schedules?.origin?.name || 'Booking';
        const dest   = t.schedules?.destination?.name || '';
        const date   = new Date(t.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
        const time   = new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="txn-row">
            <div>
              <div class="txn-desc">Ticket — ${origin}${dest ? ' → ' + dest : ''}</div>
              <div class="txn-date">${date} · ${time}</div>
            </div>
            <div class="txn-amt debit">− ₱ ${Number(t.price || 0).toLocaleString()}</div>
          </div>`;
      }).join('');

      passbook.innerHTML = `
        <div class="passbook-title">Passbook</div>
        ${rows}
      `;
    } else if (passbook) {
      passbook.innerHTML = `
        <div class="passbook-title">Passbook</div>
        <div style="text-align:center;padding:20px;font-size:12px;color:var(--text3);">No transactions yet.</div>
      `;
    }

  } catch (err) {
    console.error(err);
    if (balanceEl) balanceEl.innerText = 'Error';
  }
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