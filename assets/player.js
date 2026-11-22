/* Biomusics audio player.
 *
 * Progressive enhancement: every <figure class="bm-audio"> contains a plain
 * <audio controls> element, which works without JavaScript. This script replaces its
 * controls by the journal's player: round play button, waveform that doubles as the
 * seek bar (drawn in the site's colour gradient), time, mute.
 *
 * The waveform is computed in the browser from the audio file itself (Web Audio API).
 * If that is not possible (e.g. page opened from a local file), a neutral bar is shown.
 * Colours come from the CSS variables --c0 ... --cN written from config.yaml.
 */
(function () {
  'use strict';

  var ICON = {
    play:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" fill-opacity="1"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15 9.5l5 5M20 9.5l-5 5"/></svg>'
  };
  var all = [];

  function fmt(t) {
    if (!isFinite(t)) { return '0:00'; }
    t = Math.max(0, Math.round(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) { h = h.replace(/(.)/g, '$1$1'); }
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function palette() {
    var cs = getComputedStyle(document.documentElement), out = [], v, i;
    for (i = 0; i < 64; i++) {
      v = cs.getPropertyValue('--c' + i).trim();
      if (!v) { break; }
      out.push(hex(v));
    }
    return out.length > 1 ? out : [hex('#01620d'), hex('#ffc026')];
  }
  var PAL = null;
  function colorAt(t) {                              // t in [0,1] along the gradient
    var p = t * (PAL.length - 1), i = Math.min(Math.floor(p), PAL.length - 2), f = p - i, a = PAL[i], b = PAL[i + 1];
    return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(',') + ')';
  }

  function enhance(fig) {
    var audio = fig.querySelector('audio');
    if (!audio || fig.classList.contains('bm-ready')) { return; }
    if (!PAL) { PAL = palette(); }
    audio.removeAttribute('controls');
    audio.preload = 'metadata';
    fig.classList.add('bm-ready');

    var ui = document.createElement('div');
    ui.className = 'bm-player';
    ui.innerHTML =
      '<button type="button" class="bm-play" aria-label="Play">' + ICON.play + '</button>' +
      '<div class="bm-main">' +
        '<div class="bm-wave" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuenow="0">' +
          '<canvas></canvas></div>' +
        '<div class="bm-meta"><span class="bm-time">0:00</span>' +
          '<span class="bm-end"><span class="bm-dur">0:00</span>' +
          '<button type="button" class="bm-mute" aria-label="Mute">' + ICON.sound + '</button></span></div>' +
      '</div>';
    fig.insertBefore(ui, fig.firstChild);

    var btn = ui.querySelector('.bm-play'), wave = ui.querySelector('.bm-wave'),
        canvas = ui.querySelector('canvas'), time = ui.querySelector('.bm-time'),
        dur = ui.querySelector('.bm-dur'), mute = ui.querySelector('.bm-mute');
    var P = { audio: audio, peaks: null, raf: 0, dragging: false };

    function ratio() { return audio.duration ? audio.currentTime / audio.duration : 0; }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = wave.clientWidth, h = wave.clientHeight;
      if (!w || !h) { return; }
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var bw = 3, gap = 2, n = Math.max(12, Math.floor((w + gap) / (bw + gap))), r = ratio(), i, j;
      for (i = 0; i < n; i++) {
        var amp = 0.16;                               // neutral bar when no waveform is available
        if (P.peaks) {
          var a = Math.floor(i * P.peaks.length / n), b = Math.max(a + 1, Math.floor((i + 1) * P.peaks.length / n));
          amp = 0;
          for (j = a; j < b; j++) { amp = Math.max(amp, P.peaks[j]); }
        }
        var bh = Math.max(3, amp * (h - 6)), t = (i + 0.5) / n;
        ctx.fillStyle = t <= r ? colorAt(t) : 'rgba(93,102,115,.28)';
        var x = i * (bw + gap), y = (h - bh) / 2;
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(x, y, bw, bh, 1.5); } else { ctx.rect(x, y, bw, bh); }
        ctx.fill();
      }
    }
    function update() {
      time.textContent = fmt(audio.currentTime);
      dur.textContent = fmt(audio.duration);
      wave.setAttribute('aria-valuemax', Math.round(audio.duration || 0));
      wave.setAttribute('aria-valuenow', Math.round(audio.currentTime));
      wave.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' of ' + fmt(audio.duration));
      draw();
    }
    function loop() { update(); if (!audio.paused) { P.raf = requestAnimationFrame(loop); } }
    function setPlaying(on) {
      btn.innerHTML = on ? ICON.pause : ICON.play;
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      fig.classList.toggle('bm-playing', on);
    }
    function seek(clientX) {
      if (!isFinite(audio.duration)) { return; }
      var rect = wave.getBoundingClientRect();
      audio.currentTime = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * audio.duration;
      update();
    }

    btn.addEventListener('click', function () { if (audio.paused) { audio.play(); } else { audio.pause(); } });
    audio.addEventListener('play', function () {
      all.forEach(function (o) { if (o !== P && !o.audio.paused) { o.audio.pause(); } });   // one at a time
      setPlaying(true); cancelAnimationFrame(P.raf); loop();
    });
    audio.addEventListener('pause', function () { setPlaying(false); update(); });
    audio.addEventListener('ended', function () { setPlaying(false); audio.currentTime = 0; update(); });
    audio.addEventListener('loadedmetadata', update);
    audio.addEventListener('durationchange', update);
    audio.addEventListener('error', function () { fig.classList.add('bm-error'); time.textContent = 'Audio not available'; });

    wave.addEventListener('pointerdown', function (e) { P.dragging = true; wave.setPointerCapture(e.pointerId); seek(e.clientX); });
    wave.addEventListener('pointermove', function (e) { if (P.dragging) { seek(e.clientX); } });
    wave.addEventListener('pointerup', function () { P.dragging = false; });
    wave.addEventListener('pointercancel', function () { P.dragging = false; });
    wave.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5 }[e.key];
      if (d !== undefined) { audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + d)); update(); e.preventDefault(); }
      else if (e.key === 'Home') { audio.currentTime = 0; update(); e.preventDefault(); }
      else if (e.key === 'End' && audio.duration) { audio.currentTime = audio.duration - 0.01; update(); e.preventDefault(); }
    });
    mute.addEventListener('click', function () {
      audio.muted = !audio.muted;
      mute.innerHTML = audio.muted ? ICON.muted : ICON.sound;
      mute.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
    });
    if (window.ResizeObserver) { new ResizeObserver(draw).observe(wave); } else { window.addEventListener('resize', draw); }

    // waveform from the file itself (needs http(s); silently skipped otherwise)
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && window.fetch && /^https?:/.test(audio.src)) {
      fetch(audio.src).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var ac = new Ctx();
        return ac.decodeAudioData(buf).then(function (ab) { ac.close(); return ab; });
      }).then(function (ab) {
        var ch = ab.getChannelData(0), M = 240, step = Math.max(1, Math.floor(ch.length / M)),
            stride = Math.max(1, Math.floor(step / 64)), peaks = [], max = 0, i, j, v;
        for (i = 0; i < M; i++) {
          v = 0;
          for (j = i * step; j < Math.min(ch.length, (i + 1) * step); j += stride) { v = Math.max(v, Math.abs(ch[j])); }
          peaks.push(v); max = Math.max(max, v);
        }
        P.peaks = max > 0 ? peaks.map(function (p) { return p / max; }) : null;
        draw();
      }).catch(function () { /* keep the neutral bars */ });
    }
    all.push(P);
    update();
  }

  function init() { Array.prototype.forEach.call(document.querySelectorAll('figure.bm-audio'), enhance); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
