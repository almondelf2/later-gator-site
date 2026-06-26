/*
 * Later Gator marketing site — script.js
 *
 * Loaded on every page via src/partials/end.html. No bundler/build step for
 * this file (unlike the HTML, which is assembled by build.py) — it's plain,
 * unscoped global functions, which keeps the no-tooling setup simple but means
 * every function/variable here lives on the global scope. Fine for a small
 * single-file site with no other scripts; worth revisiting with a module
 * pattern or an IIFE wrapper if this file grows much larger or a second
 * script is ever added.
 *
 * STORAGE / LOGGING OVERVIEW
 * There are two parallel, independent persistence paths, used for different
 * purposes:
 *   1. window.storage (safeGet/safeSet) — the in-page key/value store used to
 *      drive the LIVE UI: the footer's "N people have raised a paw" counter
 *      and the per-feature vote counts/selected-state on the Roadmap page.
 *      This is what the page reads back to render itself.
 *   2. Google Sheets via Apps Script Web App (logToSheet / logVoteToSheet) —
 *      a fire-and-forget durable record of every interest signup and vote,
 *      for Raymond to review later. The page never reads this back; it's
 *      write-only from the client's perspective.
 * Both are written on the same user actions (submitInterest, castFeatureVote)
 * so they should normally stay in agreement, but they are NOT kept in sync
 * with each other programmatically — a failure in one does not roll back
 * the other (intentional: the live counter shouldn't break if Sheets is down,
 * and vice versa).
 */

  // ---------- Navigation: highlight current page in nav ----------
  function highlightCurrentNav() {
    const file = location.pathname.split('/').pop() || 'index.html';
    const pageId = file === 'index.html' ? 'home' : file.replace('.html', '');
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('current', b.dataset.nav === pageId));
  }

  function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const btn = document.querySelector('.mobile-toggle');
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  // ---------- FAQ accordion ----------
  function toggleFaq(buttonEl) {
    const item = buttonEl.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    if (isOpen) {
      item.classList.remove('open');
      buttonEl.setAttribute('aria-expanded', 'false');
      answer.style.maxHeight = '0px';
    } else {
      item.classList.add('open');
      buttonEl.setAttribute('aria-expanded', 'true');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  }

  // ---------- Feature card info-icon expand ----------
  function toggleFeatureInfo(buttonEl) {
    const card = buttonEl.closest('.feature-card');
    const desc = card.querySelector('.feature-card-desc');
    const isOpen = card.classList.contains('open');

    if (isOpen) {
      card.classList.remove('open');
      buttonEl.setAttribute('aria-expanded', 'false');
      desc.style.maxHeight = '0px';
    } else {
      card.classList.add('open');
      buttonEl.setAttribute('aria-expanded', 'true');
      desc.style.maxHeight = desc.scrollHeight + 'px';
    }
  }

  // ---------- Storage-backed interest tracking ----------
  let currentSource = '';
  let lastFocusedTrigger = null; // element to restore focus to when the interest modal closes

  // Google Sheet logging via Apps Script Web App.
  // Fire-and-forget: a failure here never blocks or errors out the person's experience.
  // NOTE: these URLs are meant to be public. Google Apps Script Web Apps deployed as
  // "anyone can access" are designed to be called directly from client-side JS like this
  // (there's no secret key to leak) — the script itself controls what it accepts/writes on
  // the server side. Do not treat these as credentials that need hiding.
  const SHEET_LOG_URL = 'https://script.google.com/macros/s/AKfycbx4iZWJU6TtNlr7Cbwx4Uz1ilgpqFqUmqzg3uak9B1m86Vyp-Hcao6eHVcst5NrZXwS/exec';
  const VOTE_LOG_URL = 'https://script.google.com/macros/s/AKfycbwZBUDnDn0YIFOkkG8BmdGFU8k7rvX6pBML2dFUME59aMVWfUUcv58vrA0rympYKSsO/exec';

  function logToSheet(entry) {
    try {
      fetch(SHEET_LOG_URL, {
        method: 'POST',
        body: JSON.stringify(entry)
      }).catch(function(e) {
        console.error('Sheet log request failed', e);
      });
    } catch (e) {
      console.error('Sheet log failed to send', e);
    }
  }

  function logVoteToSheet(entry) {
    try {
      fetch(VOTE_LOG_URL, {
        method: 'POST',
        body: JSON.stringify(entry)
      }).catch(function(e) {
        console.error('Vote log request failed', e);
      });
    } catch (e) {
      console.error('Vote log failed to send', e);
    }
  }

  async function safeGet(key, shared) {
    try {
      const res = await window.storage.get(key, shared);
      return res ? res.value : null;
    } catch (e) {
      return null;
    }
  }

  async function safeSet(key, value, shared) {
    try {
      await window.storage.set(key, value, shared);
      return true;
    } catch (e) {
      console.error('Storage set failed', e);
      return false;
    }
  }

  function openInterest(source) {
    currentSource = source || 'Unknown';
    lastFocusedTrigger = document.activeElement;
    document.getElementById('modalForm').style.display = 'block';
    document.getElementById('modalSuccess').style.display = 'none';
    document.getElementById('interestEmail').value = '';
    document.getElementById('interestModal').classList.add('open');
    document.getElementById('interestEmail').focus();
  }

  function closeInterest() {
    document.getElementById('interestModal').classList.remove('open');
    // Return focus to whatever opened the modal (a nav button, a CTA, etc.)
    // so keyboard users don't lose their place in the page on close.
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
    }
    lastFocusedTrigger = null;
  }

  document.getElementById('interestModal').addEventListener('click', function(e) {
    if (e.target === this) closeInterest();
  });
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('interestModal');
    if (!modal.classList.contains('open')) return;

    if (e.key === 'Escape') {
      closeInterest();
      return;
    }

    // Minimal focus trap: while the modal is open, Tab/Shift+Tab cycles only
    // through focusable elements inside the modal box, instead of escaping
    // out to the page underneath. Standard expected behavior for a dialog.
    if (e.key === 'Tab') {
      const focusable = modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const list = Array.prototype.filter.call(focusable, function(el) {
        return el.offsetParent !== null; // skip hidden elements (e.g. the success view when form is showing)
      });
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  async function submitInterest(skipEmail) {
    const emailInput = document.getElementById('interestEmail');
    const email = skipEmail ? '' : emailInput.value.trim();

    const entry = {
      email: email || null,
      source: currentSource,
      timestamp: new Date().toISOString()
    };

    try {
      const idKey = 'interest:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
      await safeSet(idKey, JSON.stringify(entry), true);
      await incrementCounter();
    } catch (e) {
      console.error('Failed to record interest', e);
    }

    logToSheet(entry);

    document.getElementById('modalForm').style.display = 'none';
    document.getElementById('modalSuccess').style.display = 'block';
    refreshCounter();

    setTimeout(() => { closeInterest(); }, 2200);
  }

  async function incrementCounter() {
    try {
      const current = await safeGet('interest-count-total', true);
      const n = current ? (parseInt(current, 10) || 0) : 0;
      await safeSet('interest-count-total', String(n + 1), true);
    } catch (e) {
      console.error('Counter increment failed', e);
    }
  }

  async function refreshCounter() {
    const el = document.getElementById('footerCounter');
    const n = await safeGet('interest-count-total', true);
    const count = n ? (parseInt(n, 10) || 0) : 0;
    el.innerHTML = '<strong>' + count + '</strong> people have raised a paw so far';
  }

  // ---------- Roadmap feature voting (4-way: love / like / later / skip) ----------
  const VOTE_OPTIONS = ['love', 'like', 'later', 'skip'];

  async function castFeatureVote(buttonEl, slug, option) {
    const card = buttonEl.closest('.feature-card');
    const allBtns = card.querySelectorAll('.vote-seg-btn');
    allBtns.forEach(b => b.disabled = true);

    try {
      const mineKey = 'vote-mine:' + slug;
      const previous = await safeGet(mineKey, false);

      if (previous === option) {
        // already selected, no-op
        allBtns.forEach(b => b.disabled = false);
        return;
      }

      // decrement previous option's shared count, if any
      if (previous) {
        const prevCountKey = 'vote-count:' + slug + ':' + previous;
        const prevCount = await safeGet(prevCountKey, true);
        const prevN = Math.max(0, (parseInt(prevCount, 10) || 0) - 1);
        await safeSet(prevCountKey, String(prevN), true);
      }

      // increment new option's shared count
      const newCountKey = 'vote-count:' + slug + ':' + option;
      const newCount = await safeGet(newCountKey, true);
      const newN = (parseInt(newCount, 10) || 0) + 1;
      await safeSet(newCountKey, String(newN), true);

      // save personal selection
      await safeSet(mineKey, option, false);

      // re-render this card's counts and selected state
      await renderFeatureVotes(card, slug);

      // log this vote event to the Roadmap Votes sheet
      const titleBtn = card.querySelector('.feature-card-title');
      let featureName = slug;
      if (titleBtn) {
        const clone = titleBtn.cloneNode(true);
        const icon = clone.querySelector('.info-icon');
        if (icon) icon.remove();
        featureName = clone.textContent.trim().replace(/\s+/g, ' ');
      }
      logVoteToSheet({
        feature: featureName,
        option: option
      });
    } catch (e) {
      console.error('Feature vote failed', e);
    }

    allBtns.forEach(b => b.disabled = false);
  }

  async function renderFeatureVotes(card, slug) {
    const mine = await safeGet('vote-mine:' + slug, false);
    for (const opt of VOTE_OPTIONS) {
      const countVal = await safeGet('vote-count:' + slug + ':' + opt, true);
      const n = parseInt(countVal, 10) || 0;
      const btn = card.querySelector('.vote-seg-btn[data-option="' + opt + '"]');
      if (!btn) continue;
      const countEl = btn.querySelector('.vote-seg-count');
      if (countEl) countEl.textContent = n;
      btn.classList.toggle('selected', mine === opt);
    }
  }

  async function loadAllFeatureVotes() {
    const cards = document.querySelectorAll('.feature-card[data-slug]');
    for (const card of cards) {
      const slug = card.getAttribute('data-slug');
      await renderFeatureVotes(card, slug);
    }
  }

// ---------- Real Later Gator logo (loaded from assets/, two color variants) ----------
  const gatorIconCache = {};

  async function loadGatorIcon(variant) {
    if (gatorIconCache[variant]) return gatorIconCache[variant];
    const file = variant === 'olive' ? 'assets/logo-olive.svg' : 'assets/logo-white.svg';
    const res = await fetch(file);
    const text = await res.text();
    // Parse as XML and pull out the <svg> element's inner markup. Using DOMParser
    // instead of a regex string-replace is more robust to incidental differences in
    // the source file (an XML declaration, a comment before <svg>, attribute order,
    // etc.) that a regex would be brittle against.
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    const inner = svgEl ? svgEl.innerHTML : '';
    gatorIconCache[variant] = inner;
    return inner;
  }

  async function mountGatorIcons() {
    const els = document.querySelectorAll('[data-gator-icon]');
    let idx = 0;
    for (const el of els) {
      const variant = el.getAttribute('data-gator-icon');
      const uid = 'gi' + idx + '_';
      idx++;
      try {
        const inner = await loadGatorIcon(variant);
        // Re-namespace the default "lg_" id prefix baked into the asset file so multiple
        // instances of the same logo on one page don't share clip-path ids.
        el.innerHTML = inner.split('lg_').join(uid);
      } catch (e) {
        console.error('Failed to load gator icon asset', e);
      }
    }
  }

  // ---------- Heat-scale hero demo animation ----------
  // Colors are read from the --heat-* custom properties defined in styles.css
  // (single source of truth) rather than duplicated here as hex literals, so
  // changing the brand heat scale in one place keeps this demo in sync.
  (function() {
    const root = getComputedStyle(document.documentElement);
    const cssVar = (name) => root.getPropertyValue(name).trim();

    const heatBlue = cssVar('--heat-blue');
    const heatGreen = cssVar('--heat-green');
    const heatYellow = cssVar('--heat-yellow');
    const heatOrange = cssVar('--heat-orange');
    const heatRed = cssVar('--heat-red');
    const heatGray = cssVar('--heat-gray');
    const parchment = cssVar('--parchment');
    const swamp = cssVar('--swamp');

    const stages = [
      { label: 'Just captured', status: 'Just captured', color: heatBlue, bg: 'rgba(59,130,196,0.14)', time: '+00:02' },
      { label: 'Call the therapist back', status: 'Fresh', color: heatGreen, bg: 'rgba(79,158,92,0.14)', time: '+02:14' },
      { label: 'Call the therapist back', status: 'Aging', color: heatYellow, bg: 'rgba(217,163,61,0.16)', time: '+11:40' },
      { label: 'Call the therapist back', status: 'Stale', color: heatOrange, bg: 'rgba(217,114,46,0.16)', time: '1d 06h' },
      { label: 'Call the therapist back', status: 'Hot', color: heatRed, bg: 'rgba(201,69,63,0.16)', time: '3d 02h' },
      { label: 'Call the therapist back', status: 'Old', color: heatGray, bg: 'rgba(107,107,102,0.18)', time: '6d 18h' },
      { label: 'Call the therapist back', status: 'Overdue', color: parchment, bg: swamp, time: '9d 04h' }
    ];
    let idx = 0;
    const card = document.getElementById('demoCard');
    const dot = document.getElementById('demoDot');
    const title = document.getElementById('demoTitle');
    const status = document.getElementById('demoStatus');
    const timer = document.getElementById('demoTimer');
    if (!card) return;

    function applyStage(s) {
      card.style.background = s.bg;
      card.style.borderColor = s.color;
      dot.style.background = s.color;
      title.textContent = s.label;
      title.style.color = parchment;
      status.textContent = s.status;
      status.style.color = s.color;
      timer.textContent = s.time;
      timer.style.color = parchment;
      timer.style.opacity = 0.75;
    }

    applyStage(stages[0]);

    setInterval(function() {
      idx = (idx + 1) % stages.length;
      applyStage(stages[idx]);
    }, 2200);
  })();

  // ---------- Init ----------
  highlightCurrentNav();
  mountGatorIcons();
  refreshCounter();
  loadAllFeatureVotes();
