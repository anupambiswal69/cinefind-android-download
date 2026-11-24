const form = document.querySelector("#search-form");
const tabs = [...document.querySelectorAll(".mode-tab")];
const panels = [...document.querySelectorAll(".mode-panel")];
const feedback = document.querySelector("#feedback");
const urlInput = document.querySelector("#scene-url");
const clearUrlButton = document.querySelector("#clear-url");
const sourceSummary = document.querySelector("#source-summary");
const historyList = document.querySelector("#history-list");
const clearHistoryButton = document.querySelector("#clear-history");
const movieSearchForm = document.querySelector("#movie-search-form");
const movieQueryInput = document.querySelector("#movie-query");
const catalogStatus = document.querySelector("#catalog-status");
const movieResults = document.querySelector("#movie-results");
const watchRegion = document.querySelector("#watch-region");
const movieDialog = document.querySelector("#movie-dialog");
const dialogContent = document.querySelector("#dialog-content");
const closeMovieDialog = document.querySelector("#close-movie-dialog");
const storageKey = "cinefind.recent-submissions";
const maxHistoryItems = 8;
let activeMode = "link";
let selectedFiles = { video: null, image: null };
let previewUrls = { video: null, image: null };

const modeDetails = {
  link: { label: "Social link", input: null, selection: null },
  video: {
    label: "Video clip",
    input: document.querySelector("#video-file"),
    selection: document.querySelector("#video-selection"),
  },
  image: {
    label: "Screenshot",
    input: document.querySelector("#image-file"),
    selection: document.querySelector("#image-selection"),
  },
};

function setMode(mode) {
  activeMode = mode;

  tabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== `${mode}-panel`;
  });

  urlInput.required = mode === "link";
  modeDetails.video.input.required = mode === "video";
  modeDetails.image.input.required = mode === "image";
  clearFeedback();
}

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
  feedback.hidden = false;
}

function clearFeedback() {
  feedback.textContent = "";
  feedback.classList.remove("is-error");
  feedback.hidden = true;
}

