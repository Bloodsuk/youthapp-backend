<?php
/**
 * FINAL AUTH TOP for application_form.php
 *
 * HOW TO USE (one file only):
 * 1. Open application_form.php
 * 2. Delete/replace the CURRENT top section only
 *    (from <?php / session_start() through the password page + exit)
 * 3. Paste THIS entire file content in its place
 * 4. Keep your existing Application Form body BELOW this block
 *
 * Do NOT replace the whole application_form.php — only the auth top.
 */

session_start();
include 'conn.php';
require_once 'contract-helpers.php';

$access_password = 'YRapplication1';

// Shared secret — must match Node API PARTNER_SSO_SECRET /
// PHLEB_APPLICATION_FORM_BYPASS_SECRET
$yr_app_form_bypass_secret = 'Nhchassc56-yTrf56syts-chtwqcscs56cees';
$yr_app_form_bypass_ttl = 300; // 5 minutes

/**
 * Valid app signed link?
 * /application_form?yr_app=1&yr_phleb_id=ID&yr_ts=UNIX&yr_email=EMAIL&yr_sig=HMAC
 */
function yr_app_form_bypass_ok(string $secret, int $ttl): bool {
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

    if (abs(time() - $ts) > $ttl) {
        return false;
    }

    $payload = $phlebId . '.' . $ts . '.' . $email;
    $expected = hash_hmac('sha256', $payload, $secret);

    return hash_equals($expected, $sig);
}

// 1) App signed-link bypass
if (yr_app_form_bypass_ok($yr_app_form_bypass_secret, $yr_app_form_bypass_ttl)) {
    $_SESSION['yr_app_form_authed'] = true;
}

// 2) Manual password (browser) — field name on live site is page_password
if (
    empty($_SESSION['yr_app_form_authed']) &&
    isset($_POST['page_password']) &&
    hash_equals($access_password, (string) $_POST['page_password'])
) {
    $_SESSION['yr_app_form_authed'] = true;
}

// 3) Not authenticated → password page
if (empty($_SESSION['yr_app_form_authed'])) {
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Protected Application Form</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-4">
      <h4 class="mb-3">Enter Password</h4>
      <form method="post">
        <div class="mb-3">
          <input type="password" name="page_password" class="form-control" placeholder="Password" required>
        </div>
        <button type="submit" class="btn btn-primary w-100">Access Application Form</button>
      </form>
    </div>
  </div>
</body>
</html>
    <?php
    exit;
}

// ============================================================
// AUTH OK — keep your existing Application Form content BELOW
// ============================================================
?>
