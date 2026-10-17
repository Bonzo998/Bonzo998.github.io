const captains = {
  bonzo: { name: "Bonzo", color: "bonzo" },
  caboose: { name: "CabooseMa", color: "caboose" },
};

const athletes = [
  "Txylor",
  "Gern",
  "Fiber",
  "Karl",
  "TechManic",
  "ObiWanLove",
  "MovableCloth",
  "BungusMungus",
];

const games = [
  { name: "CS2" },
  { name: "League Of Legends" },
  { name: "Fortnite", note: "Custom map — to be decided" },
  { name: "Tom Clancy's Siege" },
  { name: "Overwatch" },
  { name: "Valorant" },
  { name: "2XKO" },
  { name: "For Honour" },
  { name: "Paladins" },
  { name: "Minecraft Manhunt" },
  { name: "Rocket League" },
  { name: "Stick fight the game" },
  { name: "TF2" },
  { name: "Tetris" },
  { name: "Mahjong" },
  { name: "Chess" },
  { name: "MECCHA CHAMELEON" },
  { name: "PvZ GW2" },
  { name: "Roblox - Phantom Forces" },
];

const STORAGE_KEY = "5v5-mania-gauntlet-v1";
const initialState = {
  teams: { bonzo: [], caboose: [] },
  winners: Array(games.length).fill(null),
};

const elements = {
  athleteList: document.querySelector("#athlete-list"),
  bonzoRoster: document.querySelector("#bonzo-roster"),
  cabooseRoster: document.querySelector("#caboose-roster"),
  gameList: document.querySelector("#game-list"),
  saveStatus: document.querySelector("#save-status"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let toastTimer;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialState);
    const parsed = JSON.parse(saved);
    const assigned = [...(parsed.teams?.bonzo ?? []), ...(parsed.teams?.caboose ?? [])];
    const validTeams =
      Array.isArray(parsed.teams?.bonzo) &&
      Array.isArray(parsed.teams?.caboose) &&
      assigned.every((name) => athletes.includes(name)) &&
      new Set(assigned).size === assigned.length &&
      parsed.teams.bonzo.length <= 4 &&
      parsed.teams.caboose.length <= 4;
    const validWinners =
      Array.isArray(parsed.winners) &&
      parsed.winners.length === games.length &&
      parsed.winners.every((winner) => winner === null || winner === "bonzo" || winner === "caboose");
    if (!validTeams || !validWinners) throw new Error("Saved match data is invalid.");
    return { teams: parsed.teams, winners: parsed.winners };
  } catch (error) {
    console.error("Could not load the saved match; starting a fresh match instead.", error);
    elements.saveStatus.textContent = "LOAD FAILED — STARTING FRESH";
    elements.saveStatus.classList.add("error");
    return structuredClone(initialState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    elements.saveStatus.textContent = "SAVED IN THIS BROWSER";
    elements.saveStatus.classList.remove("error");
  } catch (error) {
    console.error("Could not save the match.", error);
    elements.saveStatus.textContent = "SAVE FAILED — KEEP THIS TAB OPEN";
    elements.saveStatus.classList.add("error");
  }
}

function renderRoster(teamKey, container) {
  const picks = state.teams[teamKey];
  const slots = Array.from({ length: 4 }, (_, index) => {
    const player = picks[index];
    return `<div class="roster-slot${player ? " filled" : ""}">
      <span class="slot-index">0${index + 2}</span>
      <span>${player ?? "Open pick"}</span>
    </div>`;
  });
  container.innerHTML = slots.join("");
  document.querySelector(`#${teamKey}-fraction`).innerHTML = `${picks.length + 1} <i>/ 5</i>`;
  document.querySelector(`#${teamKey}-count`).textContent = `${picks.length + 1} / 5 PLAYERS`;
}

function renderAthletes() {
  const available = athletes.filter(
    (player) => !state.teams.bonzo.includes(player) && !state.teams.caboose.includes(player),
  );
  elements.athleteList.innerHTML = athletes
    .map((player) => {
      const teamKey = state.teams.bonzo.includes(player)
        ? "bonzo"
        : state.teams.caboose.includes(player)
          ? "caboose"
          : null;
      const assignedTeam = teamKey ? captains[teamKey].name : null;
      const full = (key) => state.teams[key].length >= 4;
      return `<div class="athlete-card${teamKey ? ` assigned-${teamKey}` : ""}">
        <span class="athlete-name">${player}</span>
        ${
          teamKey
            ? `<div class="assigned-actions">
                <span class="assigned-note">Picked by <strong>${assignedTeam}</strong></span>
                <div class="pick-actions">
                  <button class="pick-button" type="button" data-player="${player}" data-team="${teamKey === "bonzo" ? "caboose" : "bonzo"}" data-action="move"${full(teamKey === "bonzo" ? "caboose" : "bonzo") ? " disabled" : ""} aria-label="Move ${player} to ${captains[teamKey === "bonzo" ? "caboose" : "bonzo"].name}">MOVE</button>
                  <button class="pick-button remove-pick" type="button" data-player="${player}" data-team="${teamKey}" data-action="remove" aria-label="Remove ${player} from ${assignedTeam}">REMOVE</button>
                </div>
              </div>`
            : `<div class="pick-actions">
                <button class="pick-button" type="button" data-player="${player}" data-team="bonzo"${full("bonzo") ? " disabled" : ""} aria-label="Pick ${player} for Bonzo">BONZO</button>
                <button class="pick-button caboose-pick" type="button" data-player="${player}" data-team="caboose"${full("caboose") ? " disabled" : ""} aria-label="Pick ${player} for CabooseMa">CABOOSE</button>
              </div>`
        }
      </div>`;
    })
    .join("");
  document.querySelector("#available-count").textContent = `${available.length} AVAILABLE`;
  elements.athleteList.querySelectorAll(".pick-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "remove") {
        removePlayer(button.dataset.player, button.dataset.team);
      } else if (button.dataset.action === "move") {
        movePlayer(button.dataset.player, button.dataset.team);
      } else {
        pickPlayer(button.dataset.player, button.dataset.team);
      }
    });
  });
}

