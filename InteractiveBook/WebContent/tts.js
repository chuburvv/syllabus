(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var fab = document.getElementById('tts-fab');
  var state = { playing: false, cancelled: false };

  function isVisible(node) {
    if (!(node instanceof node.ownerDocument.defaultView.HTMLElement)) return false;
    if (node.offsetParent === null && node.ownerDocument.defaultView.getComputedStyle(node).position !== 'fixed') return false;
    var style = node.ownerDocument.defaultView.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    var rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function extractSegments() {
    var doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      return [];
    }
    if (!doc || !doc.body) return [];
    var nodes = doc.body.querySelectorAll('h1, h2, h3, h4, h5, p, li, blockquote');
    var segments = [];
    nodes.forEach(function (node) {
      var closestSkip = node.closest('nav, header, footer, button, script, style, [aria-hidden="true"]');
      if (closestSkip) return;
      if (!isVisible(node)) return;
      var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;
      var tag = node.tagName.toLowerCase();
      var isHeading = /^h[1-5]$/.test(tag);
      segments.push({ text: text, heading: isHeading });
    });
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

  function speakOffline(segments, onDone) {
    var voice = pickOfflineVoice();
    var i = 0;

    function next() {
      if (state.cancelled || i >= segments.length) { onDone(); return; }
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
    var segments = extractSegments();
    if (!segments.length) {
      alert('Не удалось найти видимый текст на этой странице.');
      return;
    }
    state.cancelled = false;
    state.playing = true;
    fab.textContent = '⏸';

    speakOffline(segments, function () {
      state.playing = false;
      fab.textContent = '🔊';
    });
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
