/**
 * ProfileAI mobile bookmarklet runtime.
 *
 * Loaded via a tiny `javascript:` URI saved as a bookmark (see the pairing
 * flow at /mobile-apply on the web app), which injects this file as a
 * versioned <script src>. Shipping fixes here reaches every already-saved
 * bookmarklet on the next tap — nothing about the saved bookmark itself
 * needs to change.
 *
 * Scope (MVP): a generic label/field heuristic scanner, not a per-ATS
 * engine like the Chrome extension's content script. It won't be as sharp
 * on every site, but it doesn't need per-site maintenance either. If a page
 * yields no confident matches, it shows a clear fallback instead of
 * guessing.
 *
 * Everything is wrapped in a synchronous try/catch that does not depend on
 * anything beyond this file executing, so a hostile/locked-down page (CSP,
 * sandboxed iframe, whatever) degrades to a plain alert() instead of a
 * silent no-op or a broken host page.
 */
(function () {
  'use strict';

  try {
    if (window.__profileaiBookmarklet) {
      window.__profileaiBookmarklet.toggle();
      return;
    }

    var scriptEl = document.currentScript;
    var API_BASE = scriptEl ? new URL(scriptEl.src).origin : 'https://api.profilleai.com';
    var token = scriptEl ? new URL(scriptEl.src).searchParams.get('t') : null;

    if (!token) {
      alert('ProfileAI: this bookmarklet is missing its access token. Re-save it from your ProfileAI account settings.');
      return;
    }

    // ---------------------------------------------------------------------
    // Shadow-DOM host so the host page's CSS can never bleed into our UI
    // (and ours never bleeds into theirs).
    // ---------------------------------------------------------------------
    var hostEl = document.createElement('div');
    hostEl.id = 'profileai-bookmarklet-host';
    hostEl.style.all = 'initial';
    document.body.appendChild(hostEl);
    var shadow = hostEl.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = [
      ':host { all: initial; }',
      '* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.pai-fab { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 56px; height: 56px; border-radius: 50%;',
      '  background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 6px 20px rgba(102,126,234,0.45);',
      '  display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; }',
      '.pai-fab svg { width: 26px; height: 26px; }',
      '.pai-panel { position: fixed; bottom: 86px; right: 20px; z-index: 2147483647; width: min(340px, calc(100vw - 40px));',
      '  max-height: min(520px, calc(100vh - 140px)); overflow-y: auto; background: #fff; border-radius: 16px;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.25); padding: 16px; color: #1a1a2e; font-size: 13px; line-height: 1.5; }',
      '.pai-panel.pai-hidden, .pai-fab.pai-hidden { display: none; }',
      '.pai-title { font-weight: 800; font-size: 15px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }',
      '.pai-sub { color: #6b7280; margin-bottom: 12px; }',
      '.pai-q { padding: 8px 10px; background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; }',
      '.pai-q-text { font-weight: 600; margin-bottom: 2px; }',
      '.pai-q-status { color: #9ca3af; font-size: 12px; }',
      '.pai-q-status.pai-filled { color: #059669; }',
      '.pai-btn { width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-weight: 700; font-size: 13.5px;',
      '  cursor: pointer; margin-top: 4px; }',
      '.pai-btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }',
      '.pai-btn-primary:disabled { opacity: 0.6; cursor: default; }',
      '.pai-btn-ghost { background: #f3f4f6; color: #1a1a2e; }',
      '.pai-close { position: absolute; top: 12px; right: 12px; background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 16px; }',
      '.pai-fallback { color: #374151; }',
    ].join('\n');
    shadow.appendChild(style);

    var fab = document.createElement('button');
    fab.className = 'pai-fab';
    fab.setAttribute('aria-label', 'ProfileAI');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" fill="#fff"/></svg>';
    shadow.appendChild(fab);

    var panel = document.createElement('div');
    panel.className = 'pai-panel pai-hidden';
    shadow.appendChild(panel);

    var panelOpen = false;
    function setPanelOpen(open) {
      panelOpen = open;
      panel.classList.toggle('pai-hidden', !open);
    }

    window.__profileaiBookmarklet = {
      toggle: function () { setPanelOpen(!panelOpen); },
    };

    fab.addEventListener('click', function () { setPanelOpen(!panelOpen); });

    // ---------------------------------------------------------------------
    // Generic field/label detection
    // ---------------------------------------------------------------------
    var FILLABLE_SELECTOR = [
      'input[type="text"]', 'input[type="email"]', 'input[type="tel"]',
      'input[type="url"]', 'input[type="number"]', 'input:not([type])',
      'textarea', 'select',
    ].join(',');

    function isVisible(el) {
      if (!el || !el.offsetParent) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function textOf(el) {
      return (el && el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // CSS.escape is broadly supported, but this runs in unpredictable mobile
    // browser/webview engines — fall back to a manual escape rather than let
    // a missing global take down detection entirely.
    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
      return String(value).replace(/([^\w-])/g, '\\$1');
    }

    function findLabelFor(field) {
      // 1. <label for="id">
      if (field.id) {
        var byFor = document.querySelector('label[for="' + cssEscape(field.id) + '"]');
        if (byFor) return textOf(byFor);
      }
      // 2. Wrapping <label>
      var wrapping = field.closest('label');
      if (wrapping) return textOf(wrapping).replace(textOf(field), '').trim();
      // 3. aria-label / aria-labelledby
      if (field.getAttribute('aria-label')) return field.getAttribute('aria-label').trim();
      var labelledBy = field.getAttribute('aria-labelledby');
      if (labelledBy) {
        var parts = labelledBy.split(/\s+/).map(function (id) {
          var el = document.getElementById(id);
          return el ? textOf(el) : '';
        }).filter(Boolean);
        if (parts.length) return parts.join(' ');
      }
      // 4. Nearest preceding heading/label-like text within a few ancestor levels
      var node = field;
      for (var depth = 0; depth < 4 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        var candidate = node.querySelector('label, .label, [class*="label" i]');
        if (candidate) {
          var t = textOf(candidate);
          if (t && t.length < 200) return t;
        }
      }
      // 5. placeholder as last resort
      if (field.placeholder) return field.placeholder.trim();
      return '';
    }

    function collectRadioAndCheckboxGroups() {
      var seen = {};
      var groups = [];
      var inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      inputs.forEach(function (input) {
        if (!isVisible(input) || !input.name || seen[input.name]) return;
        seen[input.name] = true;
        var groupInputs = document.querySelectorAll('input[name="' + cssEscape(input.name) + '"]');
        var options = [];
        groupInputs.forEach(function (gi) {
          var label = findLabelFor(gi) || gi.value;
          if (label) options.push({ label: label, el: gi });
        });
        if (options.length < 2) return; // not really a "group" (a lone checkbox rarely has a useful question)
        var groupLabel = findLabelFor(groupInputs[0]) || options.map(function (o) { return o.label; }).join(' / ');
        groups.push({
          question: groupLabel,
          fieldType: input.type,
          options: options.map(function (o) { return o.label; }),
          fill: function (answerText) {
            var match = options.find(function (o) {
              return o.label.toLowerCase() === String(answerText).toLowerCase();
            }) || options.find(function (o) {
              return o.label.toLowerCase().indexOf(String(answerText).toLowerCase()) !== -1;
            });
            if (!match) return false;
            match.el.checked = true;
            match.el.dispatchEvent(new Event('input', { bubbles: true }));
            match.el.dispatchEvent(new Event('change', { bubbles: true }));
            match.el.dispatchEvent(new Event('click', { bubbles: true }));
            return true;
          },
        });
      });
      return groups;
    }

    function nativeSetValue(el, value) {
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // -----------------------------------------------------------------------
    // "Combobox" fields — react-select and similar widgets (Greenhouse's
    // custom question dropdowns are built this way) render as a plain
    // <input role="combobox">, not a native <select>. The actual options
    // don't exist in the DOM until the menu is opened, and a value is
    // committed by clicking an option — typing text into the input and
    // setting .value does NOT register as a selection. These helpers open
    // the menu, read the rendered options, and click the matching one.
    // -----------------------------------------------------------------------
    function isComboboxField(field) {
      return field.tagName === 'INPUT' && field.getAttribute('role') === 'combobox';
    }

    function openCombobox(field) {
      field.focus();
      field.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      field.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }

    function closeCombobox(field) {
      field.blur();
    }

    function findComboboxOptionEls(field) {
      var listboxId = field.getAttribute('aria-controls');
      var scope = (listboxId && document.getElementById(listboxId)) || document;
      var opts = scope.querySelectorAll('[role="option"], [id*="-option-"]');
      if (opts.length === 0 && scope !== document) {
        opts = document.querySelectorAll('[role="option"], [id*="-option-"]');
      }
      return Array.prototype.slice.call(opts);
    }

    function waitFor(predicate, timeoutMs) {
      return new Promise(function (resolve) {
        var elapsed = 0;
        var interval = 40;
        var timer = setInterval(function () {
          var result = predicate();
          elapsed += interval;
          if (result.length > 0 || elapsed >= timeoutMs) {
            clearInterval(timer);
            resolve(result);
          }
        }, interval);
      });
    }

    function readComboboxOptions(field) {
      openCombobox(field);
      return waitFor(function () { return findComboboxOptionEls(field); }, 600)
        .then(function (opts) {
          var labels = opts.map(textOf).filter(Boolean);
          closeCombobox(field);
          return labels;
        });
    }

    function fillCombobox(field, answerText) {
      openCombobox(field);
      return waitFor(function () { return findComboboxOptionEls(field); }, 600)
        .then(function (opts) {
          var match = opts.find(function (o) { return textOf(o).toLowerCase() === String(answerText).toLowerCase(); })
            || opts.find(function (o) { return textOf(o).toLowerCase().indexOf(String(answerText).toLowerCase()) !== -1; });
          if (!match) { closeCombobox(field); return false; }
          match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          match.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return true;
        });
    }

    function detectQuestions() {
      var questions = [];
      var fields = Array.prototype.slice.call(document.querySelectorAll(FILLABLE_SELECTOR));

      fields.forEach(function (field) {
        if (!isVisible(field) || field.disabled || field.readOnly) return;
        var label = findLabelFor(field);
        if (!label || label.length > 250) return;

        if (isComboboxField(field)) {
          // Options aren't known yet — populated by enrichComboboxQuestions()
          // before the panel renders. fieldType is 'select' so the AI prompt
          // treats it like one once options are filled in.
          questions.push({
            question: label,
            fieldType: 'select',
            options: [],
            el: field,
            needsOptionScan: true,
            fill: function (answerText) { return fillCombobox(field, answerText); },
          });
          return;
        }

        var type = field.tagName === 'SELECT' ? 'select' : (field.tagName === 'TEXTAREA' ? 'textarea' : 'text');
        var entry = { question: label, fieldType: type, el: field };
        if (type === 'select') {
          entry.options = Array.prototype.slice.call(field.options)
            .map(function (o) { return o.text.trim(); })
            .filter(function (t) { return t && t.toLowerCase() !== 'select an option' && t !== '--'; });
          entry.fill = function (answerText) {
            var opt = Array.prototype.slice.call(field.options).find(function (o) {
              return o.text.trim().toLowerCase() === String(answerText).toLowerCase();
            });
            if (!opt) return false;
            nativeSetValue(field, opt.value);
            return true;
          };
        } else {
          entry.fill = function (answerText) {
            nativeSetValue(field, answerText);
            return true;
          };
        }
        questions.push(entry);
      });

      questions = questions.concat(collectRadioAndCheckboxGroups());

      // Dedupe identical question text (keep first occurrence)
      var byText = {};
      return questions.filter(function (q) {
        var key = q.question.toLowerCase();
        if (byText[key]) return false;
        byText[key] = true;
        return true;
      });
    }

    // Opens each combobox one at a time (never in parallel — overlapping
    // open menus from different fields can interfere with each other) and
    // fills in its real options before the panel is shown.
    function enrichComboboxQuestions(questions) {
      var needsScan = questions.filter(function (q) { return q.needsOptionScan; });
      return needsScan.reduce(function (chain, q) {
        return chain.then(function () {
          return readComboboxOptions(q.el).then(function (options) {
            q.options = options;
          });
        });
      }, Promise.resolve());
    }

    function renderScanning() {
      panel.innerHTML = '';
      var title = document.createElement('div');
      title.className = 'pai-title';
      title.textContent = 'ProfileAI';
      panel.appendChild(title);
      var sub = document.createElement('div');
      sub.className = 'pai-sub';
      sub.textContent = 'Scanning the page for dropdown options…';
      panel.appendChild(sub);
      setPanelOpen(true);
    }

    function guessJobDescription() {
      var metaDesc = document.querySelector('meta[name="description"]');
      var pieces = [document.title];
      if (metaDesc && metaDesc.content) pieces.push(metaDesc.content);
      pieces.push((document.body.innerText || '').slice(0, 2500));
      return pieces.join('\n\n').slice(0, 3000);
    }

    // ---------------------------------------------------------------------
    // Panel rendering
    // ---------------------------------------------------------------------
    function renderFallback(reason) {
      panel.innerHTML = '';
      var close = document.createElement('button');
      close.className = 'pai-close';
      close.textContent = '×';
      close.addEventListener('click', function () { setPanelOpen(false); });
      panel.appendChild(close);

      var title = document.createElement('div');
      title.className = 'pai-title';
      title.textContent = 'ProfileAI';
      panel.appendChild(title);

      var body = document.createElement('div');
      body.className = 'pai-fallback';
      body.innerHTML = '<p style="margin:0 0 10px">' + reason + '</p>' +
        '<p style="margin:0; color:#6b7280">Try opening the actual application form page, or use the Chrome extension on desktop for full-site coverage.</p>';
      panel.appendChild(body);
      setPanelOpen(true);
    }

    function renderQuestions(questions) {
      panel.innerHTML = '';
      var close = document.createElement('button');
      close.className = 'pai-close';
      close.textContent = '×';
      close.addEventListener('click', function () { setPanelOpen(false); });
      panel.appendChild(close);

      var title = document.createElement('div');
      title.className = 'pai-title';
      title.textContent = 'ProfileAI';
      panel.appendChild(title);

      var sub = document.createElement('div');
      sub.className = 'pai-sub';
      sub.textContent = 'Found ' + questions.length + ' question' + (questions.length === 1 ? '' : 's') + ' on this page.';
      panel.appendChild(sub);

      var list = document.createElement('div');
      questions.forEach(function (q, i) {
        var row = document.createElement('div');
        row.className = 'pai-q';
        var qText = document.createElement('div');
        qText.className = 'pai-q-text';
        qText.textContent = q.question;
        var qStatus = document.createElement('div');
        qStatus.className = 'pai-q-status';
        qStatus.textContent = 'Not filled yet';
        qStatus.id = 'pai-status-' + i;
        row.appendChild(qText);
        row.appendChild(qStatus);
        list.appendChild(row);
      });
      panel.appendChild(list);

      var generateBtn = document.createElement('button');
      generateBtn.className = 'pai-btn pai-btn-primary';
      generateBtn.textContent = 'Generate AI answers';
      generateBtn.addEventListener('click', function () {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating…';
        fetch(API_BASE + '/api/bookmarklet/generate-answers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({
            questions: questions.map(function (q) { return q.question; }),
            questionMeta: questions.map(function (q) { return { fieldType: q.fieldType, options: q.options || [] }; }),
            jobDescription: guessJobDescription(),
          }),
        })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) {
              throw new Error(result.data && result.data.error ? result.data.error : 'Request failed');
            }
            var answers = result.data.answers || {};
            var filledCount = 0;
            // Sequential (not Promise.all): combobox fills open/close a menu,
            // and doing that for several fields at once can race.
            return questions.reduce(function (chain, q, i) {
              return chain.then(function () {
                var answer = answers[q.question];
                var statusEl = shadow.getElementById('pai-status-' + i);
                if (answer == null) {
                  if (statusEl) statusEl.textContent = 'No answer generated';
                  return;
                }
                return Promise.resolve()
                  .then(function () { return q.fill(answer); })
                  .catch(function () { return false; })
                  .then(function (ok) {
                    if (ok) {
                      filledCount++;
                      if (statusEl) { statusEl.textContent = 'Filled — review before submitting'; statusEl.classList.add('pai-filled'); }
                    } else if (statusEl) {
                      statusEl.textContent = 'Could not auto-fill — copy manually: "' + answer + '"';
                    }
                  });
              });
            }, Promise.resolve()).then(function () {
              generateBtn.textContent = 'Filled ' + filledCount + ' of ' + questions.length + ' — review & submit';
            });
          })
          .catch(function (err) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate AI answers';
            alert('ProfileAI could not generate answers: ' + err.message);
          });
      });
      panel.appendChild(generateBtn);

      var note = document.createElement('div');
      note.style.cssText = 'margin-top:8px; color:#9ca3af; font-size:11.5px;';
      note.textContent = 'Always review filled answers before you submit.';
      panel.appendChild(note);

      setPanelOpen(true);
    }

    var questions = detectQuestions();
    if (questions.length === 0) {
      renderFallback("ProfileAI couldn't recognize any application questions on this page.");
    } else {
      var hasComboboxes = questions.some(function (q) { return q.needsOptionScan; });
      if (hasComboboxes) {
        renderScanning();
        enrichComboboxQuestions(questions)
          .then(function () { renderQuestions(questions); })
          .catch(function () { renderQuestions(questions); });
      } else {
        renderQuestions(questions);
      }
    }
  } catch (err) {
    try {
      alert('ProfileAI ran into a problem on this page (' + (err && err.message ? err.message : 'unknown error') + '). Try the Chrome extension on desktop instead.');
    } catch (e) {
      // Even alert() can be blocked in some sandboxed contexts — nothing
      // further we can safely do.
    }
  }
})();
