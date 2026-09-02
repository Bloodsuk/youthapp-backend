<?php
/**
 * Drop-in: make postal / postcode required on the phleb application form.
 *
 * Install on the practitioner site near the application form page/template:
 *   include_once __DIR__ . '/application-form-require-postcode.php';
 *
 * Or paste the <script> block before </body> on application_form.
 *
 * Targets common field names used on Youth Revisited forms:
 *   postcode, postal_code, home_postcode, zip, zipcode
 */
?>
<script>
(function () {
  function markRequired(input) {
    if (!input) return;
    input.setAttribute('required', 'required');
    input.setAttribute('aria-required', 'true');
    var label = null;
    if (input.id) {
      label = document.querySelector('label[for="' + input.id + '"]');
    }
    if (!label) {
      label = input.closest('label') || input.parentElement;
    }
    if (label && label.textContent && label.textContent.indexOf('*') === -1) {
      label.appendChild(document.createTextNode(' *'));
    }
  }

  function findPostcodeInputs(root) {
    var selectors = [
      'input[name*="postcode" i]',
      'input[name*="postal" i]',
      'input[id*="postcode" i]',
      'input[id*="postal" i]',
      'input[name="zip"]',
      'input[name="zipcode"]',
      'input[name="home_postcode"]'
    ];
    var found = [];
    selectors.forEach(function (sel) {
      try {
        root.querySelectorAll(sel).forEach(function (el) {
          if (found.indexOf(el) === -1) found.push(el);
        });
      } catch (e) {
        // Older browsers may not support case-insensitive attribute selectors.
      }
    });
    return found;
  }

  function enforce(form) {
    findPostcodeInputs(form).forEach(markRequired);
    form.addEventListener('submit', function (e) {
      var inputs = findPostcodeInputs(form);
      for (var i = 0; i < inputs.length; i++) {
        var value = (inputs[i].value || '').trim();
        if (!value) {
          e.preventDefault();
          inputs[i].focus();
          alert('Postal code is required so we can match you to jobs in your area.');
          return false;
        }
      }
      return true;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form').forEach(enforce);
  });
})();
</script>
