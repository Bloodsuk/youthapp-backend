<?php
/**
 * Plugin Name: YR Phleb Partner SSO
 * Description: Affiliate partner login from Youth Revisited phlebotomist app (one-time SSO).
 * Version: 1.0.0
 * Author: Youth Revisited
 */

if (!defined('ABSPATH')) {
    exit;
}

define('YR_PARTNER_SSO_OPTION_SECRET', 'yr_partner_sso_secret');
define('YR_PARTNER_SSO_OPTION_API_BASE', 'yr_partner_sso_api_base');

/**
 * Settings: Settings → Partner SSO (set shared secret + Node API base URL).
 */
add_action('admin_init', function () {
    register_setting('yr_partner_sso', YR_PARTNER_SSO_OPTION_SECRET);
    register_setting('yr_partner_sso', YR_PARTNER_SSO_OPTION_API_BASE);
});

add_action('admin_menu', function () {
    add_options_page(
        'Partner SSO',
        'Partner SSO',
        'manage_options',
        'yr-partner-sso',
        function () {
            ?>
            <div class="wrap">
                <h1>YR Phleb Partner SSO</h1>
                <form method="post" action="options.php">
                    <?php settings_fields('yr_partner_sso'); ?>
                    <table class="form-table">
                        <tr>
                            <th><label for="<?php echo esc_attr(YR_PARTNER_SSO_OPTION_SECRET); ?>">Shared secret</label></th>
                            <td>
                                <input type="text" class="regular-text" name="<?php echo esc_attr(YR_PARTNER_SSO_OPTION_SECRET); ?>"
                                       value="<?php echo esc_attr(get_option(YR_PARTNER_SSO_OPTION_SECRET, '')); ?>" />
                                <p class="description">Must match PARTNER_SSO_SECRET on the Node API.</p>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="<?php echo esc_attr(YR_PARTNER_SSO_OPTION_API_BASE); ?>">Node API base</label></th>
                            <td>
                                <input type="url" class="regular-text" name="<?php echo esc_attr(YR_PARTNER_SSO_OPTION_API_BASE); ?>"
                                       value="<?php echo esc_attr(get_option(YR_PARTNER_SSO_OPTION_API_BASE, 'https://prapp.youth-revisited.co.uk/api')); ?>" />
                            </td>
                        </tr>
                    </table>
                    <?php submit_button(); ?>
                </form>
            </div>
            <?php
        }
    );
});

function yr_partner_sso_secret(): string {
    return (string) get_option(YR_PARTNER_SSO_OPTION_SECRET, '');
}

function yr_partner_sso_verify_request(WP_REST_Request $request): bool {
    $secret = yr_partner_sso_secret();
    if ($secret === '') {
        return false;
    }
    $header = $request->get_header('x-yr-partner-secret');
    return is_string($header) && hash_equals($secret, $header);
}

/**
 * Whether a partner/affiliate account exists for this email (passwords may differ from the app).
 */
function yr_partner_account_exists(string $email): bool {
    $email = sanitize_email($email);
    if ($email === '') {
        return false;
    }

    $user = get_user_by('email', $email);
    if (!$user) {
        return false;
    }

    if (function_exists('affwp_is_affiliate')) {
        return affwp_is_affiliate($user->ID);
    }

    $roles = (array) $user->roles;
    foreach (['affiliate', 'partner', 'affiliatewp_affiliate'] as $role) {
        if (in_array($role, $roles, true)) {
            return true;
        }
    }

    return false;
}

add_action('rest_api_init', function () {
    register_rest_route('yr/v1', '/affiliate-exists', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $request) {
            if (!yr_partner_sso_verify_request($request)) {
                return new WP_REST_Response(['error' => 'Unauthorized'], 401);
            }
            $email = sanitize_email((string) $request->get_param('email'));
            return new WP_REST_Response([
                'exists' => yr_partner_account_exists($email),
                'email' => $email,
            ], 200);
        },
    ]);
});

/**
 * Consume yr_sso token on partner-login page and sign the WP user in.
 */
add_action('template_redirect', function () {
    if (empty($_GET['yr_sso'])) {
        return;
    }

    $token = sanitize_text_field(wp_unslash($_GET['yr_sso']));
    if ($token === '') {
        return;
    }

    $api_base = rtrim((string) get_option(YR_PARTNER_SSO_OPTION_API_BASE, 'https://prapp.youth-revisited.co.uk/api'), '/');
    $secret = yr_partner_sso_secret();
    if ($secret === '') {
        wp_die('Partner SSO is not configured.');
    }

    $response = wp_remote_post($api_base . '/auth/partner-sso/consume', [
        'timeout' => 15,
        'headers' => [
            'Content-Type' => 'application/json',
            'X-YR-Partner-Secret' => $secret,
        ],
        'body' => wp_json_encode(['token' => $token]),
    ]);

    if (is_wp_error($response)) {
        wp_die('Could not verify sign-in link. Please log in manually.');
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);
    if ($code !== 200 || empty($body['success']) || empty($body['email'])) {
        wp_die(esc_html($body['error'] ?? 'Invalid or expired sign-in link.'));
    }

    $user = get_user_by('email', sanitize_email($body['email']));
    if (!$user) {
        wp_die('No partner account found for this email. Please register first.');
    }

    wp_clear_auth_cookie();
    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, true);
    do_action('wp_login', $user->user_login, $user);

    if (function_exists('affwp_get_affiliate_area_page_url')) {
        wp_safe_redirect(affwp_get_affiliate_area_page_url());
        exit;
    }

    wp_safe_redirect(home_url('/affiliate-area/'));
    exit;
});
