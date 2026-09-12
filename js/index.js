'use strict';

console.log('[Fleet Parlour] index.js loaded');

document.addEventListener('DOMContentLoaded', function () {

  // =========================================================
  // 1. MOBILE NAVBAR
  // =========================================================

  const navToggle = document.querySelector(
    '.navbar-toggler.fp-menu-frame'
  );

  const navMain = document.getElementById('navMain');

  if (navToggle && navMain) {

    navToggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = navMain.classList.contains('show');

      if (isOpen) {
        navMain.classList.remove('show');
        navToggle.setAttribute('aria-expanded', 'false');
      } else {
        navMain.classList.add('show');
        navToggle.setAttribute('aria-expanded', 'true');
      }
    });


    // Close menu after clicking any navbar link on mobile
    navMain.querySelectorAll('a').forEach(function (link) {

      link.addEventListener('click', function () {

        if (window.innerWidth < 992) {

          navMain.classList.remove('show');

          navToggle.setAttribute(
            'aria-expanded',
            'false'
          );

        }

      });

    });


    // Close menu when browser changes back to desktop size
    window.addEventListener('resize', function () {

      if (window.innerWidth >= 992) {

        navMain.classList.remove('show');

        navToggle.setAttribute(
          'aria-expanded',
          'false'
        );

      }

    });

  }


  // =========================================================
  // 2. VIDEO CAROUSEL
  // =========================================================

  const gallery = document.querySelector(
    '.index-video-gallery'
  );

  if (gallery) {

    gallery.style.scrollBehavior = 'auto';

    gallery.scrollLeft = 0;

    let speed = 0.7;

    let paused = false;

    let resetInProgress = false;


    // Pause carousel when mouse is over it
    gallery.addEventListener(
      'mouseenter',
      function () {
        paused = true;
      }
    );


    // Resume when mouse leaves
    gallery.addEventListener(
      'mouseleave',
      function () {
        paused = false;
      }
    );


    // Pause while touching/swiping on mobile
    gallery.addEventListener(
      'touchstart',
      function () {
        paused = true;
      },
      {
        passive: true
      }
    );


    // Resume after mobile touch
    gallery.addEventListener(
      'touchend',
      function () {

        setTimeout(function () {
          paused = false;
        }, 1000);

      },
      {
        passive: true
      }
    );


    function moveCarousel() {

      const maxScroll =
        gallery.scrollWidth -
        gallery.clientWidth;


      if (
        !paused &&
        !resetInProgress &&
        maxScroll > 0
      ) {

        if (
          gallery.scrollLeft >=
          maxScroll - 2
        ) {

          resetInProgress = true;

          setTimeout(function () {

            gallery.scrollLeft = 0;

            setTimeout(function () {

              resetInProgress = false;

            }, 400);

          }, 700);

        } else {

          gallery.scrollLeft += speed;

        }

      }


      requestAnimationFrame(
        moveCarousel
      );

    }


    moveCarousel();

  }


  // =========================================================
  // 3. IMAGE FALLBACK FOR YOUTUBE THUMBNAILS
  // =========================================================

  const videoImages =
    document.querySelectorAll(
      '.index-video-gallery .video-box img'
    );


  videoImages.forEach(function (image) {

    image.addEventListener(
      'error',
      function () {

        const currentSource =
          image.getAttribute('src') || '';


        // Avoid endless fallback loop
        if (
          image.dataset.fallbackUsed === 'true'
        ) {
          return;
        }


        image.dataset.fallbackUsed =
          'true';


        const videoId =
          image.dataset.videoId ||
          ((currentSource.match(/\/vi\/([^/]+)\//) || [])[1]);

        if (videoId) {
          image.src =
            'https://img.youtube.com/vi/' +
            videoId +
            '/0.jpg';
        }

      }
    );

  });


  // =========================================================
  // 4. REVEAL ANIMATIONS
  // =========================================================

  const revealElements =
    document.querySelectorAll(
      '.reveal, .feature-card, .service-card, .before-after'
    );


  if (
    revealElements.length > 0 &&
    'IntersectionObserver' in window
  ) {

    const observer =
      new IntersectionObserver(
        function (entries) {

          entries.forEach(
            function (entry) {

              if (
                entry.isIntersecting
              ) {

                entry.target.classList.add(
                  'is-visible'
                );

                observer.unobserve(
                  entry.target
                );

              }

            }
          );

        },
        {
          threshold: 0.12
        }
      );


    revealElements.forEach(
      function (element) {

        observer.observe(
          element
        );

      }
    );

  } else {

    revealElements.forEach(
      function (element) {

        element.classList.add(
          'is-visible'
        );

      }
    );

  }

});
// =========================================================
// 5. LIVE SOCIAL FOLLOWERS + LIKES
// =========================================================
(function loadLiveSocialStats() {
  const socialCards = document.querySelectorAll('[data-social-platform]');
  if (!socialCards.length) return;

  const formatCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  };

  const formatExact = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-AU').format(n);
  };

      fetch('https://api.fleetparlour.com.au/api/social-stats', { headers: { Accept: 'application/json' } })    .then((response) => {
    .then((response) => {
      if (!response.ok) throw new Error('Social stats unavailable');
      return response.json();
    })
    .then((data) => {
      const platforms = data.platforms || {};

      socialCards.forEach((card) => {
        const platform = card.dataset.socialPlatform;
        const stats = platforms[platform] || {};
        const followersEl = card.querySelector('[data-social-followers]');
        const likesEl = card.querySelector('[data-social-likes]');

        if (stats.available) {
          card.classList.add('is-live');
          card.classList.remove('is-unavailable');
          if (followersEl) {
            followersEl.textContent = formatCount(stats.followers);
            followersEl.title = stats.followers == null ? '' : formatExact(stats.followers);
          }
          if (likesEl) {
            likesEl.textContent = formatCount(stats.likes);
            likesEl.title = stats.likes == null ? '' : formatExact(stats.likes);
          }
        } else {
          card.classList.add('is-unavailable');
          if (followersEl) followersEl.textContent = '—';
          if (likesEl) likesEl.textContent = '—';
        }
      });

      const totalFollowers = document.getElementById('totalSocialFollowers');
      const totalLikes = document.getElementById('totalSocialLikes');
      const status = document.getElementById('socialLiveStatus');

      if (totalFollowers) {
        totalFollowers.textContent = formatCount(data.totals?.followers);
        totalFollowers.title = data.totals?.followers == null ? '' : formatExact(data.totals.followers);
      }
      if (totalLikes) {
        totalLikes.textContent = formatCount(data.totals?.likes);
        totalLikes.title = data.totals?.likes == null ? '' : formatExact(data.totals.likes);
      }
      if (status) {
        const liveCount = Object.values(platforms).filter((item) => item?.available).length;
        if (liveCount > 0) {
          const when = data.updated_at ? new Date(data.updated_at).toLocaleString('en-AU') : 'recently';
          status.textContent = `Live social data • ${liveCount}/4 platforms connected • Updated ${when}`;
        } else {
          status.textContent = 'Live counters are ready. Connect the social API credentials in the backend to activate them.';
        }
      }
    })
    .catch(() => {
      const status = document.getElementById('socialLiveStatus');
      if (status) status.textContent = 'Live social counters are temporarily unavailable.';
    });
})();
