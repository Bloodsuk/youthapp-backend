<?php
/**
 * Drop-in helper for application_form password bypass (phleb app).
 *
 * Place near the top of application_form (before password gate).
 * Shared secret MUST match PHLEB_APPLICATION_FORM_BYPASS_SECRET
 * (or PARTNER_SSO_SECRET) on the Node API.
 *
 * App opens:
 *   /application_form?yr_app=1&yr_phleb_id=ID&yr_ts=UNIX&yr_email=EMAIL&yr_sig=HMAC
 */

if (!defined('YR_APP_FORM_BYPASS_SECRET')) {
    // TODO: set the same secret as Node env PHLEB_APPLICATION_FORM_BYPASS_SECRET
    define('YR_APP_FORM_BYPASS_SECRET', 'REPLACE_WITH_SHARED_SECRET');
}

if (!defined('YR_APP_FORM_BYPASS_TTL')) {
    define('YR_APP_FORM_BYPASS_TTL', 300); // 5 minutes
}

/**
 * @return bool true when request is a valid app bypass (skip password)
 */
function yr_app_form_bypass_ok(): bool {
    if (empty($_GET['yr_app']) || (string) $_GET['yr_app'] !== '1') {
        return false;
    }

    $phlebId = isset($_GET['yr_phleb_id']) ? (int) $_GET['yr_phleb_id'] : 0;
    $ts = isset($_GET['yr_ts']) ? (int) $_GET['yr_ts'] : 0;
    $email = isset($_GET['yr_email']) ? strtolower(trim((string) $_GET['yr_email'])) : '';
    $sig = isset($_GET['yr_sig']) ? (string) $_GET['yr_sig'] : '';

    if ($phlebId <= 0 || $ts <= 0 || $email === '' || $sig === '') {
        return false;
    }

    if (abs(time() - $ts) > YR_APP_FORM_BYPASS_TTL) {
        return false;
    }

    $payload = $phlebId . '.' . $ts . '.' . $email;
    $expected = hash_hmac('sha256', $payload, YR_APP_FORM_BYPASS_SECRET);

    return hash_equals($expected, $sig);
}

// Usage in application_form.php (example):
//
// require_once __DIR__ . '/application-form-bypass.php';
// if (yr_app_form_bypass_ok()) {
//     // skip password gate / mark session authenticated
//     $_SESSION['yr_app_form_authed'] = true;
// } elseif (empty($_SESSION['yr_app_form_authed'])) {
//     // existing password form for YRapplication1
// }
