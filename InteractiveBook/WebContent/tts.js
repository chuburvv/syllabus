(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var fab = document.getElementById('tts-fab');
  var state = { playing: false, cancelled: false };
  var HEADING_RE = /^h([1-6])$/;
  var BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';

  function cleanText(node) {
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getDoc() {
    try {
      return iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      return null;
    }
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
      if (rect.top <= threshold) {
        best = i;
      }
    }
    if (best === -1) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].level === null) continue;
        var r = list[j].node.getBoundingClientRect();
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

  function speak(segments) {
    var voice = pickOfflineVoice();
    var i = 0;
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
      var utter = new SpeechSynthesisUtterance(seg.text);
      if (voice) utter.voice = voice;
      utter.lang = 'ru-RU';
      utter.rate = seg.heading ? 0.85 : 0.95;
      utter.pitch = seg.heading ? 1.08 : 1.0;
      utter.onend = function () {
        i++;
        setTimeout(next, seg.heading ? 900 : 600);
      };
      utter.onerror = function () { i++; next(); };
      speechSynthesis.speak(utter);
    }
    next();
  }

  function stop() {
    state.cancelled = true;
    state.playing = false;
    speechSynthesis.cancel();
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

  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = function () {};
  }
})();
