(function () {
    'use strict';

    // Sticky header — adds .is-scrolled when the user has scrolled past the threshold.
    var header = document.querySelector('.site-header');
    if (header) {
        var threshold = 16;
        var update = function () {
            if (window.scrollY > threshold) {
                header.classList.add('is-scrolled');
            } else {
                header.classList.remove('is-scrolled');
            }
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    // ─── Generic drawer pattern ────────────────────────────────────
    function bindDrawer(drawer, toggleBtn, openCb, closeCb) {
        var closers = drawer.querySelectorAll('[data-' + drawer.dataset.closeAttr + ']');
        var firstFocus = drawer.querySelector('.cart-drawer-close, .nav-drawer-close');

        var open = function () {
            drawer.classList.add('is-open');
            drawer.setAttribute('aria-hidden', 'false');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
            document.body.classList.add('drawer-open');
            if (firstFocus) firstFocus.focus();
            if (typeof openCb === 'function') openCb();
        };
        var close = function () {
            drawer.classList.remove('is-open');
            drawer.setAttribute('aria-hidden', 'true');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('drawer-open');
            if (toggleBtn) toggleBtn.focus();
            if (typeof closeCb === 'function') closeCb();
        };

        for (var i = 0; i < closers.length; i++) {
            closers[i].addEventListener('click', close);
        }

        return { open: open, close: close };
    }

    // ─── Nav drawer ─────────────────────────────────────────────────
    var navToggle = document.querySelector('.nav-toggle');
    var navDrawer = document.getElementById('nav-drawer');
    var navCtrl   = null;
    if (navToggle && navDrawer) {
        navDrawer.dataset.closeAttr = 'nav-drawer-close';
        navCtrl = bindDrawer(navDrawer, navToggle);
        navToggle.addEventListener('click', function () {
            if (navDrawer.classList.contains('is-open')) {
                navCtrl.close();
            } else {
                navCtrl.open();
            }
        });
    }

    // ─── Cart drawer ────────────────────────────────────────────────
    var cartDrawer = document.getElementById('cart-drawer');
    var cartCtrl   = null;
    if (cartDrawer) {
        cartDrawer.dataset.closeAttr = 'cart-drawer-close';
        cartCtrl = bindDrawer(cartDrawer, null);
    }

    // Cart-icon click → open drawer (delegate so refreshed fragments still work).
    document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-cart-drawer-open]');
        if (!link || !cartCtrl) return;
        e.preventDefault();
        cartCtrl.open();
    });

    // Bottom-nav search button → open nav drawer with the drawer's search input focused.
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-bottom-nav-search]');
        if (!btn || !navCtrl || !navDrawer) return;
        e.preventDefault();
        navCtrl.open();
        var input = navDrawer.querySelector('.nav-drawer-search input[type="search"]');
        if (input) {
            setTimeout(function () { input.focus(); }, 120);
        }
    });

    // Bottom-nav "Top" button → smooth scroll to viewport top.
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-bottom-nav-top]');
        if (!btn) return;
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ─── Floating add-to-cart bar (PDP) ────────────────────────────
    // Visibility logic: show only when (main CTA is OUT of view) AND (footer
    // is NOT in view). Hiding near the footer prevents the bar from
    // overlapping legal links and the newsletter form when the user scrolls
    // to the bottom of the page.
    var floatingCart = document.getElementById('floating-cart');
    var mainAddBtn   = document.querySelector('form.cart .single_add_to_cart_button');
    var siteFooter   = document.querySelector('.site-footer');
    if (floatingCart && mainAddBtn && 'IntersectionObserver' in window) {
        var mainInView   = false;
        var footerInView = false;

        var updateFcVisibility = function () {
            var show = !mainInView && !footerInView;
            floatingCart.classList.toggle('is-visible', show);
            floatingCart.setAttribute('aria-hidden', show ? 'false' : 'true');
        };

        var mainIo = new IntersectionObserver(function (entries) {
            mainInView = entries[0].isIntersecting;
            updateFcVisibility();
        }, { rootMargin: '0px 0px -20px 0px' });
        mainIo.observe(mainAddBtn);

        if (siteFooter) {
            var footerIo = new IntersectionObserver(function (entries) {
                footerInView = entries[0].isIntersecting;
                updateFcVisibility();
            });
            footerIo.observe(siteFooter);
        }

        var floatingAdd = floatingCart.querySelector('[data-floating-cart-add]');
        if (floatingAdd) {
            floatingAdd.addEventListener('click', function () {
                // Delegate to the main add-to-cart button so all WC flows fire
                // (variation validation, hooks, AJAX add). If the main button is
                // disabled (e.g. variation not selected), nothing happens.
                if (!mainAddBtn.disabled) {
                    mainAddBtn.click();
                }
            });
        }
    }

    // ─── Global ESC closes whichever drawer is open ────────────────
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (cartCtrl && cartDrawer && cartDrawer.classList.contains('is-open')) {
            cartCtrl.close();
            return;
        }
        if (navCtrl && navDrawer && navDrawer.classList.contains('is-open')) {
            navCtrl.close();
        }
    });

    // ─── Mini-cart qty AJAX ─────────────────────────────────────────
    function getEndpoint(name) {
        if (typeof window.jlmwinesParams !== 'object' || !window.jlmwinesParams.wcAjaxUrl) {
            return null;
        }
        return window.jlmwinesParams.wcAjaxUrl.replace('%%endpoint%%', name);
    }

    function applyFragments(fragments) {
        if (!fragments) return;
        Object.keys(fragments).forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);
            for (var i = 0; i < nodes.length; i++) {
                var temp = document.createElement('div');
                temp.innerHTML = fragments[selector];
                var replacement = temp.firstElementChild;
                if (replacement) {
                    nodes[i].parentNode.replaceChild(replacement, nodes[i]);
                }
            }
        });
    }

    function updateQty(cartItemKey, qty) {
        var url = getEndpoint('jlmwines_update_qty');
        if (!url) return;

        var body = new URLSearchParams();
        body.append('cart_item_key', cartItemKey);
        body.append('qty', String(qty));

        fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' },
            body: body
        })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) return;
                applyFragments(json.data && json.data.fragments);
            })
            .catch(function () { /* swallow — UI stays as-is */ });
    }

    // Delegated handlers so re-rendered fragments keep working.
    document.addEventListener('click', function (e) {
        // Qty +/- buttons inside the cart drawer.
        var btn = e.target.closest('.mini-cart-qty-btn');
        if (btn) {
            e.preventDefault();
            var row = btn.closest('[data-cart-item-key]');
            if (!row) return;
            var key = row.dataset.cartItemKey;
            var step = parseInt(btn.dataset.qtyStep, 10) || 0;
            var valueEl = row.querySelector('.mini-cart-qty-value');
            var current = valueEl ? parseInt(valueEl.textContent, 10) : 0;
            var next = Math.max(0, current + step);
            updateQty(key, next);
            return;
        }

        // Remove (×) link inside the cart drawer — AJAXify so the drawer stays open.
        var rm = e.target.closest('.mini-cart-item-remove');
        if (rm && rm.closest('.cart-drawer')) {
            e.preventDefault();
            var rmKey = rm.getAttribute('data-cart_item_key');
            if (rmKey) updateQty(rmKey, 0);
        }
    });
})();

