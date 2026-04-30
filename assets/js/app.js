// ── Supabase init ──
// Replace with your actual keys from supabase.com → Project Settings → API
const SUPABASE_URL = 'https://djyegteotxpiqsycpwuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVndGVvdHhwaXFzeWNwd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjE0NTMsImV4cCI6MjA5MzAzNzQ1M30.OFRtRheiZBlZ-3twI2o9vjakeETjacrZVJQhEygwZHc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirect if already logged in
// ── Authentication Routing ──
sb.auth.getSession().then(({ data }) => {
  const currentPage = window.location.pathname;
  
  // If user IS logged in, but they are looking at the login page
  if (data.session && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } 
  // If user is NOT logged in, but trying to view the main app
  else if (!data.session && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

// Listen for live login/logout events (like clicking Google/Facebook)
sb.auth.onAuthStateChange((event, session) => {
  const currentPage = window.location.pathname;
  if (event === 'SIGNED_IN' && currentPage.includes('auth.html')) {
    window.location.href = 'index.html';
  } else if (event === 'SIGNED_OUT' && !currentPage.includes('auth.html')) {
    window.location.href = 'auth.html';
  }
});

// ── Tab switch ──
function switchTab(tab) {
  hideAlert();
  document.getElementById('loginForm').style.display   = tab === 'login'  ? '' : 'none';
  document.getElementById('signupForm').style.display  = tab === 'signup' ? '' : 'none';
  document.getElementById('otpPanel').classList.remove('show');
  document.getElementById('socialSection').style.display = '';
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('signupTab').classList.toggle('active', tab === 'signup');
  document.getElementById('switchText').innerHTML = tab === 'login'
    ? 'Don\'t have an account? <a href="#" onclick="switchTab(\'signup\');return false;">Create one</a>'
    : 'Already have an account? <a href="#" onclick="switchTab(\'login\');return false;">Sign in</a>';
}

// ── Alert ──
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className = `alert ${type} show`;
}
function hideAlert() {
  document.getElementById('alertBox').className = 'alert';
}

// ── Toggle password ──
function togglePw(id, btn) {
  const input = document.getElementById(id);
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
    window.location.href = 'index.html';
  }
}

// ── Signup ──
async function handleSignup(e) {
  e.preventDefault();
  hideAlert();
  const btn = document.getElementById('signupBtn');
  btn.innerHTML = '<span class="spinner"></span>Creating account…';
  btn.disabled = true;
  const first  = document.getElementById('firstName').value.trim();
  const last   = document.getElementById('lastName').value.trim();
  const email  = document.getElementById('signupEmail').value.trim();
  const phone  = document.getElementById('signupPhone').value.trim();
  const pw     = document.getElementById('signupPassword').value;
  const { error } = await sb.auth.signUp({
    email, password: pw,
    options: { data: { full_name: `${first} ${last}`, phone } }
  });
  if (error) {
    showAlert(error.message);
    btn.innerHTML = 'Create Account';
    btn.disabled = false;
  } else {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('socialSection').style.display = 'none';
    document.getElementById('otpPanel').classList.add('show');
    document.getElementById('otpEmail').textContent = email;
    showAlert('Check your email for a confirmation link!', 'success');
  }
}

// ── OTP input auto-advance ──
const otpBoxes = document.querySelectorAll('.otp-box');
function otpInput(el, idx) {
  if (el.value && idx < 5) otpBoxes[idx + 1].focus();
  if (!el.value && idx > 0) otpBoxes[idx - 1].focus();
}

async function verifyOtp() {
  const code  = [...otpBoxes].map(b => b.value).join('');
  const email = document.getElementById('otpEmail').textContent;
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) { showAlert(error.message); }
  else { window.location.href = 'index.html'; }
}

async function resendOtp() {
  const email = document.getElementById('otpEmail').textContent;
  await sb.auth.resend({ type: 'signup', email });
  showAlert('Code resent! Check your email.', 'success');
}

// ── Forgot password ──
async function showForgot() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showAlert('Enter your email above first, then click Forgot password.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth.html'
  });
  if (error) showAlert(error.message);
  else showAlert('Password reset link sent! Check your email.', 'success');
}

// ── Social auth ──
async function handleGoogle() {
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/index.html' } });
}
async function handleFacebook() {
  await sb.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: window.location.origin + '/index.html' } });
}

