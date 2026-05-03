<?php
/**
 * Age verification modal — required for Israeli alcohol-retail compliance.
 *
 * Renders a bilingual full-screen modal at wp_footer. Strings are inline
 * conditional on WPML language — HE for Hebrew pages, EN for English.
 * Persistence is a single cookie (`jlmwines_age_verified=1`, 30 days),
 * language-agnostic so verifying once works across language switches.
 *
 * JS-only show/hide so page caching (SG Optimizer) serves the same HTML
 * to all visitors; verification state is checked client-side. Logged-in
 * users (have-ordered customers) auto-skip via the body.logged-in class
 * that WordPress adds — sets the cookie on first page load and never
 * shows the modal.
 *
 * "No" → redirect to google.com (standard practice for declined visits).
 *
 * Z-index 10000 to sit above bottom-nav (90), WhatsApp float (95),
 * cart drawer, and the Complianz consent banner.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_age_gate() {
    $is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';

    $headline = $is_he ? 'לפני שנתחיל...' : 'Before we begin...';
    $question = $is_he ? 'כבר חגגת 18?' : 'Are you 18?';
    $body     = $is_he ? 'הכניסה לאתר זה מיועדת לבני 18 ומעלה.' : 'Entry to this website is intended for those 18 or older.';
    $warning  = $is_he ? 'אזהרה: צריכה מופרזת של אלכוהול מסכנת חיים ומזיקה לבריאות.' : 'Warning: Excessive consumption of alcohol is life-threatening and harmful to health.';
    $yes      = $is_he ? 'כן' : 'Yes';
    $no       = $is_he ? 'לא' : 'No';

    // White-bg JLM stamp (in media library); same image used for favicon and schema logo
    $logo_url = 'https://jlmwines.com/wp-content/uploads/2025/03/jlm-wines-600-white-solid.jpg';
    ?>
    <div class="age-gate" id="age-gate" hidden>
        <div class="age-gate-overlay" data-age-gate-overlay></div>
        <div class="age-gate-modal" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
            <img class="age-gate-logo" src="<?php echo esc_url($logo_url); ?>" alt="JLM Wines" width="96" height="96">
            <h2 class="age-gate-headline" id="age-gate-title"><?php echo esc_html($headline); ?></h2>
            <p class="age-gate-question"><?php echo esc_html($question); ?></p>
            <div class="age-gate-actions">
                <button type="button" class="age-gate-no" data-age-gate-no><?php echo esc_html($no); ?></button>
                <button type="button" class="age-gate-yes" data-age-gate-yes><?php echo esc_html($yes); ?></button>
            </div>
            <p class="age-gate-body"><?php echo esc_html($body); ?></p>
            <p class="age-gate-warning"><?php echo esc_html($warning); ?></p>
        </div>
    </div>
    <script>
    (function() {
        var COOKIE = 'jlmwines_age_verified';
        var DAYS = 30;
        function getCookie(name) {
            var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : null;
        }
        function setCookie(name, value, days) {
            var d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;samesite=lax';
        }
        // Auto-verify logged-in users (they've already passed at some point)
        if (document.body.classList.contains('logged-in')) {
            if (getCookie(COOKIE) !== '1') {
                setCookie(COOKIE, '1', DAYS);
            }
            return;
        }
        if (getCookie(COOKIE) === '1') {
            return;
        }
        var gate = document.getElementById('age-gate');
        if (!gate) {
            return;
        }
        gate.removeAttribute('hidden');
        document.body.classList.add('age-gate-locked');
        gate.querySelector('[data-age-gate-yes]').addEventListener('click', function() {
            setCookie(COOKIE, '1', DAYS);
            gate.setAttribute('hidden', '');
            document.body.classList.remove('age-gate-locked');
        });
        gate.querySelector('[data-age-gate-no]').addEventListener('click', function() {
            window.location.href = 'https://www.google.com/';
        });
    })();
    </script>
    <?php
}
add_action('wp_footer', 'jlmwines_render_age_gate', 5);
