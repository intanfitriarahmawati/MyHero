(() => {
  function nowISO(){ return new Date().toISOString(); }
  function spacedText(t){ return String(t).split('').join(' '); }

  function getSelectedText(){
    try {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) return sel.toString().trim();
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const start = active.selectionStart, end = active.selectionEnd;
        if (typeof start === 'number' && typeof end === 'number' && end > start) {
          return active.value.slice(start, end).trim();
        }
      }
    } catch(e) { console.error('getSelectedText error', e); }
    return '';
  }

  function getMainMenuOptionsText(){
    const texts = [];
    const candidates = [document.querySelector('.menu-grid'), document.getElementById('menu'), document.querySelector('.welcome-card .nav-pills')];
    for (const menu of candidates){
      if (!menu) continue;
      const btns = menu.querySelectorAll ? menu.querySelectorAll('button') : [];
      btns.forEach(btn => {
        const t = (btn.innerText || btn.textContent || '').trim();
        if (t) texts.push(t);
      });
      if (texts.length) break;
    }
    return texts.join('. ');
  }

  // --- History stack (Back) ---
  const pageHistory = [];
  let currentPage = null;
  const topBackBtn = document.getElementById('topBackBtn'); // optional top-back if present
  function updateTopBackVisibility(){
    if (!topBackBtn) return;
    topBackBtn.style.display = pageHistory.length > 0 ? 'inline-block' : 'none';
  }
  function pushHistory(name){
    if (currentPage && currentPage !== name) pageHistory.push(currentPage);
    updateTopBackVisibility();
  }
  function goBack(){
    if (pageHistory.length === 0) {
      showPage('menu', false);
      return;
    }
    const prev = pageHistory.pop();
    showPage(prev, false);
    updateTopBackVisibility();
  }
  if (topBackBtn) topBackBtn.addEventListener('click', ()=> goBack());

  const Storage = {
    key: 'inklusif_progress_v1',
    load(){ try { return JSON.parse(localStorage.getItem(this.key) || '{"progress":[]}'); } catch(e){ return {progress:[]}; } },
    saveProgress(rec){
      if(!rec.time) rec.time = nowISO();
      const data = this.load();
      data.progress.push(rec);
      localStorage.setItem(this.key, JSON.stringify(data));
      
      try {
        fetch('/save_progress', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(rec)
        }).catch(()=>{/* ignore network error */});
      } catch(e){}
    }
  };

  const TTS = {
    supported: !!(window.speechSynthesis),
    speak(text){
      if(!text) return;
      if(this.supported){
        const ut = new SpeechSynthesisUtterance(String(text));
        ut.lang = 'id-ID';
        if (ut.text.length > 1800) ut.text = ut.text.slice(0, 1800) + '...';
        speechSynthesis.cancel();
        speechSynthesis.speak(ut);
      } else {
        alert('Browser Anda tidak mendukung TTS (speechSynthesis).');
        console.log('TTS fallback text:', text);
      }
    }
  };

  const DEFAULTS = {
    bgColor:'#A7C7E7', textColor:'#0A2540', fontFamily:'Helvetica, Arial, sans-serif',
    fontSize:18, contrast:false, focusMode:false, letterSpacing:0.28, lineHeight:1.4, theme:'pastel-blue', animateFeedback:true
  };
  const THEMES = {
    'pastel-blue': {bg1:'#A7C7E7', bg2:'#EAF6FF', text:'#0A2540', accent:'#FFD79A'},
    'cream': {bg1:'#FFF5E6', bg2:'#FFF9F2', text:'#1B2B2B', accent:'#FFE3B8'},
    'mint': {bg1:'#DFF7EF', bg2:'#EEFFF9', text:'#08322A', accent:'#B8FFDA'},
    'sunset': {bg1:'#FFE6E6', bg2:'#FFF2E6', text:'#2A1A1A', accent:'#FFD2B2'}
  };
  const Settings = {
    key: 'inklusif_settings_v1',
    load(){ try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(this.key)||'{}')); } catch(e){ return Object.assign({}, DEFAULTS); } },
    save(s){ localStorage.setItem(this.key, JSON.stringify(s)); applySettings(s); }
  };

  function applySettings(s){
    const t = THEMES[s.theme] || THEMES['pastel-blue'];
    document.documentElement.style.setProperty('--bg-1', t.bg1);
    document.documentElement.style.setProperty('--bg-2', t.bg2);
    document.documentElement.style.setProperty('--text', s.textColor || t.text);
    document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.92)');
    document.documentElement.style.setProperty('--accent', t.accent || '#FFD79A');
    document.documentElement.style.setProperty('--font-family', s.fontFamily || DEFAULTS.fontFamily);
    document.documentElement.style.setProperty('--font-size', (s.fontSize||DEFAULTS.fontSize) + 'px');
    document.documentElement.style.setProperty('--letter-spacing', (typeof s.letterSpacing === 'number' ? s.letterSpacing : DEFAULTS.letterSpacing) + 'em');
    document.documentElement.style.setProperty('--line-height', (s.lineHeight || DEFAULTS.lineHeight));
    document.body.style.fontFamily = s.fontFamily || DEFAULTS.fontFamily;
    document.body.style.fontSize = (s.fontSize || DEFAULTS.fontSize) + 'px';
    if(s.contrast) document.body.classList.add('high-contrast'); else document.body.classList.remove('high-contrast');
    if(s.focusMode) document.body.classList.add('focus-mode'); else document.body.classList.remove('focus-mode');

    // ensure preview area updates
    const preview = document.getElementById('previewArea');
    if(preview) {
      preview.style.letterSpacing = (s.letterSpacing || DEFAULTS.letterSpacing) + 'em';
      preview.style.lineHeight = (s.lineHeight || DEFAULTS.lineHeight);
      preview.style.fontFamily = s.fontFamily;
      preview.style.fontSize = (s.fontSize + 6) + 'px';
    }
  }

  const pages = {
    welcome: document.querySelector('.welcome-card'),
    menu: document.getElementById('menu'),
    letters: document.getElementById('letters'),
    words: document.getElementById('words'),
    settings: document.getElementById('settings')
  };
  const lettersArea = document.getElementById('lettersArea');
  const wordsArea = document.getElementById('wordsArea');

  function showPage(name, push=true){
    if (push) pushHistory(name);
    if (pages.welcome) pages.welcome.style.display = name === 'menu' ? '' : 'none';
    Object.keys(pages).forEach(k => {
      if (k === 'welcome') return;
      const el = pages[k];
      if (!el) return;
      if (k === name){
        el.classList.remove('hidden'); el.classList.add('page-visible'); el.setAttribute('aria-hidden','false');
      } else {
        el.classList.add('hidden'); el.classList.remove('page-visible'); el.setAttribute('aria-hidden','true');
      }
    });
    currentPage = name;
    updateTopBackVisibility();
    // render page-specific content on demand
    if (name === 'letters') renderLettersPage();
    if (name === 'words') renderWordsPage();
    // keyboard focus first control
    const first = pages[name] && pages[name].querySelector('button, [tabindex]');
    if (first) first.focus();
  }

  // --- Read selection or main options ---
  function speakSelectionOrMain(){
    const sel = getSelectedText();
    if (sel) { TTS.speak(sel); return; }
    const mainText = getMainMenuOptionsText();
    if (mainText) { TTS.speak(mainText); return; }
    alert('Silakan pilih teks yang ingin dibacakan, atau buka menu utama untuk membaca opsi.');
  }

  const helpIds = ['helpReadBtn','helpReadBtnMenu','readAllBtn'];
  helpIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', speakSelectionOrMain);
  });
  document.addEventListener('keydown', e => {
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === 'r'){ e.preventDefault(); speakSelectionOrMain(); }
  });

  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-module]');
    if (btn){
      const mod = btn.getAttribute('data-module');
      if (!mod) return;
      if (mod === 'menu') showPage('menu', true);
      else if (mod === 'letters') showPage('letters', true);
      else if (mod === 'words') showPage('words', true);
      else if (mod === 'settings') showPage('settings', true);
    }
  });

  document.addEventListener('click', function(e){
    const b = e.target.closest('.back-btn');
    if (b) { goBack(); }
  });

  function doConfetti(x, y, colors) {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    const count = 14;
    for (let i=0;i<count;i++){
      const el = document.createElement('div');
      el.style.position='fixed';
      el.style.left = (x + (Math.random()*60 - 30)) + 'px';
      el.style.top = (y + (Math.random()*40 - 20)) + 'px';
      el.style.width = (6 + Math.random()*10) + 'px';
      el.style.height = (4 + Math.random()*8) + 'px';
      el.style.background = colors[Math.floor(Math.random()*colors.length)];
      el.style.borderRadius = '2px';
      el.style.opacity = '0.95';
      el.style.pointerEvents = 'none';
      el.style.transition = 'transform 900ms cubic-bezier(.2,.8,.2,1), opacity 900ms linear';
      container.appendChild(el);
      setTimeout(()=> {
        el.style.transform = `translateY(${120 + Math.random()*180}px) translateX(${(Math.random()*200-100)}px) rotate(${Math.random()*720}deg)`;
        el.style.opacity = '0';
      }, 20 + Math.random()*80);
      setTimeout(()=> { try{ container.removeChild(el); }catch(e){} }, 1100 + Math.random()*200);
    }
  }

  function showFeedback(el, correct){
    if (!el) return;
    const s = Settings.load();
    if (s.animateFeedback) {
      if (correct){
        el.classList.add('correct-burst');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        doConfetti(cx, cy, ['#FFD79A','#79C6FF','#B8FFDA','#FFB3B3']);
      } else {
        el.classList.add('wrong-shake');
      }
      setTimeout(()=>{ el.classList.remove('correct-burst','wrong-shake'); }, 900);
    }
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function renderLettersPage(){
    if (!lettersArea) return;
    lettersArea.innerHTML = '';

    const s = Settings.load();
    const letter = LETTERS[Math.floor(Math.random()*LETTERS.length)];
    const big = document.createElement('div');
    big.className = 'spaced focus-line';
    big.style.fontSize = '120px';
    big.style.textAlign = 'center';
    big.textContent = spacedText(letter);
    lettersArea.appendChild(big);

    const btnRead = document.createElement('button');
    btnRead.className = 'small-btn';
    btnRead.textContent = '🔊 Baca Huruf';
    btnRead.addEventListener('click', ()=> TTS.speak(letter));
    lettersArea.appendChild(btnRead);

    const btnNext = document.createElement('button');
    btnNext.className = 'small-btn';
    btnNext.textContent = '➡️ Huruf Lain';
    btnNext.addEventListener('click', ()=> renderLettersPage());
    lettersArea.appendChild(btnNext);

    Storage.saveProgress({module:'letters_view', letter, time: nowISO()});
  }

  const WORDS = ["rumah","kucing","apel","sekolah","buku","sepeda","hijau","merah","bola","air"];
  function renderWordsPage(){
    if (!wordsArea) return;
    wordsArea.innerHTML = '';

    const word = WORDS[Math.floor(Math.random()*WORDS.length)];
    const big = document.createElement('div');
    big.className = 'spaced focus-line';
    big.style.fontSize = '72px';
    big.style.textAlign = 'center';
    big.textContent = spacedText(word);
    wordsArea.appendChild(big);

    const btnRead = document.createElement('button');
    btnRead.className = 'small-btn';
    btnRead.textContent = '🔊 Baca Kata';
    btnRead.addEventListener('click', ()=> TTS.speak(word));
    wordsArea.appendChild(btnRead);

    const spell = document.createElement('div');
    spell.style.marginTop = '10px';
    for (const ch of word){
      const b = document.createElement('button');
      b.className = 'small-btn';
      b.textContent = ch;
      b.style.marginRight = '6px';
      b.addEventListener('click', (ev)=> { TTS.speak(ch); showFeedback(ev.currentTarget, true); });
      spell.appendChild(b);
    }
    wordsArea.appendChild(spell);

    const done = document.createElement('button');
    done.className = 'small-btn primary';
    done.textContent = '✅ Selesai';
    done.addEventListener('click', ()=> {
      Storage.saveProgress({module:'words_done', word, time: nowISO()});
      alert('Progress disimpan.');
    });
    wordsArea.appendChild(done);
  }

  const quoteBtn = document.getElementById('quoteReadBtn');
  if (quoteBtn){
    quoteBtn.addEventListener('click', ()=> {
      const f = document.getElementById('foundingQuote');
      if (!f) return;
      const txt = f.innerText || f.textContent || '';
      if (txt) {
        TTS.speak(txt);
        Storage.saveProgress({module:'quote_read', text:txt, time: nowISO()});
      }
    });
  }

  function attachSettingsUI(){
    const fontSizeInput = document.getElementById('fontSize');
    if (!fontSizeInput) return;
    const fontSizeLabel = document.getElementById('fontSizeLabel');
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    const letterSpacingInput = document.getElementById('letterSpacing');
    const letterSpacingLabel = document.getElementById('letterSpacingLabel');
    const lineHeightInput = document.getElementById('lineHeight');
    const lineHeightLabel = document.getElementById('lineHeightLabel');
    const focusCheckbox = document.getElementById('focusMode');
    const animateCheckbox = document.getElementById('animateFeedback');
    const previewReadBtn = document.getElementById('previewReadBtn');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const resetSettingsBtn = document.getElementById('resetSettings');

    function populateSettingsUI(s){
      fontSizeInput.value = s.fontSize;
      fontSizeLabel.textContent = s.fontSize;
      fontFamilySelect.value = s.fontFamily;
      letterSpacingInput.value = s.letterSpacing;
      letterSpacingLabel.textContent = s.letterSpacing;
      lineHeightInput.value = s.lineHeight;
      lineHeightLabel.textContent = s.lineHeight;
      focusCheckbox.checked = s.focusMode;
      animateCheckbox.checked = s.animateFeedback;
      document.querySelectorAll('.swatch').forEach(sw => {
        sw.setAttribute('aria-checked', (sw.getAttribute('data-theme') === s.theme).toString());
        sw.classList.toggle('selected', sw.getAttribute('data-theme') === s.theme);
      });
    }

    fontSizeInput.addEventListener('input', ()=> {
      const s = Settings.load();
      s.fontSize = parseInt(fontSizeInput.value,10);
      applySettings(s);
      fontSizeLabel.textContent = fontSizeInput.value;
    });
    fontFamilySelect.addEventListener('change', ()=> {
      const s = Settings.load();
      s.fontFamily = fontFamilySelect.value;
      applySettings(s);
    });
    letterSpacingInput.addEventListener('input', ()=> {
      const s = Settings.load();
      s.letterSpacing = parseFloat(letterSpacingInput.value);
      applySettings(s);
      letterSpacingLabel.textContent = letterSpacingInput.value;
    });
    lineHeightInput.addEventListener('input', ()=> {
      const s = Settings.load();
      s.lineHeight = parseFloat(lineHeightInput.value);
      applySettings(s);
      lineHeightLabel.textContent = lineHeightInput.value;
    });
    focusCheckbox.addEventListener('change', ()=> {
      const s = Settings.load();
      s.focusMode = !!focusCheckbox.checked;
      applySettings(s);
    });
    animateCheckbox.addEventListener('change', ()=> {
      const s = Settings.load();
      s.animateFeedback = !!animateCheckbox.checked;
      applySettings(s);
    });

    document.querySelectorAll('.swatch').forEach(sw => {
      sw.addEventListener('click', (ev)=> {
        const theme = ev.currentTarget.getAttribute('data-theme');
        const s = Settings.load();
        s.theme = theme;
        Settings.save(s);
        populateSettingsUI(s);
      });
    });

    previewReadBtn.addEventListener('click', ()=> {
      const preview = document.getElementById('previewArea').innerText.trim();
      if (preview) TTS.speak(preview);
    });

    saveSettingsBtn.addEventListener('click', ()=> {
      const s = Settings.load();
      s.fontSize = parseInt(fontSizeInput.value,10) || s.fontSize;
      s.fontFamily = fontFamilySelect.value || s.fontFamily;
      s.letterSpacing = parseFloat(letterSpacingInput.value) || s.letterSpacing;
      s.lineHeight = parseFloat(lineHeightInput.value) || s.lineHeight;
      s.focusMode = !!focusCheckbox.checked;
      s.animateFeedback = !!animateCheckbox.checked;
      Settings.save(s);
      if (s.fontFamily && s.fontFamily.indexOf('OpenDyslexic') !== -1){

        console.log('OpenDyslexic selected. Make sure fonts/OpenDyslexic3-Regular.* exists on server.');
      }

      populateSettingsUI(s);
      alert('Pengaturan disimpan.');
    });

    resetSettingsBtn.addEventListener('click', ()=> {
      localStorage.removeItem(Settings.key);
      const s = Settings.load();
      applySettings(s);
      populateSettingsUI(s);
      alert('Pengaturan dikembalikan ke default.');
    });

    const ss = Settings.load();
    if (typeof ss.letterSpacing !== 'number') ss.letterSpacing = DEFAULTS.letterSpacing;
    if (typeof ss.lineHeight !== 'number') ss.lineHeight = DEFAULTS.lineHeight;
    if (!ss.theme) ss.theme = DEFAULTS.theme;
    Settings.save(ss);
    applySettings(ss);
    populateSettingsUI(ss);
  }

  document.addEventListener('keydown', (e) => {
    const focusable = Array.from(document.querySelectorAll('button, [tabindex]')).filter(el => !el.disabled && el.offsetParent !== null);
    if(!focusable.length) return;
    const idx = focusable.indexOf(document.activeElement);
    if(e.key === 'ArrowDown'){ e.preventDefault(); const ni = (idx+1)%focusable.length; focusable[ni].focus(); const txt = focusable[ni].innerText||focusable[ni].ariaLabel||''; if(txt) TTS.speak(txt); }
    if(e.key === 'ArrowUp'){ e.preventDefault(); const ni = (idx-1 + focusable.length)%focusable.length; focusable[ni].focus(); const txt = focusable[ni].innerText||focusable[ni].ariaLabel||''; if(txt) TTS.speak(txt); }
    if(e.key === 'Enter'){ if(document.activeElement) document.activeElement.click(); }
  });

  function init(){
    attachSettingsUI();
pages.menu.classList.remove('hidden');
    if (pages.letters) pages.letters.classList.add('hidden');
    if (pages.words) pages.words.classList.add('hidden');
    if (pages.settings) pages.settings.classList.add('hidden');

    const first = document.querySelector('button, [tabindex]');
    if (first) first.focus();

    document.querySelectorAll('.big-btn').forEach(b => { b.style.pointerEvents = 'auto'; });

    currentPage = 'menu';
    pageHistory.length = 0;
    updateTopBackVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }


  window.__myhero = {
    showPage, renderLettersPage, renderWordsPage, Settings, Storage
  };
})();