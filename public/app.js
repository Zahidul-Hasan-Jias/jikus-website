const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

$('#year').textContent = new Date().getFullYear();

const menuToggle = $('#menuToggle');
const navLinks = $('#navLinks');
menuToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
$$('#navLinks a').forEach(link => link.addEventListener('click', () => {
  navLinks.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

const revealItems = $$('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach(item => observer.observe(item));
} else revealItems.forEach(item => item.classList.add('visible'));

const toast = $('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

$('#contactForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const status = $('#contactStatus');
  button.disabled = true;
  button.textContent = 'Sending…';
  status.textContent = '';
  status.classList.remove('error');
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await request('/api/contact', { method: 'POST', body: JSON.stringify(values) });
    status.textContent = result.message || 'Thanks! Your message has been received.';
    form.reset();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send message <span aria-hidden="true">↗</span>';
  }
});

const modal = $('#authModal');
const authForm = $('#authForm');
const authStatus = $('#authStatus');
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('#authEyebrow').textContent = signup ? 'JOIN JIKUS' : 'WELCOME BACK';
  $('#authTitle').textContent = signup ? 'Create your account' : 'Log in to your account';
  $('#authSubtitle').textContent = signup ? 'Create an account to get started.' : 'Good to see you again. Enter your details below.';
  $('#nameField').hidden = !signup;
  $('input[name="name"]', authForm).required = signup;
  $('input[name="password"]', authForm).autocomplete = signup ? 'new-password' : 'current-password';
  $('#authSubmit').textContent = signup ? 'Create account' : 'Log in';
  $('#switchPrompt').textContent = signup ? 'Already have an account?' : 'New to JIKUS?';
  $('#switchAuth').textContent = signup ? 'Log in' : 'Create an account';
  authStatus.textContent = '';
  authStatus.classList.remove('error');
}
function openAuth(mode) {
  setAuthMode(mode);
  modal.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => (mode === 'signup' ? $('input[name="name"]', authForm) : $('input[name="email"]', authForm)).focus(), 30);
}
function closeAuth() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}
$$('[data-open-auth]').forEach(button => button.addEventListener('click', () => openAuth(button.dataset.openAuth)));
$('#closeAuth').addEventListener('click', closeAuth);
$('#switchAuth').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
modal.addEventListener('click', event => { if (event.target === modal) closeAuth(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeAuth(); });

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#authSubmit');
  button.disabled = true;
  button.textContent = 'Please wait…';
  authStatus.textContent = '';
  authStatus.classList.remove('error');
  const values = Object.fromEntries(new FormData(authForm).entries());
  try {
    const result = await request(`/api/auth/${authMode}`, { method: 'POST', body: JSON.stringify(values) });
    closeAuth();
    authForm.reset();
    showToast(result.message || 'You are signed in.');
  } catch (error) {
    authStatus.textContent = error.message;
    authStatus.classList.add('error');
  } finally {
    button.disabled = false;
    button.textContent = authMode === 'signup' ? 'Create account' : 'Log in';
  }
});