function renderGames() {
  elements.gameList.innerHTML = games
    .map((game, index) => {
      const winner = state.winners[index];
      const winnerClass = winner ? ` decided decided-${winner}` : "";
      const bonzoSelected = winner === "bonzo" ? " selected-bonzo" : "";
      const cabooseSelected = winner === "caboose" ? " selected-caboose" : "";
      return `<article class="game-row${winnerClass}">
        <span class="game-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="game-name-wrap">
          <span class="game-name">${game.name}</span>
          ${game.note ? `<span class="game-note">${game.note}</span>` : ""}
        </span>
        <span class="winner-actions">
          <button class="winner-button${bonzoSelected}" type="button" data-round="${index}" data-winner="bonzo" aria-label="${game.name}: Bonzo wins"${winner === "bonzo" ? ' aria-pressed="true"' : ' aria-pressed="false"'}>A</button>
          <button class="winner-button${cabooseSelected}" type="button" data-round="${index}" data-winner="caboose" aria-label="${game.name}: CabooseMa wins"${winner === "caboose" ? ' aria-pressed="true"' : ' aria-pressed="false"'}>B</button>
        </span>
      </article>`;
    })
    .join("");
  elements.gameList.querySelectorAll(".winner-button").forEach((button) => {
    button.addEventListener("click", () => setWinner(Number(button.dataset.round), button.dataset.winner));
  });
}

function renderScore() {
  const bonzoWins = state.winners.filter((winner) => winner === "bonzo").length;
  const cabooseWins = state.winners.filter((winner) => winner === "caboose").length;
  const played = bonzoWins + cabooseWins;
  document.querySelector("#bonzo-score").textContent = bonzoWins;
  document.querySelector("#caboose-score").textContent = cabooseWins;
  document.querySelector("#bonzo-wins").textContent = String(bonzoWins).padStart(2, "0");
  document.querySelector("#caboose-wins").textContent = String(cabooseWins).padStart(2, "0");
  document.querySelector("#progress-fill").style.width = `${(played / games.length) * 100}%`;
  document.querySelector("#progress-label").textContent = `${played} / ${games.length} ROUNDS PLAYED`;
  document.querySelector("#games-summary-count").textContent = `${played} OF ${games.length} DECIDED`;
}

function render() {
  renderRoster("bonzo", elements.bonzoRoster);
  renderRoster("caboose", elements.cabooseRoster);
  renderAthletes();
  renderGames();
  renderScore();
}

function pickPlayer(player, team) {
  if (!athletes.includes(player) || !captains[team]) return;
  if (state.teams.bonzo.includes(player) || state.teams.caboose.includes(player)) return;
  if (state.teams[team].length >= 4) {
    showToast(`${captains[team].name}'s team is full.`);
    return;
  }
  state.teams[team].push(player);
  saveState();
  render();
}

function removePlayer(player, team) {
  if (!captains[team]) return;
  state.teams[team] = state.teams[team].filter((name) => name !== player);
  saveState();
  render();
}

function movePlayer(player, team) {
  if (!captains[team]) return;
  const currentTeam = team === "bonzo" ? "caboose" : "bonzo";
  if (!state.teams[currentTeam].includes(player) || state.teams[team].length >= 4) return;
  state.teams[currentTeam] = state.teams[currentTeam].filter((name) => name !== player);
  state.teams[team].push(player);
  saveState();
  render();
}

function setWinner(round, winner) {
  if (!Number.isInteger(round) || round < 0 || round >= games.length) return;
  if (!captains[winner]) return;
  state.winners[round] = state.winners[round] === winner ? null : winner;
  saveState();
  renderGames();
  renderScore();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

document.querySelector("#reset-button").addEventListener("click", () => {
  if (!window.confirm("Reset all team picks and round results? This cannot be undone.")) return;
  state = structuredClone(initialState);
  saveState();
  render();
  showToast("Match reset. Ready for a fresh gauntlet.");
});

render();
