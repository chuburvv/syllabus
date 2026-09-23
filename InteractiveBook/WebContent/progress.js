(function () {
  'use strict';

  var iframe = document.querySelector('iframe');
  var STORAGE_KEY = 'syllabusProgressV1';

  function getDoc() {
    try {
      return iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      return null;
    }
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function stableId(el, index) {
    if (el.id) return 'id:' + el.id;
    if (el.getAttribute('data-id')) return 'data-id:' + el.getAttribute('data-id');
    if (el.getAttribute('data-topic')) return 'data-topic:' + el.getAttribute('data-topic');
    var label = el.closest('label');
    if (label && label.textContent) return 'label:' + label.textContent.trim().slice(0, 80);
    var parent = el.closest('[id]');
    if (parent) return 'parent:' + parent.id + ':' + index;
    return 'idx:' + index;
  }

  function updateBadge(doc) {
    if (!('setAppBadge' in navigator)) return;
    var text = doc.body.innerText || '';
    var m = text.match(/(\d+)\s*\/\s*(\d+)\s*(?:тем|топик)/i);
    if (!m) return;
    var done = parseInt(m[1], 10);
    var total = parseInt(m[2], 10);
    var remaining = Math.max(total - done, 0);
    if (remaining > 0) {
      navigator.setAppBadge(remaining).catch(function () {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(function () {});
    }
  }

  function restoreAndBind(doc) {
    var boxes = Array.prototype.slice.call(doc.querySelectorAll('input[type="checkbox"]'));
    if (!boxes.length) { updateBadge(doc); return; }
    var progress = loadProgress();
    boxes.forEach(function (box, i) {
      if (box.dataset.progressBound) return;
      box.dataset.progressBound = '1';
      var id = stableId(box, i);
      if (progress[id] && !box.checked) {
        box.checked = true;
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
        box.dispatchEvent(new Event('click', { bubbles: true }));
      }
      box.addEventListener('change', function () {
        var p = loadProgress();
        p[id] = box.checked;
        saveProgress(p);
        updateBadge(doc);
      });
    });
    updateBadge(doc);
  }

  function init() {
    var doc = getDoc();
    if (!doc || !doc.body) { setTimeout(init, 500); return; }
    restoreAndBind(doc);
    var observer = new MutationObserver(function () {
      restoreAndBind(doc);
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  iframe.addEventListener('load', init);
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') init();
})();
