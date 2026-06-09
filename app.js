const STORAGE_KEY = "guess-the-song-state-v2";
const YOUTUBE_KEY_STORAGE = "guess-the-song-youtube-api-key";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("guess-the-song") : null;
const isHost = new URLSearchParams(window.location.search).get("view") === "host";

const defaultState = {
  scores: { a: 0, b: 0 },
  teamNames: { a: "Team A", b: "Team B" },
  round: 1,
  timer: 5,
  publicAnswer: "",
  participantStatus: "Waiting for the host to start the round.",
};

function readState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

let state = readState();
let currentAnswer = "";
let stopTimeout = null;
let countdownInterval = null;
let youtubeSongLoaded = false;
let youtubePlayer = null;
let youtubePlayerReady = false;
let resolveYoutubeReady;
const youtubeReady = new Promise((resolve) => {
  resolveYoutubeReady = resolve;
});

const byId = (id) => document.getElementById(id);
const secondsInput = byId("secondsInput");
const startButton = byId("startButton");
const statusText = byId("statusText");

function saveState(patch = {}) {
  state = { ...state, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  channel?.postMessage(state);
  renderSharedState();
}

function renderSharedState() {
  byId("teamAScore").textContent = state.scores.a;
  byId("teamBScore").textContent = state.scores.b;
  byId("hostTeamAScore").textContent = state.scores.a;
  byId("hostTeamBScore").textContent = state.scores.b;
  byId("teamANameDisplay").textContent = state.teamNames.a;
  byId("teamBNameDisplay").textContent = state.teamNames.b;
  byId("hostTeamAName").value = state.teamNames.a;
  byId("hostTeamBName").value = state.teamNames.b;
  byId("roundNumber").textContent = state.round;
  byId("hostRoundNumber").textContent = state.round;
  byId("participantTimer").textContent = Number(state.timer).toFixed(1);
  byId("participantStatus").textContent = state.participantStatus;
  byId("publicAnswer").textContent = state.publicAnswer || "Hidden";
  byId("publicAnswer").classList.toggle("is-revealed", Boolean(state.publicAnswer));
}

function setHostStatus(message) {
  statusText.textContent = message;
}

function getSeconds() {
  const seconds = Number.parseFloat(secondsInput.value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) : 5;
}

function clearTimers() {
  window.clearTimeout(stopTimeout);
  window.clearInterval(countdownInterval);
  stopTimeout = null;
  countdownInterval = null;
}

function pauseCurrentSource(reset = false) {
  if (youtubePlayerReady) {
    youtubePlayer.pauseVideo();
    if (reset && youtubeSongLoaded) youtubePlayer.seekTo(0, true);
  }
}

function stopPlayback(hostMessage = "Time is up. Song stopped.", publicMessage = "Time is up. Make your guess!") {
  clearTimers();
  pauseCurrentSource(true);
  startButton.disabled = false;
  setHostStatus(hostMessage);
  saveState({ timer: getSeconds(), participantStatus: publicMessage });
}

function decodeYoutubeText(value) {
  const text = document.createElement("textarea");
  text.innerHTML = value;
  return text.value;
}

async function selectYoutubeResult(result) {
  await youtubeReady;
  clearTimers();
  pauseCurrentSource();
  youtubeSongLoaded = true;
  currentAnswer = `${decodeYoutubeText(result.snippet.title)} - ${decodeYoutubeText(result.snippet.channelTitle)}`;
  byId("privateAnswer").textContent = currentAnswer;
  byId("youtubePlayerWrap").hidden = false;
  youtubePlayer.cueVideoById(result.id.videoId);
  saveState({
    timer: getSeconds(),
    publicAnswer: "",
    participantStatus: "Song selected. Waiting for the host to play.",
  });
  setHostStatus("YouTube song loaded. Play when ready.");
}

function renderYoutubeResults(results) {
  const resultsElement = byId("youtubeResults");
  resultsElement.replaceChildren();

  results.forEach((result, index) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const text = document.createElement("span");
    const title = document.createElement("strong");
    const channelName = document.createElement("small");

    button.type = "button";
    button.className = "youtube-result";
    image.src = result.snippet.thumbnails.medium?.url || result.snippet.thumbnails.default.url;
    image.alt = "";
    title.textContent = `${index + 1}. ${decodeYoutubeText(result.snippet.title)}`;
    channelName.textContent = decodeYoutubeText(result.snippet.channelTitle);
    text.append(title, channelName);
    button.append(image, text);
    button.addEventListener("click", () => selectYoutubeResult(result));
    resultsElement.append(button);
  });
}

function showYoutubeSearchMessage(message) {
  const messageElement = document.createElement("p");
  messageElement.className = "search-message";
  messageElement.textContent = message;
  byId("youtubeResults").replaceChildren(messageElement);
}

