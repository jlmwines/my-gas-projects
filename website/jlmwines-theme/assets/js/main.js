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
})();
