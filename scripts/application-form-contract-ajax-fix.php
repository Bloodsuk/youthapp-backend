<?php
/**
 * Drop-in: harden Independent Contractor Agreement AJAX submit.
 *
 * Paste this file's <script> block immediately BEFORE </body> on
 * application_form.php (after the existing contract JS).
 *
 * Why users see "Could not reach the server":
 *   Returning applicants POST to submit-contract-only.php. The page's
 *   jQuery .fail() handler shows that generic alert for ANY non-JSON /
 *   network / HTTP failure (timeouts, oversized mobile photo+signatures,
 *   PHP HTML error pages, aborted requests).
 *
 * This patch:
 *  1) Forces root-absolute endpoints (/submit-contract-only.php, /verify-phleb-login.php)
 *  2) Intercepts returning-mode Save (capture phase) so we can compress signatures,
 *     block huge files, use a longer timeout, and show the real error text
 */
?>
<script>
(function () {
  if (!window.jQuery) return;

  var MAX_FILE_MB = 8;
  var SUBMIT_URL = '/submit-contract-only.php';
  var VERIFY_URL = '/verify-phleb-login.php';

  function dataUrlToCompressed(dataUrl, maxEdge, quality) {
    return new Promise(function (resolve) {
      try {
        if (!dataUrl || String(dataUrl).indexOf('data:image') !== 0) {
          resolve(dataUrl || '');
          return;
        }
        var img = new Image();
        img.onload = function () {
          var w = img.width || 1;
          var h = img.height || 1;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) {
        resolve(dataUrl || '');
      }
    });
  }

  function listOversizedFiles(root) {
    var tooBig = [];
    root.querySelectorAll('input[type=file]').forEach(function (input) {
      if (!input.files || !input.files.length) return;
      var f = input.files[0];
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        tooBig.push(f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)');
      }
    });
    return tooBig;
  }

  function failMessage(xhr) {
    var status = xhr && xhr.status ? xhr.status : 0;
    var raw = (xhr && xhr.responseText) ? String(xhr.responseText).trim() : '';
    var parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (parsed && parsed.message) return parsed.message;
    if (status === 0) {
      return 'Could not reach the server (network interrupted or timed out). Stay on this page, prefer Wi‑Fi, keep photos under ' + MAX_FILE_MB + ' MB, then try again.';
    }
    if (status === 413) {
      return 'Upload too large for the server. Compress photos/PDFs under ' + MAX_FILE_MB + ' MB and try again.';
    }
    if (raw && raw.length < 280 && raw.indexOf('<') === -1) return raw;
    return 'Could not reach the server (HTTP ' + status + '). Tap “Click Here”, verify email/password again, compress the CPD photo, and retry.';
  }

  // Absolute URLs for any remaining relative ajax calls (login + others).
  var origAjax = jQuery.ajax;
  jQuery.ajax = function (url, options) {
    var opts;
    if (typeof url === 'object') {
      opts = jQuery.extend(true, {}, url);
    } else {
      opts = jQuery.extend(true, {}, options || {}, { url: url });
    }
    if (opts && typeof opts.url === 'string') {
      if (opts.url === 'submit-contract-only.php') opts.url = SUBMIT_URL;
      if (opts.url === 'verify-phleb-login.php') opts.url = VERIFY_URL;
      if (opts.url === SUBMIT_URL) opts.timeout = opts.timeout || 180000;
      if (opts.url === VERIFY_URL) opts.timeout = opts.timeout || 60000;
    }
    return origAjax.call(jQuery, opts);
  };

  function canvasIsBlank(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // SignaturePad clears to transparent or white; treat near-empty as blank.
      for (var i = 0; i < data.length; i += 4) {
        var a = data[i + 3];
        if (a > 0) {
          // non-transparent pixel
          var r = data[i], g = data[i + 1], b = data[i + 2];
          if (r < 250 || g < 250 || b < 250) return false;
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function fillSigHidden() {
    var map = [
      ['contractor-signature-pad', '#contract_contractor_signature', true],
      ['declaration-signature-pad', '#contract_declaration_signature', true],
      ['bank-signature-pad', '#contract_bank_signature', true],
      ['youth-signature-pad', '#contract_youth_signature', false]
    ];
    for (var i = 0; i < map.length; i++) {
      var canvas = document.getElementById(map[i][0]);
      var sel = map[i][1];
      var required = map[i][2];
      if (!canvas) continue;
      if (canvasIsBlank(canvas)) {
        jQuery(sel).val('');
        if (required) {
          throw new Error(sel);
        }
      } else {
        jQuery(sel).val(canvas.toDataURL('image/png'));
      }
    }
  }

  function interceptReturningSave(ev) {
    if (!window.isReturningMode) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    var btn = document.getElementById('saveContractBtn');
    if (!btn) return;

    // Mirror original required-field checks quickly.
    var required = ['#contract_contractor_name', '#contract_phone', '#contract_address', '#contract_email'];
    for (var i = 0; i < required.length; i++) {
      if (!jQuery(required[i]).val() || !String(jQuery(required[i]).val()).trim()) {
        alert('Please fill in the Contractor Name, Phone, Address and Email at the top of Section 1 before saving.');
        return;
      }
    }
    var modal = document.getElementById('contractModal');
    var tooBig = listOversizedFiles(modal || document);
    if (tooBig.length) {
      alert('These files are too large (max ' + MAX_FILE_MB + ' MB each):\n\n' + tooBig.join('\n') + '\n\nCompress or retake at lower resolution, then try again.');
      return;
    }

    try {
      fillSigHidden();
    } catch (err) {
      var which = String(err && err.message || '');
      if (which.indexOf('contractor_signature') !== -1) {
        alert('Please provide the Contractor Signature in Section 1 before saving.');
      } else if (which.indexOf('declaration_signature') !== -1) {
        alert('Please provide the Contractor Signature in Section 3 (Declaration) before saving.');
      } else if (which.indexOf('bank_signature') !== -1) {
        alert('Please provide the Signature in Section 4 (Bank Details) before saving.');
      } else {
        alert('Please complete all required signatures before saving.');
      }
      return;
    }

    var $btn = jQuery(btn);
    $btn.prop('disabled', true).text('Processing... please wait for confirmation');

    var sigSels = [
      '#contract_contractor_signature',
      '#contract_declaration_signature',
      '#contract_bank_signature',
      '#contract_youth_signature'
    ];

    Promise.all(sigSels.map(function (sel) {
      return dataUrlToCompressed(jQuery(sel).val() || '', 800, 0.72).then(function (next) {
        jQuery(sel).val(next || '');
      });
    })).then(function () {
      var formData = new FormData();
      jQuery('#contractModal').find('input[name], select[name], textarea[name]').each(function () {
        if (this.type === 'file') {
          if (this.files && this.files.length) formData.append(this.name, this.files[0]);
        } else if (this.type === 'checkbox' || this.type === 'radio') {
          if (this.checked) formData.append(this.name, this.value);
        } else {
          formData.append(this.name, this.value);
        }
      });

      return jQuery.ajax({
        url: SUBMIT_URL,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        dataType: 'json',
        timeout: 180000
      }).done(function (res) {
        if (res && res.status === 'ok') {
          try {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('contractModal')).hide();
          } catch (e) {}
          alert(res.message || 'Thank you! Your contractor agreement has been submitted.');
          window.isReturningMode = false;
          window.returningApplicantData = null;
          if (typeof window.resetContractModalFields === 'function') {
            window.resetContractModalFields();
          }
        } else {
          alert((res && res.message) || 'Something went wrong. Please try again.');
        }
      }).fail(function (xhr) {
        alert(failMessage(xhr));
      });
    }).finally(function () {
      $btn.prop('disabled', false).text('Save Contract Details');
    });
  }

  function bind() {
    var btn = document.getElementById('saveContractBtn');
    if (!btn || btn.dataset.yrAjaxFix === '1') return;
    btn.dataset.yrAjaxFix = '1';
    // Capture phase beats the page's jQuery handler.
    btn.addEventListener('click', interceptReturningSave, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
</script>