// ── Bus Search & Database Query ──
async function searchBuses() {
  const btn = document.querySelector('.search-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Searching...';
  btn.disabled = true;

  try {
    // 1. Fetch schedules from Supabase, joining the buses and locations tables
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

    // 2. Hide search screen, show results screen
    document.getElementById('searchScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';

    // 3. Render the results
    const container = document.getElementById('busResultsList');
    container.innerHTML = ''; 

    if (schedules.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text2);">No buses found.</div>';
      return;
    }

    schedules.forEach(schedule => {
      // Format timestamps into readable times (e.g., 6:00 PM)
      const depDate = new Date(schedule.departure_time);
      const arrDate = new Date(schedule.arrival_time);
      const depTime = depDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const arrTime = arrDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      // Calculate travel duration
      const diffMs = arrDate - depDate;
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.round(((diffMs % 3600000) / 60000));
      const durationStr = `${diffHrs}h ${diffMins}m`;

      // Build the HTML card
      const card = `
        <div class="bus-card" style="cursor:pointer;" onclick="openSeatSelection('${schedule.id}', ${schedule.price}, '${schedule.origin.name}', '${schedule.destination.name}', '${durationStr}')">
          <div class="bus-name">${schedule.buses.operator_name}</div>
          <div class="bus-type">${schedule.buses.bus_type} · ${durationStr}</div>
          <div class="bus-row">
            <div class="time-block"><div class="time">${depTime}</div><div class="place">${schedule.origin.name}</div></div>
            <div class="duration">─── ${durationStr} ───</div>
            <div class="time-block" style="text-align:right"><div class="time">${arrTime}</div><div class="place">${schedule.destination.name}</div></div>
          </div>
          <div class="bus-row" style="margin-top:6px">
            <div class="seats-left">${schedule.buses.total_seats} seats total</div>
            <div class="price">₱ ${schedule.price}</div>
          </div>
        </div>
      `;
      container.innerHTML += card;
    });

  } catch (err) {
    alert("Error fetching buses: " + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// ── Seat Selection Logic ──
let currentScheduleId = null;
let currentTicketPrice = 0;
let selectedSeats = [];

async function openSeatSelection(scheduleId, price, origin, dest, duration) {
  currentScheduleId = scheduleId;
  currentTicketPrice = price;
  selectedSeats = [];

  // 1. Update UI headers
  document.getElementById('seatOrigin').innerText = origin;
  document.getElementById('seatDest').innerText = dest;
  document.getElementById('seatPriceBadge').innerText = `₱ ${price} · ${duration}`;
  updateSeatFooter();

  // 2. Fetch already booked seats from Supabase
  const { data: bookings, error } = await sb
    .from('bookings')
    .select('seat_number')
    .eq('schedule_id', scheduleId);

  // Create an array of strings like ['1A', '3C']
  const bookedSeatNumbers = bookings ? bookings.map(b => b.seat_number) : [];

  // 3. Generate Grid (20 seats in a 2+2 layout)
  const grid = document.getElementById('seatGrid');
  grid.innerHTML = '';
  
  const rows = 5;
  const cols = ['A', 'B', 'C', 'D']; // A&B left, C&D right

  for (let r = 1; r <= rows; r++) {
    cols.forEach(c => {
      const seatNum = `${r}${c}`;
      const isBooked = bookedSeatNumbers.includes(seatNum);

      if (isBooked) {
        grid.innerHTML += `<div class="seat booked">${seatNum}</div>`;
      } else {
        grid.innerHTML += `<div class="seat avail" id="seat-${seatNum}" onclick="toggleSeat('${seatNum}')">${seatNum}</div>`;
      }
      
      // Add aisle space after column B
      if (c === 'B') grid.innerHTML += `<div class="aisle"></div>`;
    });
  }

  // 4. Switch screens
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('seatScreen').style.display = 'block';
}

function toggleSeat(seatNum) {
  const seatEl = document.getElementById(`seat-${seatNum}`);

  if (selectedSeats.includes(seatNum)) {
    // Deselect
    selectedSeats = selectedSeats.filter(s => s !== seatNum);
    seatEl.classList.remove('selected', 'avail'); // clean up classes
    seatEl.classList.add('avail');
  } else {
    // Select (Max 4 tickets at a time)
    if (selectedSeats.length >= 4) {
      alert("You can only book up to 4 seats at once.");
      return;
    }
    selectedSeats.push(seatNum);
    seatEl.classList.remove('avail', 'selected');
    seatEl.classList.add('selected');
  }
  updateSeatFooter();
}

function updateSeatFooter() {
  document.getElementById('selectedSeatsText').innerText = selectedSeats.length > 0 ? `Seats ${selectedSeats.join(', ')}` : 'None';
  document.getElementById('selectedCountText').innerText = ` · ${selectedSeats.length} seats`;
  document.getElementById('totalPriceText').innerText = `₱ ${selectedSeats.length * currentTicketPrice}`;
}

async function proceedToBooking() {
  if (selectedSeats.length === 0) {
    alert("Please select at least one seat to continue.");
    return;
  }

  const totalPrice = selectedSeats.length * currentTicketPrice;

  // Change button text so the user knows it's loading
  const btn = document.querySelector('.proceed-btn');
  const originalText = btn.innerText;
  btn.innerText = "Processing Payment...";
  btn.disabled = true;

  try {
    // 1. Get the currently logged-in user
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    
    if (sessionError || !session) {
      alert("Session expired. Please log in again.");
      window.location.href = 'auth.html';
      return;
    }
    
    const userId = session.user.id;

    // 2. Check Wallet Balance
    let { data: wallet, error: walletError } = await sb
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    // If the wallet doesn't exist yet, create it on the fly with ₱5,000!
    if (!wallet) {
      const { data: newWallet, error: createError } = await sb
        .from('wallets')
        .insert([{ user_id: userId, balance: 5000 }])
        .select()
        .single();
        
      if (createError) throw createError;
      wallet = newWallet; // Use the newly created wallet for the rest of the transaction
    }

    // 3. Reject if they don't have enough money
    if (wallet.balance < totalPrice) {
      alert(`Insufficient funds! Your balance is ₱${wallet.balance.toLocaleString()}, but this trip costs ₱${totalPrice.toLocaleString()}.`);
      return;
    }

    // 4. Deduct the money from the wallet!
    const newBalance = wallet.balance - totalPrice;
    const { error: updateError } = await sb
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // 5. Insert the booked seats into the database
    const bookingsToInsert = selectedSeats.map(seatNum => ({
      schedule_id: currentScheduleId,
      user_id: userId,
      seat_number: seatNum,
      status: 'Confirmed'
    }));

    const { error: bookingError } = await sb.from('bookings').insert(bookingsToInsert);
    if (bookingError) throw bookingError;

    // 6. Success! 
    alert(`Success! You booked seats: ${selectedSeats.join(', ')}.\n\n₱${totalPrice.toLocaleString()} has been deducted from your wallet!`);
    
    // Send the user back to the home screen
    document.getElementById('seatScreen').style.display = 'none';
    document.getElementById('searchScreen').style.display = 'block';
    
  } catch (err) {
    alert("Error booking seats: " + err.message);
  } finally {
    // Reset the button
    btn.innerText = originalText;
    btn.disabled = false;
  }
}
// ── Navigation & Tickets Logic ──

function switchTab(tab) {
  // Hide all screens
  document.getElementById('searchScreen').style.display = 'none';
  if(document.getElementById('resultsScreen')) document.getElementById('resultsScreen').style.display = 'none';
  if(document.getElementById('seatScreen')) document.getElementById('seatScreen').style.display = 'none';
  if(document.getElementById('ticketsScreen')) document.getElementById('ticketsScreen').style.display = 'none';
  if(document.getElementById('walletScreen')) document.getElementById('walletScreen').style.display = 'none';

  // Reset nav icons
  document.getElementById('nav-home').classList.remove('active');
  document.getElementById('nav-tickets').classList.remove('active');
  document.getElementById('nav-wallet').classList.remove('active');

  // Show selected tab
  if (tab === 'home') {
    document.getElementById('searchScreen').style.display = 'block';
    document.getElementById('nav-home').classList.add('active');
  } else if (tab === 'tickets') {
    document.getElementById('ticketsScreen').style.display = 'block';
    document.getElementById('nav-tickets').classList.add('active');
    loadMyTickets();
  } else if (tab === 'wallet') {
    document.getElementById('walletScreen').style.display = 'block';
    document.getElementById('nav-wallet').classList.add('active');
    loadWallet(); // Fetch balance!
  }
}

async function loadMyTickets() {
  const listEl = document.getElementById('myTicketsList');
  listEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text3);">Loading tickets...</div>';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Fetch the user's bookings from Supabase
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        seat_number,
        status,
        created_at
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text3);">No tickets found. Time to book a trip!</div>';
      return;
    }

    // Draw the ticket cards
    listEl.innerHTML = bookings.map(b => `
      <div class="ticket-card">
        <div class="ticket-no">Ticket ID: ${b.id.substring(0,8).toUpperCase()}</div>
        <div class="ticket-route">
          <span class="city">Booked Seat</span>
          <div class="arrow-right" style="transform:scale(.7)"></div>
          <span class="city">${b.seat_number}</span>
        </div>
        <div class="ticket-meta">
          <div>
            <div style="font-weight:700;font-size:11px;">Status: ${b.status}</div>
          </div>
          <div style="text-align:right">
            <div class="ticket-status">Confirmed</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">
              ${new Date(b.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--accent);">Error loading tickets. Check console.</div>';
  }
}

async function loadWallet() {
  const balanceText = document.getElementById('liveWalletBalance');
  balanceText.innerText = "Loading...";

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  // Check if wallet exists
  let { data: wallet, error } = await sb.from('wallets').select('*').eq('user_id', userId).single();

  // If new user, create a wallet with ₱5,000
  if (!wallet) {
    const { data: newWallet } = await sb.from('wallets').insert([{ user_id: userId, balance: 5000 }]).select().single();
    wallet = newWallet;
  }

  balanceText.innerText = `₱ ${wallet.balance.toLocaleString()}`;
}