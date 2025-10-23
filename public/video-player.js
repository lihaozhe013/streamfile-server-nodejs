/* global videojs */
(function () {
  function getQuery(k) {
    const p = new URLSearchParams(location.search);
    return p.get(k) || "";
  }
  // The backend serves this HTML at /files/<path> when media extension and no raw=1
  // We need to reconstruct the actual media file URL so we can stream it directly with range requests.
  // Original requested path is after /files/ in the pathname.
  function extractMediaPath() {
    const idx = location.pathname.indexOf("/files/");
    if (idx === -1) return "";
    // Keep everything after /files/
    return decodeURIComponent(location.pathname.substring(idx + 7));
  }

  const relPath = extractMediaPath();
  const fileTitleEl = document.getElementById("fileTitle");
  const appContainer = document.getElementById("app-container");
  const headerEl = document.getElementById("playerHeader");
  const supportsHover =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover)").matches
      : true;

  if (fileTitleEl) fileTitleEl.textContent = relPath || "Media";
  // Keep document title in sync with displayed filename
  document.title = relPath || "Media";

  if (appContainer && !appContainer.dataset.chrome) {
    appContainer.dataset.chrome = "visible";
  }

  const mediaUrl =
    "/files/" + relPath + (relPath.includes("?") ? "&" : "?") + "raw=1";

  // Decide if audio-only
  const lower = relPath.toLowerCase();
  const isAudio = /\.(mp3|wav|ogg|m4a|flac|aac)$/.test(lower);

  const videoEl = document.getElementById("videoPlayer");
  if (isAudio) {
    videoEl.classList.add("vjs-audio");
    videoEl.style.position = "relative";
    videoEl.style.width = "720px";
    videoEl.style.maxWidth = "100%";
    videoEl.style.height = "auto";
    videoEl.style.left = "50%";
    videoEl.style.top = "50%";
    videoEl.style.transform = "translate(-50%, -50%)";
  } else {
    videoEl.setAttribute("playsinline", "");
    // For video, fill the entire container
    videoEl.style.width = "100%";
    videoEl.style.height = "100%";
    videoEl.style.objectFit = "contain";
    videoEl.style.position = "absolute";
    videoEl.style.top = "0";
    videoEl.style.left = "0";
  }

  // Provide source – rely on server Content-Type
  const sourceEl = document.createElement("source");
  sourceEl.src = mediaUrl;
  sourceEl.type = guessType(lower);
  videoEl.appendChild(sourceEl);

  const player = videojs(videoEl, {
    controls: true,
    preload: "auto",
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    fluid: false,
    fill: true,
    userActions: { hotkeys: false },
    controlBar: {
      volumePanel: { inline: false, vertical: true },
    },
  });

  const setChromeVisible = () => {
    if (supportsHover && appContainer) {
      appContainer.dataset.chrome = "visible";
    }
  };

  const setChromeHidden = () => {
    if (supportsHover && appContainer) {
      appContainer.dataset.chrome = "hidden";
    }
  };

  const nudgePlayerActive = () => {
    player.userActive(true);
  };

  if (supportsHover && appContainer) {
    player.on("useractive", setChromeVisible);
    player.on("userinactive", setChromeHidden);
    player.on("play", setChromeVisible);
    player.on("pause", setChromeVisible);
    player.on("fullscreenchange", setChromeVisible);

    if (headerEl) {
      ["mousemove", "mouseenter", "touchstart"].forEach((evt) => {
        headerEl.addEventListener(
          evt,
          () => {
            setChromeVisible();
            nudgePlayerActive();
          },
          { passive: true }
        );
      });
    }
  }

  // Keyboard shortcuts: Left / Right = 5s seek, Space = toggle, F = fullscreen
  document.addEventListener("keydown", (e) => {
    // Ignore if focused inside input/textarea/contentEditable
    const tag = document.activeElement && document.activeElement.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (document.activeElement && document.activeElement.isContentEditable)
    )
      return;

    const seekStep = 5; // seconds
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setChromeVisible();
        nudgePlayerActive();
        player.currentTime(Math.max(0, player.currentTime() - seekStep));
        flashSeek("-" + seekStep + "s");
        break;
      case "ArrowRight":
        e.preventDefault();
        setChromeVisible();
        nudgePlayerActive();
        player.currentTime(
          Math.min(
            player.duration() || Infinity,
            player.currentTime() + seekStep
          )
        );
        flashSeek("+" + seekStep + "s");
        break;
      case " ": // Space
        e.preventDefault();
        setChromeVisible();
        nudgePlayerActive();
        if (player.paused()) player.play();
        else player.pause();
        break;
      case "f":
      case "F":
        e.preventDefault();
        setChromeVisible();
        nudgePlayerActive();
        if (player.isFullscreen()) player.exitFullscreen();
        else player.requestFullscreen();
        break;
      default:
        return;
    }
  });

  function flashSeek(text) {
    let el = document.getElementById("seekFlash");
    if (!el) {
      el = document.createElement("div");
      el.id = "seekFlash";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        top: "20%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,.6)",
        color: "#fff",
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "14px",
        fontWeight: "500",
        zIndex: 9999,
        opacity: "0",
        transition: "opacity .15s",
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(flashSeek._t);
    flashSeek._t = setTimeout(() => {
      el.style.opacity = "0";
    }, 350);
  }

  function guessType(p) {
    if (p.endsWith(".mp4")) return "video/mp4";
    if (p.endsWith(".webm")) return "video/webm";
    if (p.endsWith(".ogv") || p.endsWith(".ogg")) return "video/ogg";
    if (p.endsWith(".mp3")) return "audio/mpeg";
    if (p.endsWith(".wav")) return "audio/wav";
    if (p.endsWith(".m4a")) return "audio/mp4";
    if (p.endsWith(".flac")) return "audio/flac";
    if (p.endsWith(".aac")) return "audio/aac";
    return "";
  }

  // Open in Native Player button handler
  window.addEventListener("load", function () {
    const openNativeBtn = document.getElementById("openNativeBtn");

    if (openNativeBtn) {
      openNativeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Show a quick visual feedback
        const originalText = openNativeBtn.innerHTML;
        openNativeBtn.innerHTML =
          '<span class="flex items-center gap-2">Opening...</span>';

        setTimeout(function () {
          // Navigate to the raw media file URL, letting the browser handle it natively
          window.location.href = mediaUrl;
        }, 200);
      });
    }
  });

  // Dynamic resize handling
  function handleResize() {
    // With fill mode, let CSS drive size; just nudge video.js
    if (player) player.trigger("resize");
  }

  // Listen for window resize events
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  // Initial resize
  handleResize();
})();
