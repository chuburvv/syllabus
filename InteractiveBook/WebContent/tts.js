(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var stopBtn = document.getElementById('tts-stop');
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
    stopBtn.style.display = 'flex';

    function finish() {
      state.playing = false;
      stopBtn.style.display = 'none';
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
    stopBtn.style.display = 'none';
  }

  stopBtn.addEventListener('click', stop);

  function attachButtons(doc) {
    var headingNodes = doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingNodes.forEach(function (h) {
      if (h.dataset.ttsAttached) return;
      if (h.closest('nav, header, footer, [aria-hidden="true"]')) return;
      if (!cleanText(h)) return;
      h.dataset.ttsAttached = '1';
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.textContent = '🔊';
      btn.setAttribute('aria-label', 'Озвучить раздел');
      btn.style.cssText = 'display:inline-block;margin-left:8px;border:none;background:rgba(0,0,0,0.06);' +
        'border-radius:50%;width:1.5em;height:1.5em;font-size:0.6em;line-height:1.5em;text-align:center;' +
        'cursor:pointer;vertical-align:middle;';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (state.playing) { stop(); }
        var curDoc = getDoc();
        if (!curDoc) return;
        var list = buildFlatList(curDoc);
        var idx = list.findIndex(function (item) { return item.node === h; });
        if (idx === -1) return;
        var segments = collectSection(idx, list);
        speak(segments);
      });
      h.appendChild(btn);
    });
  }

  function init() {
    var doc = getDoc();
    if (!doc || !doc.body) { setTimeout(init, 500); return; }
    attachButtons(doc);
    var observer = new MutationObserver(function () {
      attachButtons(doc);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  iframe.addEventListener('load', init);
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') init();

  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = function () {};
  }
})();
