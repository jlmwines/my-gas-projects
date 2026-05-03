<?php
/**
 * SEO fixes — small overrides for RankMath × WPML edge cases.
 *
 * og:locale: RankMath emits the site's default locale (en_US) on HE
 * pages instead of he_IL. Hook RankMath's filter and return the
 * locale matching WPML's current language. Verified via spot-check
 * 2026-05-03: HE homepage had og:locale=en_US after WPML hreflang
 * was enabled; this filter completes the language-signal loop.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_filter('rank_math/opengraph/facebook/og_locale', function ($locale) {
    if (function_exists('icl_get_current_language')) {
        $lang = icl_get_current_language();
        if ($lang === 'he') return 'he_IL';
        if ($lang === 'en') return 'en_US';
    }
    return $locale;
}, 10, 1);
