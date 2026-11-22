/* Main menu: stays at the top while scrolling, fades out after a short pause without scrolling.
   It comes back on scrolling, when the mouse goes to the top edge, and on keyboard focus.
   Without JavaScript the menu simply stays visible (position: sticky). */
(function () {
  var nav = document.querySelector('.mainnav');
  if (!nav) return;
  var IDLE_MS = 2500, timer = null, hovering = false;

  // The menu is "stuck" (floating over the page) once the masthead above it has scrolled out of view.
  // (nav.offsetTop cannot be used: for a sticky element it follows the scroll position.)
  var masthead = document.querySelector('.masthead');
  function stuck() {
    var limit = masthead ? masthead.offsetTop + masthead.offsetHeight : nav.offsetTop;
    return window.scrollY > limit + 4;
  }
  function show() { nav.classList.remove('nav-idle'); }
  function arm() {
    clearTimeout(timer);
    if (!stuck() || hovering) return;
    timer = setTimeout(function () {
      if (stuck() && !hovering && !nav.contains(document.activeElement)) nav.classList.add('nav-idle');
    }, IDLE_MS);
  }
  function onActivity() { show(); arm(); }

  window.addEventListener('scroll', onActivity, { passive: true });
  window.addEventListener('mousemove', function (e) { if (e.clientY < 70) onActivity(); }, { passive: true });
  window.addEventListener('touchstart', onActivity, { passive: true });
  nav.addEventListener('mouseenter', function () { hovering = true; show(); clearTimeout(timer); });
  nav.addEventListener('mouseleave', function () { hovering = false; arm(); });
  nav.addEventListener('focusin', function () { show(); clearTimeout(timer); });
  nav.addEventListener('focusout', arm);
})();