// ─── Carousel arrows for product carousels ──────────────────────────
// Each .section-product-grid-wrap contains prev/next buttons and the
// scrolling grid. Click scrolls the grid by one card's width.
// Buttons are hidden by default on desktop via CSS; visible only when
// the grid is in carousel mode (gifts page on mobile).
(function () {
    document.querySelectorAll('.section-product-grid-wrap').forEach(function (wrap) {
        var grid = wrap.querySelector('.section-product-grid');
        var prev = wrap.querySelector('.carousel-arrow-prev');
        var next = wrap.querySelector('.carousel-arrow-next');
        if (!grid || !prev || !next) return;

        function step(dir) {
            var card = grid.querySelector('.product');
            if (!card) return;
            var styles = getComputedStyle(grid);
            var gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
            var distance = card.offsetWidth + gap;
            grid.scrollBy({ left: dir * distance, behavior: 'smooth' });
        }
        prev.addEventListener('click', function () { step(-1); });
        next.addEventListener('click', function () { step(1); });
    });
})();

// ─── Carousel arrows for testimonials ───────────────────────────────
// Mirrors the product carousel pattern. Card width drives scroll step;
// 3-up on desktop, 1-up on mobile (CSS-controlled).
(function () {
    document.querySelectorAll('.section-testimonials-wrap').forEach(function (wrap) {
        var grid = wrap.querySelector('.testimonials-grid');
        var prev = wrap.querySelector('.carousel-arrow-prev');
        var next = wrap.querySelector('.carousel-arrow-next');
        if (!grid || !prev || !next) return;

        function step(dir) {
            var card = grid.querySelector('.testimonial');
            if (!card) return;
            var styles = getComputedStyle(grid);
            var gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
            var distance = card.offsetWidth + gap;
            grid.scrollBy({ left: dir * distance, behavior: 'smooth' });
        }
        prev.addEventListener('click', function () { step(-1); });
        next.addEventListener('click', function () { step(1); });
    });
})();

