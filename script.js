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

  // Google Sheet logging via Apps Script Web App.
  // Fire-and-forget: a failure here never blocks or errors out the person's experience.
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
    document.getElementById('modalForm').style.display = 'block';
    document.getElementById('modalSuccess').style.display = 'none';
    document.getElementById('interestEmail').value = '';
    document.getElementById('interestModal').classList.add('open');
    document.getElementById('interestEmail').focus();
  }

  function closeInterest() {
    document.getElementById('interestModal').classList.remove('open');
  }

  document.getElementById('interestModal').addEventListener('click', function(e) {
    if (e.target === this) closeInterest();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('interestModal').classList.contains('open')) {
      closeInterest();
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
    // Extract just the inner markup (defs/g/path content) from the fetched SVG document
    const inner = text.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '');
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
  (function() {
    const stages = [
      { label: 'Just captured', status: 'Just captured', color: '#3B82C4', bg: 'rgba(59,130,196,0.14)', time: '+00:02' },
      { label: 'Call the therapist back', status: 'Fresh', color: '#4F9E5C', bg: 'rgba(79,158,92,0.14)', time: '+02:14' },
      { label: 'Call the therapist back', status: 'Aging', color: '#D9A33D', bg: 'rgba(217,163,61,0.16)', time: '+11:40' },
      { label: 'Call the therapist back', status: 'Stale', color: '#D9722E', bg: 'rgba(217,114,46,0.16)', time: '1d 06h' },
      { label: 'Call the therapist back', status: 'Hot', color: '#C9453F', bg: 'rgba(201,69,63,0.16)', time: '3d 02h' },
      { label: 'Call the therapist back', status: 'Old', color: '#6B6B66', bg: 'rgba(107,107,102,0.18)', time: '6d 18h' },
      { label: 'Call the therapist back', status: 'Overdue', color: '#F6F3EA', bg: '#1C2118', time: '9d 04h' }
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
      title.style.color = (s.status === 'Overdue') ? '#F6F3EA' : '#F6F3EA';
      status.textContent = s.status;
      status.style.color = s.color;
      timer.textContent = s.time;
      timer.style.color = '#F6F3EA';
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
