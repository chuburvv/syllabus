(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var fab = document.getElementById('tts-fab');
  var btnSystem = document.getElementById('voice-system');
  var btnAi = document.getElementById('voice-ai');
  var state = { playing: false, cancelled: false, currentAudio: null };
  var HEADING_RE = /^h([1-6])$/;
  var BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';
  var AI_PREF_KEY = 'useAiVoice';

  function sanitizeForSpeech(text) {
    return text
      .replace(/[«»„“”‘’'`*_#~|]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function cleanText(node) {
    var raw = (node.textContent || '').replace(/\s+/g, ' ').trim();
    return sanitizeForSpeech(raw);
  }

  function getDoc() {
    try {
      return iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      return null;
    }
  }

  function isRendered(rect) {
    return rect.width > 0 || rect.height > 0;
  }

  function buildFlatList(doc) {
    var nodes = doc.body.querySelectorAll(BLOCK_SELECTOR);
    var list = [];
    nodes.forEach(function (node) {
      if (node.closest('nav, header, footer, script, style, [aria-hidden="true"]')) return;
      var text = cleanText(node);
      if (!text || text.length < 2) return;
      var m = HEADING_RE.exec(node.tagName.toLowerCase());
      list.push({ node: node, text: text, level: m ? parseInt(m[1], 10) : null });
    });
    return list;
  }

  function findCurrentHeadingIndex(list, win) {
    var threshold = win.innerHeight * 0.35;
    var best = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].level === null) continue;
      var rect = list[i].node.getBoundingClientRect();
      if (!isRendered(rect)) continue;
      if (rect.top <= threshold) {
        best = i;
      }
    }
    if (best === -1) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].level === null) continue;
        var r = list[j].node.getBoundingClientRect();
        if (!isRendered(r)) continue;
        if (r.top < win.innerHeight && r.bottom > 0) { best = j; break; }
      }
    }
    return best;
  }

  function collectSection(startIndex, list) {
    var startLevel = list[startIndex].level;
    var segments = [{ text: list[startIndex].text, heading: true }];
    for (var i = startIndex + 1; i < list.length; i++) {
      var item = list[i];
      if (item.level !== null && item.level <= startLevel) break;
      var rect = item.node.getBoundingClientRect();
      if (!isRendered(rect)) continue;
      segments.push({ text: item.text, heading: item.level !== null });
    }
    return segments;
  }

  function pickOfflineVoice() {
    var voices = speechSynthesis.getVoices() || [];
    var ruVoices = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf('ru') === 0; });
    var preferredNames = ['milena', 'yuri', 'google', 'enhanced', 'premium'];
    for (var i = 0; i < preferredNames.length; i++) {
      var found = ruVoices.find(function (v) { return v.name.toLowerCase().indexOf(preferredNames[i]) !== -1; });
      if (found) return found;
    }
    var local = ruVoices.find(function (v) { return v.localService; });
    if (local) return local;
    return ruVoices[0] || voices[0] || null;
  }

  function isAiEnabled() {
    return localStorage.getItem(AI_PREF_KEY) === '1' && window.aiVoice;
  }

  function speakSystem(text, heading, onDone) {
    var voice = pickOfflineVoice();
    var utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.lang = 'ru-RU';
    utter.rate = heading ? 0.85 : 0.95;
    utter.pitch = heading ? 1.08 : 1.0;
    utter.onend = onDone;
    utter.onerror = onDone;
    speechSynthesis.speak(utter);
  }

  function speakAi(text, onDone) {
    window.aiVoice.synthesize(text).then(function (url) {
      var audio = new Audio(url);
      state.currentAudio = audio;
      audio.onended = function () { URL.revokeObjectURL(url); onDone(); };
      audio.onerror = function () { URL.revokeObjectURL(url); onDone(); };
      audio.play().catch(onDone);
    }).catch(function (err) {
      console.error('AI voice failed, falling back to system voice:', err);
      speakSystem(text, false, onDone);
    });
  }

  function speak(segments) {
    var i = 0;
    var useAi = isAiEnabled();
    state.cancelled = false;
    state.playing = true;
    fab.textContent = '⏸';

    function finish() {
      state.playing = false;
      fab.textContent = '🔊';
    }

    function next() {
      if (state.cancelled || i >= segments.length) { finish(); return; }
      var seg = segments[i];
      var advance = function () {
        i++;
        setTimeout(next, seg.heading ? 900 : 600);
      };
      if (useAi) {
        speakAi(seg.text, advance);
      } else {
        speakSystem(seg.text, seg.heading, advance);
      }
    }
    next();
  }

  function stop() {
    state.cancelled = true;
    state.playing = false;
    speechSynthesis.cancel();
    if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
    fab.textContent = '🔊';
  }

  function start() {
    var doc = getDoc();
    if (!doc || !doc.body) return;
    var win = iframe.contentWindow;
    var list = buildFlatList(doc);
    var idx = findCurrentHeadingIndex(list, win);
    if (idx === -1) {
      alert('Не удалось определить текущий раздел. Прокрути страницу до нужной темы и попробуй снова.');
      return;
    }
    var segments = collectSection(idx, list);
    speak(segments);
  }

  fab.addEventListener('click', function () {
    if (state.playing) {
      stop();
    } else {
      start();
    }
  });

  function setActiveButton(useAi) {
    if (btnSystem) btnSystem.classList.toggle('active', !useAi);
    if (btnAi) btnAi.classList.toggle('active', useAi);
  }

  function refreshButtons() {
    var enabled = localStorage.getItem(AI_PREF_KEY) === '1';
    setActiveButton(enabled);
    if (btnAi) btnAi.textContent = '🤖 Piper (ИИ)';
  }

  if (btnSystem) {
    btnSystem.addEventListener('click', function () {
      localStorage.setItem(AI_PREF_KEY, '0');
      refreshButtons();
    });
  }

  if (btnAi) {
    btnAi.addEventListener('click', function () {
      if (!window.aiVoice) {
        alert('ИИ-голос ещё загружается, подожди несколько секунд и попробуй снова.');
        return;
      }
      window.aiVoice.isReady().then(function (ready) {
        if (ready) {
          localStorage.setItem(AI_PREF_KEY, '1');
          refreshButtons();
          return;
        }
        btnAi.textContent = '⏳ 0%';
        window.aiVoice.download(function (progress) {
          var pct = Math.round((progress.loaded * 100) / progress.total);
          btnAi.textContent = '⏳ ' + pct + '%';
        }).then(function () {
          localStorage.setItem(AI_PREF_KEY, '1');
          refreshButtons();
        }).catch(function (err) {
          console.error('AI voice model download failed:', err);
          alert('Не удалось загрузить ИИ-голос. Проверь интернет и попробуй снова.');
          refreshButtons();
        });
      });
    });
  }

  window.addEventListener('ai-voice-ready', refreshButtons);
  refreshButtons();

  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = function () {};
  }
})();
