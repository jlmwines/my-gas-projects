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