async function searchYoutube() {
  const apiKey = byId("youtubeApiKey").value.trim();
  const searchText = byId("youtubeSearch").value.trim();
  const titleFilter = byId("titleSelect").value;
  const query = [searchText, titleFilter, "theme soundtrack music"].filter(Boolean).join(" ");

  if (!apiKey) {
    byId("youtubeApiKey").closest("details").open = true;
    setHostStatus("Add a YouTube Data API key once to enable search.");
    return;
  }
  if (!searchText && !titleFilter) {
    setHostStatus("Type a song or choose a Movie / TV title.");
    return;
  }

  localStorage.setItem(YOUTUBE_KEY_STORAGE, apiKey);
  byId("searchYoutubeButton").disabled = true;
  showYoutubeSearchMessage("Searching YouTube...");
  setHostStatus(`Finding the top 5 results for "${query}"...`);

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "5",
      videoEmbeddable: "true",
      safeSearch: "moderate",
      key: apiKey,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "YouTube search failed.");
    }
    if (!data.items?.length) {
      showYoutubeSearchMessage("No playable results found.");
      setHostStatus("No playable YouTube results found. Try a different search.");
      return;
    }

    renderYoutubeResults(data.items);
    setHostStatus("Choose one of the five YouTube suggestions.");
  } catch (error) {
    showYoutubeSearchMessage(error.message);
    setHostStatus(error.message);
  } finally {
    byId("searchYoutubeButton").disabled = false;
  }
}

function updateScore(team, amount) {
  saveState({ scores: { ...state.scores, [team]: Math.max(0, state.scores[team] + amount) } });
}

byId("participantView").hidden = isHost;
byId("hostView").hidden = !isHost;
byId("screenTitle").textContent = isHost ? "Host Controls" : "Participant Screen";
byId("switchViewLink").textContent = isHost ? "Open Participant Screen" : "Open Host Controls";
byId("switchViewLink").href = isHost ? window.location.pathname : "?view=host";

byId("teamAPlus").addEventListener("click", () => updateScore("a", 1));
byId("teamAMinus").addEventListener("click", () => updateScore("a", -1));
byId("teamBPlus").addEventListener("click", () => updateScore("b", 1));
byId("teamBMinus").addEventListener("click", () => updateScore("b", -1));
byId("hostTeamAName").addEventListener("change", (event) => saveState({ teamNames: { ...state.teamNames, a: event.target.value || "Team A" } }));
byId("hostTeamBName").addEventListener("change", (event) => saveState({ teamNames: { ...state.teamNames, b: event.target.value || "Team B" } }));
byId("resetScoresButton").addEventListener("click", () => saveState({ scores: { a: 0, b: 0 } }));

byId("youtubeApiKey").value = localStorage.getItem(YOUTUBE_KEY_STORAGE) || "";
byId("searchYoutubeButton").addEventListener("click", searchYoutube);
byId("youtubeSearch").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchYoutube();
});
byId("titleSelect").addEventListener("change", () => {
  if (byId("titleSelect").value) searchYoutube();
});
byId("revealAnswerButton").addEventListener("click", () => {
  saveState({
    publicAnswer: currentAnswer || "No song loaded yet",
    participantStatus: "Answer revealed!",
  });
});
byId("hideAnswerButton").addEventListener("click", () => saveState({ publicAnswer: "", participantStatus: "Answer hidden." }));

secondsInput.addEventListener("input", () => {
  if (!stopTimeout) saveState({ timer: getSeconds() });
});
document.querySelectorAll("[data-seconds]").forEach((button) => {
  button.addEventListener("click", () => {
    secondsInput.value = button.dataset.seconds;
    saveState({ timer: getSeconds() });
  });
});

startButton.addEventListener("click", async () => {
  if (!youtubeSongLoaded) {
    setHostStatus("Choose one of the YouTube search results first.");
    return;
  }

  const seconds = getSeconds();
  clearTimers();
  saveState({ timer: seconds, publicAnswer: "", participantStatus: "Listen carefully..." });

  youtubePlayer.seekTo(0, true);
  youtubePlayer.playVideo();

  startButton.disabled = true;
  setHostStatus(`Playing for ${seconds} seconds.`);
  const startedAt = Date.now();
  countdownInterval = window.setInterval(() => {
    const remaining = Math.max(0, seconds - (Date.now() - startedAt) / 1000);
    saveState({ timer: remaining });
  }, 100);
  stopTimeout = window.setTimeout(() => {
    stopPlayback("Time is up. Take guesses, then reveal the answer.", "Time is up. Make your guess!");
  }, seconds * 1000);
});

byId("stopButton").addEventListener("click", () => stopPlayback("Stopped by host.", "Playback stopped by the host."));
byId("nextRoundButton").addEventListener("click", () => {
  stopPlayback("Next round ready.", "Waiting for the next song.");
  saveState({ round: state.round + 1, publicAnswer: "" });
});
byId("resetRoundButton").addEventListener("click", () => {
  stopPlayback("Game reset.", "Waiting for the host to start the game.");
  saveState({ round: 1, scores: { a: 0, b: 0 }, publicAnswer: "" });
});
window.onYouTubeIframeAPIReady = () => {
  youtubePlayer = new YT.Player("youtubePlayer", {
    height: "270",
    width: "480",
    playerVars: {
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        youtubePlayerReady = true;
        resolveYoutubeReady();
      },
      onAutoplayBlocked: () => {
        setHostStatus("YouTube playback was blocked. Click Play Round again.");
        startButton.disabled = false;
      },
    },
  });
};

if (window.YT?.Player) window.onYouTubeIframeAPIReady();

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = readState();
    renderSharedState();
  }
});
if (channel) {
  channel.onmessage = (event) => {
    state = event.data;
    renderSharedState();
  };
}

renderSharedState();