// Mobile nav drawer — accordion-collapse top-level items that have submenus.
// Default state: collapsed. Tap chevron toggles. Tapping the link itself
// still navigates (no preventDefault on the link). Chevron is added by JS
// so the markup stays standard wp_nav_menu output.
(function () {
    var menu = document.querySelector('.nav-drawer-panel .nav-drawer-menu');
    if (!menu) return;
    var isHe = document.documentElement.dir === 'rtl' ||
               (document.documentElement.lang || '').toLowerCase().indexOf('he') === 0;
    var expandLabel   = isHe ? 'הרחב' : 'Expand';
    var collapseLabel = isHe ? 'כווץ' : 'Collapse';

    menu.querySelectorAll('.menu-item-has-children').forEach(function (item) {
        if (item.querySelector(':scope > .nav-drawer-toggle')) return;
        var sub = item.querySelector(':scope > .sub-menu');
        if (!sub) return;

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-drawer-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', expandLabel);
        toggle.innerHTML = '<svg width="14" height="14" aria-hidden="true"><use href="#i-chevron-down"/></svg>';
        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            var open = item.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? collapseLabel : expandLabel);
        });
        item.appendChild(toggle);
    });
})();

// Catalog filter toggle (mobile). Click the filter button in the WC
// results meta row to expand/collapse the .shop-filters panel inline.
(function () {
    var toggle = document.querySelector('[data-shop-filter-toggle]');
    if (!toggle) return;
    var panel = document.getElementById('shop-filters');
    if (!panel) return;
    toggle.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
})();


