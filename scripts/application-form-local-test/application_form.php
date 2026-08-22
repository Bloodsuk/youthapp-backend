<?php
/**
 * Local test copy of application_form password gate + bypass.
 * Not the full live form — only auth flow for verification.
 */
session_start();

// Local stubs (live site has real conn.php / contract-helpers.php)
if (!file_exists(__DIR__ . '/conn.php')) {
    file_put_contents(__DIR__ . '/conn.php', "<?php\n// local stub\n");
}
if (!file_exists(__DIR__ . '/contract-helpers.php')) {
    file_put_contents(__DIR__ . '/contract-helpers.php', "<?php\n// local stub\n");
}

include 'conn.php';
include_once 'application-form-bypass-READY.php';
require_once 'contract-helpers.php';

$access_password = 'YRapplication1';

if (function_exists('yr_app_form_bypass_ok') && yr_app_form_bypass_ok()) {
    $_SESSION['yr_app_form_authed'] = true;
}

if (
    empty($_SESSION['yr_app_form_authed']) &&
    isset($_POST['page_password']) &&
    hash_equals($access_password, (string) $_POST['page_password'])
) {
    $_SESSION['yr_app_form_authed'] = true;
}

if (empty($_SESSION['yr_app_form_authed'])) {
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Protected Application Form</title>
</head>
<body>
  <h4>Enter Password</h4>
  <form method="post">
    <input type="password" name="page_password" required>
    <button type="submit">Access Application Form</button>
  </form>
</body>
</html>
    <?php
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Application Form</title>
</head>
<body>
  <h1>APPLICATION_FORM_OK</h1>
  <p>Authenticated successfully (bypass or password).</p>
</body>
</html>
