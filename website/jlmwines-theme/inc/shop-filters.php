<?php
/**
 * Catalog attribute filters — sidebar/accordion UI for intensity, complexity,
 * acidity. See website/CATALOG_FILTERS_PLAN.md for the design rationale.
 *
 * Exact-value model: each attribute filters to a single value N (not a
 * threshold). The visual still fills circles 1..N to rhyme with the PDP
 * description (where `●●●○○` means "this wine is at value 3"); selecting a
 * filter that visually matches the PDP pattern returns wines at that exact
 * value. URL serializes the single chosen term slug (e.g.
 * `filter_intensity=3-medium`) so WC's WC_Query::layered_nav_query() does
 * the actual filtering — single-value, no query_type override needed.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JLMWINES_FILTER_TAXONOMIES = ['pa_intensity', 'pa_complexity', 'pa_acidity'];
const JLMWINES_FILTER_SCALE_MAX  = 5;

/**
 * True on archive surfaces where filters should appear.
 */
function jlmwines_is_filterable_archive() {
    if (function_exists('is_shop') && is_shop()) {
        return true;
    }
    if (function_exists('is_product_taxonomy') && is_product_taxonomy()) {
        return true;
    }
    if (function_exists('is_search') && is_search() && get_query_var('post_type') === 'product') {
        return true;
    }
    return false;
}

/**
 * Render the shop filters block. Echoes nothing on non-archive pages, when
 * there are no products in the current archive context, or when none of the
 * attributes have variation worth filtering.
 */
function jlmwines_render_shop_filters() {
    if (!jlmwines_is_filterable_archive()) {
        return;
    }

    $base_ids = jlmwines_filter_archive_base_ids();
    if (empty($base_ids)) {
        return;
    }

    $groups_html = '';
    foreach (JLMWINES_FILTER_TAXONOMIES as $taxonomy) {
        $groups_html .= jlmwines_render_filter_group($taxonomy, $base_ids);
    }

    if ($groups_html === '') {
        return;
    }

    $aside_label = is_rtl() ? 'סינונים' : 'Filters';
    // If any filter is active on initial render, mark the mobile accordion
    // open so the user sees what they just selected without re-tapping.
    $any_active = false;
    foreach (JLMWINES_FILTER_TAXONOMIES as $taxonomy) {
        if (jlmwines_get_selected_value($taxonomy) !== null) {
            $any_active = true;
            break;
        }
    }
    $classes = 'shop-filters' . ($any_active ? ' is-open' : '');
    echo '<aside id="shop-filters" class="' . esc_attr($classes) . '" aria-label="' . esc_attr($aside_label) . '">'
        . $groups_html
        . '</aside>';
}

/**
 * IDs of all visible products in the current archive context, ignoring any
 * filter_* params. Used as the base population for filter calculations.
 */
function jlmwines_filter_archive_base_ids() {
    $args = [
        'post_type'      => 'product',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'post_status'    => 'publish',
        'no_found_rows'  => true,
        'tax_query'      => [
            [
                'taxonomy' => 'product_visibility',
                'field'    => 'name',
                'terms'    => ['exclude-from-catalog'],
                'operator' => 'NOT IN',
            ],
        ],
    ];

    if ('yes' === get_option('woocommerce_hide_out_of_stock_items')) {
        $args['tax_query'][] = [
            'taxonomy' => 'product_visibility',
            'field'    => 'name',
            'terms'    => ['outofstock'],
            'operator' => 'NOT IN',
        ];
    }

    if (function_exists('is_product_taxonomy') && is_product_taxonomy()) {
        $term = get_queried_object();
        if ($term && !is_wp_error($term)) {
            $args['tax_query'][] = [
                'taxonomy' => $term->taxonomy,
                'field'    => 'term_id',
                'terms'    => $term->term_id,
            ];
        }
    } elseif (function_exists('is_search') && is_search()) {
        $args['s'] = get_search_query();
    }

    return get_posts($args);
}

/**
 * Render one attribute's filter group. Returns markup as a string (empty if
 * the group should be suppressed — uniform attribute or none-tagged).
 */