function validateSocialUrl(value) {
  let url;

  try {
    url = new URL(value.trim());
  } catch {
    return { error: "Enter a complete link beginning with https://." };
  }

  if (url.protocol !== "https:") {
    return { error: "For security, use a link beginning with https://." };
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const isInstagramReel = hostname === "instagram.com" && /^\/reel\/[^/]+/i.test(url.pathname);
  const isYoutube = hostname === "youtube.com" || hostname === "m.youtube.com";
  const isYoutubeShort = isYoutube && /^\/shorts\/[^/]+/i.test(url.pathname);
  const isYoutubeWatch = isYoutube && url.pathname === "/watch" && url.searchParams.has("v");
  const isYoutubeVideo = hostname === "youtu.be" && url.pathname.length > 1;

  if (!isInstagramReel && !isYoutubeShort && !isYoutubeWatch && !isYoutubeVideo) {
    return { error: "Use an Instagram Reel or a YouTube video or Short link." };
  }

  return { value: url.toString(), label: `${hostname} link` };
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file, mode) {
  const extension = file.name.split(".").pop().toLowerCase();
  const allowedExtensions = mode === "video"
    ? ["mp4", "mov", "webm"]
    : ["jpg", "jpeg", "png", "webp"];
  const maxBytes = mode === "video" ? 100 * 1024 * 1024 : 15 * 1024 * 1024;

  if (!allowedExtensions.includes(extension)) {
    return {
      error: mode === "video"
        ? "Choose an MP4, MOV, or WEBM video."
        : "Choose a JPG, PNG, or WEBP image.",
    };
  }

  if (file.size > maxBytes) {
    return {
      error: mode === "video"
        ? "This clip is larger than 100 MB. Choose a smaller video."
        : "This image is larger than 15 MB. Choose a smaller screenshot.",
    };
  }

  return { value: file };
}

function releasePreview(mode) {
  if (previewUrls[mode]) {
    URL.revokeObjectURL(previewUrls[mode]);
    previewUrls[mode] = null;
  }
}

function renderSelectedFile(mode, file) {
  const selection = modeDetails[mode].selection;
  releasePreview(mode);
  selection.replaceChildren();

  let thumb = document.createElement("div");
  thumb.className = `file-thumb${mode === "video" ? " is-video" : ""}`;

  if (mode === "image") {
    previewUrls[mode] = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.className = "file-thumb";
    image.src = previewUrls[mode];
    image.alt = "Selected screenshot preview";
    thumb = image;
  } else {
    thumb.textContent = "▶";
  }

  const details = document.createElement("div");
  details.className = "file-details";

  const name = document.createElement("p");
  name.className = "file-name";
  name.textContent = file.name;

  const size = document.createElement("p");
  size.className = "file-size";
  size.textContent = formatFileSize(file.size);
  details.append(name, size);

  const remove = document.createElement("button");
  remove.className = "remove-file";
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Remove ${file.name}`);
  remove.addEventListener("click", () => clearSelectedFile(mode));

  selection.append(thumb, details, remove);
  selection.hidden = false;
}

function clearSelectedFile(mode) {
  const { input, selection } = modeDetails[mode];
  input.value = "";
  selectedFiles[mode] = null;
  releasePreview(mode);
  selection.replaceChildren();
  selection.hidden = true;
  clearFeedback();
}

function acceptFile(file, mode) {
  if (!file) return;

  const result = isAllowedFile(file, mode);
  if (result.error) {
    clearSelectedFile(mode);
    showFeedback(result.error, true);
    return;
  }

  selectedFiles[mode] = file;
  renderSelectedFile(mode, file);
  clearFeedback();
}

function getHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = getHistory();
  historyList.replaceChildren();
  clearHistoryButton.hidden = history.length === 0;

  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Your checked links and selected files will appear here.";
    historyList.append(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const name = document.createElement("span");
    name.className = "history-name";
    name.textContent = entry.name;

    const source = document.createElement("span");
    source.className = "history-source";
    source.textContent = entry.source;

    const time = document.createElement("time");
    time.className = "history-time";
    time.dateTime = entry.createdAt;
    time.textContent = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(entry.createdAt));

    item.append(name, source, time);
    historyList.append(item);
  });
}

function saveSubmission(source, name) {
  const history = getHistory();
  const entry = {
    source,
    name,
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify([entry, ...history].slice(0, maxHistoryItems)));
  } catch {
    showFeedback("This browser could not save local history. Your input has not been uploaded.", true);
    return false;
  }

  renderHistory();
  return true;
}

function apiUrl(path) {
  const base = (window.CINEFIND_API_BASE || "").replace(/\/$/, "");
  if (!base && window.location.hostname.endsWith("github.io")) {
    throw new Error("Movie search is not connected on this web build yet.");
  }
  if (!base && ["capacitor:", "ionic:"].includes(window.location.protocol)) {
    throw new Error("This app needs the deployed CINEFIND server address. Set it in frontend/app-config.js and rebuild the mobile app.");
  }
  return `${base}/api${path}`;
}

function setCatalogStatus(message, isError = false) {
  catalogStatus.textContent = message;
  catalogStatus.classList.toggle("is-error", isError);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createMovieCard(movie) {
  const card = document.createElement("article");
  card.className = "movie-card";

  const posterFrame = makeElement("div", "poster-frame");
  if (movie.posterUrl) {
    const poster = document.createElement("img");
    poster.src = movie.posterUrl;
    poster.alt = `${movie.title} poster`;
    poster.loading = "lazy";
    posterFrame.append(poster);
  } else {
    posterFrame.append(makeElement("span", "poster-fallback", "NO ARTWORK"));
  }

  const type = makeElement("span", "media-type", movie.mediaType === "tv" ? "SERIES" : "FILM");
  posterFrame.append(type);

  const content = makeElement("div", "movie-card-content");
  content.append(makeElement("h3", "movie-card-title", movie.title));
  const metadata = [movie.year, movie.rating ? `★ ${movie.rating.toFixed(1)}` : null].filter(Boolean).join("  ·  ");
  content.append(makeElement("p", "movie-card-meta", metadata || "Release details unavailable"));
  content.append(makeElement("p", "movie-card-overview", movie.overview));

  const details = makeElement("button", "details-button", "Movie details");
  details.type = "button";
  details.addEventListener("click", () => openMovieDetails(movie));
  content.append(details);
  card.append(posterFrame, content);
  return card;
}

async function searchMovieTitles(query) {
  const parameters = new URLSearchParams({ query });
  const response = await fetch(apiUrl(`/movies/search?${parameters}`));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Movie search failed.");
  return data.results || [];
}

function addProviderLinks(container, providers, watchUrl) {
  if (watchUrl) {
    const availability = document.createElement("a");
    availability.className = "watch-link watch-link-primary";
    availability.href = watchUrl;
    availability.target = "_blank";
    availability.rel = "noopener noreferrer";
    availability.textContent = "View legal watch options";
    container.append(availability);
  }

  if (!providers.length) {
    container.append(makeElement("p", "no-providers", "No provider listings were returned for this region."));
    return;
  }

  const groupedProviders = [
    ["Streaming", providers.filter((provider) => provider.accessType === "stream" || provider.accessType === "free" || provider.accessType === "ads")],
    ["Rent", providers.filter((provider) => provider.accessType === "rent")],
    ["Buy", providers.filter((provider) => provider.accessType === "buy")],
  ];

  groupedProviders.forEach(([label, items]) => {
    if (!items.length) return;
    const group = makeElement("div", "provider-group");
    group.append(makeElement("h4", "provider-heading", label));
    const providerList = makeElement("div", "provider-list");

    items.forEach((provider) => {
      const link = document.createElement("a");
      link.className = "provider-link";
      link.href = watchUrl || "https://www.themoviedb.org";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      if (provider.logoUrl) {
        const logo = document.createElement("img");
        logo.src = provider.logoUrl;
        logo.alt = "";
        logo.loading = "lazy";
        link.append(logo);
      }

      link.append(makeElement("span", "provider-name", provider.name));
      providerList.append(link);
    });

    group.append(providerList);
    container.append(group);
  });
}

async function openMovieDetails(movie) {
  dialogContent.replaceChildren(makeElement("p", "dialog-loading", "Loading title details…"));
  if (!movieDialog.open) movieDialog.showModal();

  try {
    const region = encodeURIComponent(watchRegion.value);
    const response = await fetch(apiUrl(`/movies/${movie.mediaType}/${movie.id}?region=${region}`));
    const details = await response.json();
    if (!response.ok) throw new Error(details.error || "Could not load title details.");
    renderMovieDetails(details);
  } catch (error) {
    dialogContent.replaceChildren(makeElement("p", "dialog-error", error.message));
  }
}

function renderMovieDetails(movie) {
  dialogContent.replaceChildren();
  const hero = makeElement("div", "dialog-hero");

  if (movie.backdropUrl) {
    const backdrop = document.createElement("img");
    backdrop.src = movie.backdropUrl;
    backdrop.alt = "";
    hero.append(backdrop);
  }

  const details = makeElement("div", "dialog-details");
  const type = movie.mediaType === "tv" ? "SERIES" : "FILM";
  details.append(makeElement("p", "eyebrow", `${type}  /  ${movie.year || "YEAR UNKNOWN"}`));
  details.append(makeElement("h2", "dialog-title", movie.title));
  const facts = [
    movie.genres?.join(" · "),
    movie.rating ? `TMDB ★ ${movie.rating.toFixed(1)}` : null,
  ].filter(Boolean).join("  /  ");
  if (facts) details.append(makeElement("p", "dialog-facts", facts));
  details.append(makeElement("p", "dialog-overview", movie.overview));

  if (movie.cast?.length) {
    details.append(makeElement("p", "dialog-credit", `CAST  /  ${movie.cast.join(", ")}`));
  }

  if (movie.directors?.length) {
    details.append(makeElement("p", "dialog-credit", `${movie.mediaType === "tv" ? "CREATED BY" : "DIRECTED BY"}  /  ${movie.directors.join(", ")}`));
  }

  const actions = makeElement("div", "dialog-actions");
  if (movie.trailerUrl) {
    const trailer = document.createElement("a");
    trailer.className = "watch-link";
    trailer.href = movie.trailerUrl;
    trailer.target = "_blank";
    trailer.rel = "noopener noreferrer";
    trailer.textContent = "Watch trailer ↗";
    actions.append(trailer);
  }

  details.append(actions);
  details.append(makeElement("h3", "providers-title", `Available in ${watchRegion.options[watchRegion.selectedIndex].text}`));
  addProviderLinks(details, movie.watchProviders || [], movie.watchUrl);
  dialogContent.append(hero, details);
}

movieSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = movieQueryInput.value.trim();
  if (query.length < 2) {
    setCatalogStatus("Enter at least two characters to search.", true);
    movieQueryInput.focus();
    return;
  }

  movieResults.replaceChildren();
  setCatalogStatus("Searching movies and series…");
  const submitButton = movieSearchForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const results = await searchMovieTitles(query);
    if (!results.length) {
      setCatalogStatus("No movie or series matches found. Try another title.");
      return;
    }

    results.forEach((movie) => movieResults.append(createMovieCard(movie)));
    setCatalogStatus(`${results.length} ${results.length === 1 ? "match" : "matches"} found. Select a title to see details and legal watch options.`);
  } catch (error) {
    setCatalogStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

closeMovieDialog.addEventListener("click", () => movieDialog.close());
movieDialog.addEventListener("click", (event) => {
  if (event.target === movieDialog) movieDialog.close();
});

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    tabs[nextIndex].focus();
    setMode(tabs[nextIndex].dataset.mode);
  });
});

urlInput.addEventListener("input", () => {
  clearUrlButton.hidden = urlInput.value.length === 0;
  clearFeedback();
});

clearUrlButton.addEventListener("click", () => {
  urlInput.value = "";
  clearUrlButton.hidden = true;
  clearFeedback();
  urlInput.focus();
});

Object.entries(modeDetails).forEach(([mode, details]) => {
  if (!details.input) return;

  details.input.addEventListener("change", () => acceptFile(details.input.files[0], mode));

  const dropZone = document.querySelector(`#${mode}-drop-zone`);
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (!file) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    details.input.files = transfer.files;
    acceptFile(file, mode);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFeedback();

  let source;
  let name;

  if (activeMode === "link") {
    const result = validateSocialUrl(urlInput.value);
    if (result.error) {
      showFeedback(result.error, true);
      urlInput.focus();
      return;
    }

    source = "Social link";
    name = result.label;
  } else {
    const file = selectedFiles[activeMode];
    if (!file) {
      showFeedback(`Choose a ${activeMode === "video" ? "video clip" : "screenshot"} first.`, true);
      modeDetails[activeMode].input.focus();
      return;
    }

    source = modeDetails[activeMode].label;
    name = file.name;
  }

  if (!saveSubmission(source, name)) return;

  sourceSummary.textContent = `${source} checked · no match generated`;
  showFeedback("Input checked. Scene identification is not connected yet, so no match has been generated.");
});

clearHistoryButton.addEventListener("click", () => {
  try {
    localStorage.removeItem(storageKey);
    renderHistory();
    sourceSummary.textContent = "Waiting for your first scene";
    clearFeedback();
  } catch {
    showFeedback("History could not be cleared in this browser.", true);
  }
});

renderHistory();