// Pojo Accessibility (ea11y) widget — reposition the floating button to
// sit on the same horizontal "shelf" as the WhatsApp float, on the
// opposite (inline-start) side. The widget renders inside an open shadow
// DOM, so page CSS can't reach the button; we set the inline style
// directly through host.shadowRoot. Plugin's own inline style sets
// `bottom: 24px !important; left: 24px !important;` — we override both
// with our shelf values via CSSStyleDeclaration.setProperty(name, value, 'important').
(function () {
    var HOST_ID = 'ea11y-root';
    var BUTTON_SEL = '.ea11y-widget-open-button';
    var GUTTER = '20px';
    var DESKTOP_BOTTOM = '30px';
    // Sits inside the bottom-nav row on mobile (the bottom-nav has an
    // empty spacer slot reserved on this side so the icon lands here
    // without overlapping a real nav item).
    var MOBILE_BOTTOM = 'calc(14px + env(safe-area-inset-bottom, 0))';
    var MOBILE_BREAK = 720;

    function applyPosition() {
        var host = document.getElementById(HOST_ID);
        if (!host || !host.shadowRoot) return false;
        var btn = host.shadowRoot.querySelector(BUTTON_SEL);
        if (!btn) return false;

        var isHe = document.documentElement.dir === 'rtl' ||
                   (document.documentElement.lang || '').toLowerCase().indexOf('he') === 0;
        var isMobile = window.innerWidth < MOBILE_BREAK;
        var bottom = isMobile ? MOBILE_BOTTOM : DESKTOP_BOTTOM;

        btn.style.setProperty('bottom', bottom, 'important');
        btn.style.setProperty('top', 'auto', 'important');
        // LTR: ea11y on left (inline-start), WhatsApp on right (inline-end)
        // RTL: ea11y on right (inline-start of RTL), WhatsApp on left
        btn.style.setProperty('left', isHe ? 'auto' : GUTTER, 'important');
        btn.style.setProperty('right', isHe ? GUTTER : 'auto', 'important');
        return true;
    }

    // Try immediately; if the widget isn't mounted yet, watch for it.
    if (applyPosition()) {
        window.addEventListener('resize', applyPosition);
        return;
    }

    var observer = new MutationObserver(function (_mutations, obs) {
        if (applyPosition()) {
            obs.disconnect();
            window.addEventListener('resize', applyPosition);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety: stop observing after 30s even if the widget never appeared.
    setTimeout(function () { observer.disconnect(); }, 30000);
})();

// Mailchimp signup forms — JSONP submit to Mailchimp's post-json endpoint so
// the subscriber stays on jlmwines.com. Replaces each form with an inline
// success/error message in the current language. JS-disabled fallback: form
// submits to Mailchimp's hosted page in a new tab (target="_blank" attribute).
// Binds every [data-mc-form] on the page independently (footer band, offer
// popup) — not just the first — so each has its own working submit handler.
(function () {
    var forms = document.querySelectorAll('form[data-mc-form]');
    if (!forms.length) return;
    if (typeof FormData === 'undefined') return; // very old browser → fallback

    var isHe = document.documentElement.dir === 'rtl' ||
               (document.documentElement.lang || '').toLowerCase().indexOf('he') === 0;

    var copy = isHe ? {
        success: 'תודה! בדקו את המייל לאישור הרשמה.',
        already: 'אתם כבר רשומים. תודה!',
        error:   'משהו השתבש. נסו שוב או בדקו את הכתובת.'
    } : {
        success: 'Thanks! Check your email to confirm your subscription.',
        already: "You're already subscribed. Thanks!",
        error:   'Something went wrong. Please try again or check the address.'
    };

    forms.forEach(function (form) {
        var msgEl = form.parentElement.querySelector('[data-mc-msg]');
        if (!msgEl) return;

        function showMsg(text) {
            msgEl.textContent = text;
            msgEl.hidden = false;
            form.hidden = true;
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var params = [];
            new FormData(form).forEach(function (value, key) {
                params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            });

            var jsonUrl = form.action.replace('/subscribe/post', '/subscribe/post-json');
            var cbName  = 'jlmwinesMcCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
            params.push('c=' + cbName);

            var script = document.createElement('script');

            function cleanup() {
                try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
                if (script.parentNode) script.parentNode.removeChild(script);
            }

            window[cbName] = function (resp) {
                if (resp && resp.result === 'success') {
                    showMsg(copy.success);
                } else if (resp && /already subscribed/i.test(resp.msg || '')) {
                    showMsg(copy.already);
                } else {
                    showMsg(copy.error);
                }
                cleanup();
            };

            script.src = jsonUrl + (jsonUrl.indexOf('?') === -1 ? '?' : '&') + params.join('&');
            script.onerror = function () {
                showMsg(copy.error);
                cleanup();
            };
            document.body.appendChild(script);
        });
    });
})();

// Bundle edit-quantity hint — dismiss + persist. The hint markup is injected
// by a WC hook on bundle product pages; its behavior lives here (not inline in
// the markup) because the site's JS optimizer strips inline <script> in that
// position. localStorage keeps it dismissed across bundle pages.
(function () {
    var KEY = 'jlm_bundle_hint_dismissed';
    var hint = document.getElementById('bundle-edit-hint');
    if (!hint) return;
    try {
        if (localStorage.getItem(KEY) === '1') { hint.style.display = 'none'; return; }
    } catch (e) {}
    hint.addEventListener('click', function (e) {
        if (e.target.closest('[data-bundle-hint-dismiss]')) {
            hint.style.display = 'none';
            try { localStorage.setItem(KEY, '1'); } catch (e2) {}
        }
    });
})();

// New-visitor offer popup — two triggers, one modal (rendered server-side
// by inc/exit-intent-popup.php, hidden until shown here). Desktop: exit
// intent (cursor toward the browser chrome). Mobile: delayed on-load.
// Both share the same 7-day, language-agnostic dismiss cookie — matches
// jlmwines_age_verified's cookie approach (path=/, no localStorage) so
// page caching still serves one HTML payload to everyone.
// Plan: website/EXIT_INTENT_POPUP_PLAN.md
(function () {
    var COOKIE = 'jlmwines_exit_popup_dismissed';
    var DAYS = 7;
    var MOBILE_BREAK = 720; // matches the ea11y/bottom-nav breakpoint elsewhere in this file
    var MOBILE_DELAY_MS = 4000;

    var popup = document.getElementById('offer-popup');
    if (!popup) return; // logged-in / cart / checkout / thank-you — PHP didn't render it

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }
    function setCookie(name, value, days) {
        var d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;samesite=lax';
    }

    if (getCookie(COOKIE) === '1') return;

    function show() {
        if (getCookie(COOKIE) === '1') return; // dismissed by the time the trigger fired
        popup.removeAttribute('hidden');
        document.body.classList.add('offer-popup-open');
    }
    function dismiss() {
        setCookie(COOKIE, '1', DAYS);
        popup.setAttribute('hidden', '');
        document.body.classList.remove('offer-popup-open');
    }

    popup.querySelector('[data-offer-popup-close]').addEventListener('click', dismiss);
    popup.querySelector('[data-offer-popup-overlay]').addEventListener('click', dismiss);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !popup.hasAttribute('hidden')) dismiss();
    });

    // Copy-code button — copies the coupon code instead of navigating.
    // Labels (already language-correct from PHP) come off the button's
    // own data attributes rather than duplicating is_rtl() logic here.
    var copyBtn = popup.querySelector('[data-offer-popup-copy-code]');
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            var code = copyBtn.getAttribute('data-offer-popup-copy-code');

            function onCopied() {
                copyBtn.textContent = copyBtn.getAttribute('data-copied-label');
                setTimeout(function () {
                    copyBtn.textContent = copyBtn.getAttribute('data-copy-label');
                }, 2000);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(code).then(onCopied, function () { fallbackCopy(code, onCopied); });
            } else {
                fallbackCopy(code, onCopied);
            }
        });
    }

    function fallbackCopy(text, done) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
    }

    // Don't compete with the age gate — wait until it's resolved (cookie
    // set, or it was never shown for a logged-in visitor) before arming
    // either trigger. Short poll rather than an event, since age-gate.php
    // doesn't fire a custom event on resolve.
    function armTriggers() {
        if (window.innerWidth < MOBILE_BREAK) {
            setTimeout(show, MOBILE_DELAY_MS);
        } else {
            // mouseleave bound to document.documentElement, not document —
            // document itself doesn't reliably fire Element-boundary mouse
            // events, which was silently preventing this trigger from ever
            // firing (found 2026-08-20 via live testing).
            document.documentElement.addEventListener('mouseleave', function onLeave(e) {
                if (e.clientY > 0) return;
                document.documentElement.removeEventListener('mouseleave', onLeave);
                show();
            });
        }
    }

    function waitForAgeGate(attemptsLeft) {
        if (getCookie('jlmwines_age_verified') === '1' || !document.body.classList.contains('age-gate-locked')) {
            armTriggers();
            return;
        }
        if (attemptsLeft <= 0) return; // age gate never resolved this visit — don't arm
        setTimeout(function () { waitForAgeGate(attemptsLeft - 1); }, 300);
    }
    waitForAgeGate(100); // ~30s cap, matches the ea11y widget's own safety timeout elsewhere in this file
})();
