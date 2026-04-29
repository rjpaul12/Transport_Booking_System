// ── Supabase init ──
// Replace with your actual keys from supabase.com → Project Settings → API
const SUPABASE_URL = 'https://djyegteotxpiqsycpwuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVndGVvdHhwaXFzeWNwd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjE0NTMsImV4cCI6MjA5MzAzNzQ1M30.OFRtRheiZBlZ-3twI2o9vjakeETjacrZVJQhEygwZHc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirect if already logged in
sb.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'index.html';
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