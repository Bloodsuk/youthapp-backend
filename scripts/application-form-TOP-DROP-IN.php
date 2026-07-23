<?php
/**
 * DROP-IN TOP for live application_form.php
 *
 * Replace the CURRENT top of application_form.php
 * (from <?php through the password gate / exit)
 * with EVERYTHING in this file.
 *
 * Keep your existing Application Form HTML/PHP BELOW this block.
 *
 * Important:
 * - Password input name on live site is: page_password
 * - Bypass helper file must be in the same folder
 */

session_start();
include 'conn.php';
include_once 'application-form-bypass-READY.php';
require_once 'contract-helpers.php';

$access_password = 'YRapplication1';

// 1) App signed-link bypass (5 minutes)
if (function_exists('yr_app_form_bypass_ok') && yr_app_form_bypass_ok()) {
    $_SESSION['yr_app_form_authed'] = true;
}

// 2) Manual password login (browser visitors)
if (
    empty($_SESSION['yr_app_form_authed']) &&
    isset($_POST['page_password']) &&
    hash_equals($access_password, (string) $_POST['page_password'])
) {
    $_SESSION['yr_app_form_authed'] = true;
}

// 3) Not authenticated → show password page and stop
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
// Authenticated below this line — keep your existing form body
// (the big Application Form content) UNDER this comment.
// ============================================================
