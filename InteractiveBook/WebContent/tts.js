(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var fab = document.getElementById('tts-fab');
  var settingsBtn = document.getElementById('tts-settings');
  var state = { playing: false, segments: [], index: 0, audio: null, cancelled: false };

  function getApiKey() {
    return localStorage.getItem('yandexTtsApiKey') || '';
  }

  settingsBtn.addEventListener('click', function () {
    var current = getApiKey();
    var key = prompt('Введите API-ключ Yandex SpeechKit (для онлайн-озвучки). Оставьте пустым и нажмите OK, чтобы удалить сохранённый ключ.', current || '');
    if (key === null) return;
    if (key.trim() === '') {
      localStorage.removeItem('yandexTtsApiKey');
      alert('Ключ удалён. Будет использоваться офлайн-голос устройства.');
    } else {
      localStorage.setItem('yandexTtsApiKey', key.trim());
      alert('Ключ сохранён локально на этом устройстве.');
    }
  });

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
    var preferredNames = ['milena', 'yuri', 'google'];
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

  function buildSsml(segments) {
    var body = segments.map(function (seg) {
      var escaped = seg.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var pause = seg.heading ? '700ms' : '450ms';
      return escaped + '<break time="' + pause + '"/>';
    }).join(' ');
    return '<speak>' + body + '</speak>';
  }

  function speakOnlineChunk(ssmlChunk, apiKey) {
    var params = new URLSearchParams();
    params.set('ssml', ssmlChunk);
    params.set('lang', 'ru-RU');
    params.set('voice', 'ermil');
    params.set('format', 'oggopus');
    return fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: { 'Authorization': 'Api-Key ' + apiKey },
      body: params
    }).then(function (resp) {
      if (!resp.ok) throw new Error('Yandex TTS request failed: ' + resp.status);
      return resp.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob);
        var audio = new Audio(url);
        state.audio = audio;
        audio.onended = function () { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
        audio.play().catch(reject);
      });
    });
  }

  function chunkSegments(segments, maxLen) {
    var chunks = [];
    var current = [];
    var len = 0;
    segments.forEach(function (seg) {
      if (len + seg.text.length > maxLen && current.length) {
        chunks.push(current);
        current = [];
        len = 0;
      }
      current.push(seg);
      len += seg.text.length;
    });
    if (current.length) chunks.push(current);
    return chunks;
  }

  function speakOnline(segments, apiKey, onDone, onFail) {
    var chunks = chunkSegments(segments, 900);
    var i = 0;
    function next() {
      if (state.cancelled || i >= chunks.length) { onDone(); return; }
      var ssml = buildSsml(chunks[i]);
      speakOnlineChunk(ssml, apiKey).then(function () {
        i++;
        next();
      }).catch(function (err) {
        console.error('Yandex TTS failed, falling back to offline voice:', err);
        onFail();
      });
    }
    next();
  }

  function stop() {
    state.cancelled = true;
    state.playing = false;
    speechSynthesis.cancel();
    if (state.audio) { state.audio.pause(); state.audio = null; }
    fab.textContent = '🔊';
  }

  function start() {
    var segments = extractSegments();
    if (!segments.length) {
      alert('Не удалось найти текст для озвучки на этой странице.');
      return;
    }
    state.cancelled = false;
    state.playing = true;
    fab.textContent = '⏸';

    var apiKey = getApiKey();
    var online = navigator.onLine && apiKey;

    function finish() {
      state.playing = false;
      fab.textContent = '🔊';
    }

    if (online) {
      speakOnline(segments, apiKey, finish, function () {
        speakOffline(segments, finish);
      });
    } else {
      speakOffline(segments, finish);
    }
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