function jlmwines_render_filter_group($taxonomy, $base_ids) {
    $near_ids = $base_ids;
    foreach (JLMWINES_FILTER_TAXONOMIES as $other) {
        if ($other === $taxonomy) {
            continue;
        }
        $other_value = jlmwines_get_selected_value($other);
        if ($other_value === null) {
            continue;
        }
        $other_slug = jlmwines_value_to_term_slug($other, $other_value);
        if ($other_slug === null) {
            return '';
        }
        $near_ids = jlmwines_intersect_with_terms($near_ids, $other, [$other_slug]);
        if (empty($near_ids)) {
            return '';
        }
    }

    $values_present = jlmwines_attr_value_set($near_ids, $taxonomy);
    if (count($values_present) <= 1) {
        return '';
    }

    // Exact-value count for each scale position 1..5.
    $counts = [];
    for ($v = 1; $v <= JLMWINES_FILTER_SCALE_MAX; $v++) {
        $slug = jlmwines_value_to_term_slug($taxonomy, $v);
        if ($slug === null) {
            $counts[$v] = 0;
            continue;
        }
        $matching   = jlmwines_intersect_with_terms($near_ids, $taxonomy, [$slug]);
        $counts[$v] = count($matching);
    }

    $selected = jlmwines_get_selected_value($taxonomy);
    $label    = jlmwines_attribute_display_name($taxonomy);

    ob_start();
    ?>
    <div class="shop-filter-group" data-taxonomy="<?php echo esc_attr($taxonomy); ?>">
        <h3 class="shop-filter-label"><?php echo esc_html($label); ?></h3>
        <div class="shop-filter-circles">
            <?php for ($v = 1; $v <= JLMWINES_FILTER_SCALE_MAX; $v++) :
                $is_disabled = ($counts[$v] === 0);
                // Visual rhymes with PDP: fill 1..N to indicate "value = N".
                $is_filled   = ($selected !== null && $v <= $selected);
                $is_selected = ($selected === $v);
                $classes     = ['shop-filter-circle'];
                if ($is_filled)   { $classes[] = 'is-filled'; }
                if ($is_disabled) { $classes[] = 'is-disabled'; }
                if ($is_selected) { $classes[] = 'is-selected'; }
                $glyph = $is_filled ? '●' : '○';

                if ($is_disabled) : ?>
                    <span class="<?php echo esc_attr(implode(' ', $classes)); ?>" aria-disabled="true"><?php echo $glyph; ?></span>
                <?php else :
                    $new_value  = $is_selected ? null : $v;
                    $url        = jlmwines_filter_url($taxonomy, $new_value);
                    $aria_label = $is_selected
                        ? sprintf(__('Clear %s filter', 'jlmwines'), $label)
                        : sprintf(__('Filter to %1$s %2$d', 'jlmwines'), $label, $v);
                    ?>
                    <a class="<?php echo esc_attr(implode(' ', $classes)); ?>" href="<?php echo esc_url($url); ?>" aria-label="<?php echo esc_attr($aria_label); ?>"><?php echo $glyph; ?></a>
                <?php endif; ?>
            <?php endfor; ?>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Read the selected scale value (1..5) for a taxonomy from the URL, or null
 * if cleared. URL holds the actual term slug (e.g. "3-medium"); we map it
 * back via the taxonomy's name → slug table.
 */
function jlmwines_get_selected_value($taxonomy) {
    $param = jlmwines_taxonomy_to_filter_param($taxonomy);
    if (empty($_GET[$param])) {
        return null;
    }
    $raw       = wp_unslash($_GET[$param]);
    $url_slugs = array_filter(array_map('trim', preg_split('/[,+]/', $raw)));
    if (empty($url_slugs)) {
        return null;
    }
    $slug_to_int = array_flip(jlmwines_filter_term_map($taxonomy));
    foreach ($url_slugs as $slug) {
        if (isset($slug_to_int[$slug])) {
            $v = $slug_to_int[$slug];
            return ($v >= 1 && $v <= JLMWINES_FILTER_SCALE_MAX) ? $v : null;
        }
    }
    return null;
}

function jlmwines_taxonomy_to_filter_param($taxonomy) {
    return 'filter_' . preg_replace('/^pa_/', '', $taxonomy);
}

/**
 * Map the integer scale position (1..5) to the actual term slug for this
 * taxonomy. Slugs vary per term — e.g. pa_intensity has "1" but "2-mild",
 * "3-medium", "4-intense", "5-very-intense". Term names are clean integers,
 * so we key the map by name.
 */
function jlmwines_filter_term_map($taxonomy) {
    static $cache = [];
    if (isset($cache[$taxonomy])) {
        return $cache[$taxonomy];
    }
    $terms = get_terms([
        'taxonomy'   => $taxonomy,
        'hide_empty' => false,
    ]);
    $map = [];
    if (!is_wp_error($terms) && is_array($terms)) {
        foreach ($terms as $term) {
            $n = (int) trim($term->name);
            if ($n >= 1 && $n <= JLMWINES_FILTER_SCALE_MAX) {
                $map[$n] = $term->slug;
            }
        }
    }
    $cache[$taxonomy] = $map;
    return $map;
}

/**
 * Real term slug for one scale position, or null if no such term exists in
 * the taxonomy (e.g. pa_complexity has no "1" term).
 */
function jlmwines_value_to_term_slug($taxonomy, $value) {
    $map = jlmwines_filter_term_map($taxonomy);
    return isset($map[(int) $value]) ? $map[(int) $value] : null;
}

/**
 * Build a URL with the given scale value applied to the taxonomy. Pass null
 * to clear. Pagination is dropped because filter changes invalidate page
 * numbers. Single-value semantics — no query_type override needed.
 *
 * Also clears any stale query_type_X param left over by previous (multi-slug)
 * filter URLs, so refreshing or sharing links stays clean.
 */
function jlmwines_filter_url($taxonomy, $value) {
    $param = jlmwines_taxonomy_to_filter_param($taxonomy);
    $qt    = 'query_type_' . preg_replace('/^pa_/', '', $taxonomy);
    $url   = remove_query_arg([$param, $qt, 'paged']);
    if ($value === null) {
        return $url;
    }
    $slug = jlmwines_value_to_term_slug($taxonomy, $value);
    if ($slug === null) {
        return $url;
    }
    return add_query_arg($param, $slug, $url);
}

/**
 * Distinct attribute term slugs present across the given product IDs.
 */
function jlmwines_attr_value_set($product_ids, $taxonomy) {
    if (empty($product_ids)) {
        return [];
    }
    global $wpdb;
    $taxonomy_esc   = esc_sql($taxonomy);
    $product_ids_in = implode(',', array_map('intval', $product_ids));
    $sql = "
        SELECT DISTINCT t.slug
        FROM {$wpdb->term_relationships} tr
        INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
        INNER JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
        WHERE tt.taxonomy = '{$taxonomy_esc}'
          AND tr.object_id IN ({$product_ids_in})
    ";
    return $wpdb->get_col($sql);
}

/**
 * Subset of $product_ids that are tagged with at least one of the given term
 * slugs in the given taxonomy.
 */
function jlmwines_intersect_with_terms($product_ids, $taxonomy, $term_slugs) {
    if (empty($product_ids) || empty($term_slugs)) {
        return [];
    }
    global $wpdb;
    $taxonomy_esc   = esc_sql($taxonomy);
    $product_ids_in = implode(',', array_map('intval', $product_ids));
    $term_slugs_in  = "'" . implode("','", array_map('esc_sql', $term_slugs)) . "'";
    $sql = "
        SELECT DISTINCT tr.object_id
        FROM {$wpdb->term_relationships} tr
        INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
        INNER JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
        WHERE tt.taxonomy = '{$taxonomy_esc}'
          AND t.slug IN ({$term_slugs_in})
          AND tr.object_id IN ({$product_ids_in})
    ";
    return array_map('intval', $wpdb->get_col($sql));
}

/**
 * Render the mobile filter-toggle button. Hooked at priority 22 (between
 * woocommerce_result_count at 20 and woocommerce_catalog_ordering at 30).
 * CSS hides the button at ≥900px (where the sidebar is always visible).
 *
 * The button toggles `.shop-filters.is-open`; main.js wires the handler.
 * Active filter count appears as a badge so users see filters are applied
 * even when the panel is collapsed.
 */
add_action('woocommerce_before_shop_loop', 'jlmwines_render_filter_toggle', 22);

function jlmwines_render_filter_toggle() {
    if (!jlmwines_is_filterable_archive()) {
        return;
    }
    $count = 0;
    foreach (JLMWINES_FILTER_TAXONOMIES as $taxonomy) {
        if (jlmwines_get_selected_value($taxonomy) !== null) {
            $count++;
        }
    }
    $label    = is_rtl() ? 'סינונים' : 'Filters';
    $expanded = $count > 0 ? 'true' : 'false';
    ?>
    <button type="button" class="shop-filter-toggle" aria-expanded="<?php echo esc_attr($expanded); ?>" aria-controls="shop-filters" data-shop-filter-toggle>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18M6 12h12M10 18h4"/>
        </svg>
        <span class="shop-filter-toggle-label"><?php echo esc_html($label); ?></span>
        <?php if ($count > 0) : ?>
            <span class="shop-filter-toggle-count" aria-label="<?php echo esc_attr(sprintf(is_rtl() ? '%d פעילים' : '%d active', $count)); ?>"><?php echo (int) $count; ?></span>
        <?php endif; ?>
    </button>
    <?php
}

/**
 * Render a "Clear filters" link in the WC results meta row when at least
 * one of our attribute filters is active. Hooked at priority 25 — between
 * woocommerce_result_count (20) and woocommerce_catalog_ordering (30) —
 * so it sits inline with WC's existing count and ordering controls.
 */
add_action('woocommerce_before_shop_loop', 'jlmwines_render_filter_clear_all', 25);

function jlmwines_render_filter_clear_all() {
    if (!jlmwines_is_filterable_archive()) {
        return;
    }
    $any_active = false;
    foreach (JLMWINES_FILTER_TAXONOMIES as $taxonomy) {
        if (jlmwines_get_selected_value($taxonomy) !== null) {
            $any_active = true;
            break;
        }
    }
    if (!$any_active) {
        return;
    }
    $params = ['paged'];
    foreach (JLMWINES_FILTER_TAXONOMIES as $taxonomy) {
        $params[] = jlmwines_taxonomy_to_filter_param($taxonomy);
        $params[] = 'query_type_' . preg_replace('/^pa_/', '', $taxonomy);
    }
    $url   = remove_query_arg($params);
    $label = is_rtl() ? 'אפס סינונים' : 'Clear filters';
    printf(
        '<a class="shop-filter-clear-all" href="%s">%s</a>',
        esc_url($url),
        esc_html($label)
    );
}

/**
 * Inline HE for the WC strings that surface in the catalog result-count
 * row. WC ships translations in language packs; this site isn't loading
 * the HE WC .mo (or it's incomplete), so the line shows in English on
 * RTL pages. WC's loop/result-count.php uses three separate i18n calls:
 *   • _e('Showing the single result', ...)        → `gettext`
 *   • __('Showing all %d results', ...)           → `gettext`
 *   • _nx(... 'with first and last result' ...)   → `ngettext_with_context`
 */
add_filter('gettext', function ($translation, $text, $domain) {
    if ($domain !== 'woocommerce' || !is_rtl()) {
        return $translation;
    }
    if ($text === 'Showing the single result') {
        return 'מציג תוצאה אחת';
    }
    if ($text === 'Showing all %d results') {
        return 'מציג את כל %d התוצאות';
    }
    return $translation;
}, 10, 3);
add_filter('ngettext_with_context', function ($translation, $single, $plural, $number, $context, $domain) {
    if ($domain !== 'woocommerce' || !is_rtl()) {
        return $translation;
    }
    if ($context !== 'with first and last result') {
        return $translation;
    }
    return $number === 1
        ? 'מציג תוצאה אחת'
        : 'מציג %1$d–%2$d מתוך %3$d תוצאות';
}, 10, 6);

/**
 * Attribute display name in the current language. wc_attribute_label() runs
 * the woocommerce_attribute_label filter, which WPML hooks for translation.
 *
 * Trailing parenthetical (e.g. "Intensity (1-5)" / "עוצמה (1-5)") is stripped
 * for the filter UI: the five visible circles already encode the scale, and
 * with exact-value selection "(1-5)" reads as "pick from a range" which the
 * filter no longer offers. Admin and other surfaces keep the full WC name.
 */
function jlmwines_attribute_display_name($taxonomy) {
    $label = $taxonomy;
    if (function_exists('wc_attribute_label')) {
        $wc_label = wc_attribute_label($taxonomy);
        if ($wc_label) {
            $label = $wc_label;
        }
    }
    return trim(preg_replace('/\s*\([^)]*\)\s*$/u', '', $label));
}
