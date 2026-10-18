import { config } from "./config.js";

const captains = {
  bonzo: { name: "Bonzo" },
  caboose: { name: "CabooseMa" },
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
  { name: "CS2", format: "5V5" },
  { name: "League Of Legends", format: "5V5" },
  { name: "Fortnite", format: "5V5", note: "Custom map — to be decided" },
  { name: "Tom Clancy's Siege", format: "5V5" },
  { name: "Overwatch", format: "5V5" },
  { name: "Valorant", format: "5V5" },
  { name: "2XKO", format: "2V2 · 2V2 · 1V1", kind: "sets" },
  { name: "For Honour", format: "KING OF THE HILL", kind: "king" },
  { name: "Paladins", format: "5V5" },
  { name: "Minecraft Manhunt", format: "1V4", kind: "one-vs-four" },
  { name: "Rocket League", format: "5V5" },
  { name: "Stick fight the game", format: "5V5" },
  { name: "TF2", format: "5V5" },
  { name: "Tetris", format: "5V5" },
  { name: "Mahjong", format: "2V2 · 2V2 · 1V1", kind: "sets" },
  { name: "Chess", format: "KING OF THE HILL", kind: "king" },
  { name: "MECCHA CHAMELEON", format: "5V5" },
  { name: "PvZ GW2", format: "5V5" },
  { name: "Roblox - Phantom Forces", format: "5V5" },
];

const specialGameIndices = [6, 7, 9, 14, 15];

function createMatchData() {
  return {
    6: { rounds: createSetRounds() },
    7: createKingData(),
    9: { soloTeam: "bonzo", soloPlayer: "", opponents: Array(4).fill(null), winners: [] },
    14: { rounds: createSetRounds() },
    15: createKingData(),
  };
}

function createSetRounds() {
  return Array.from({ length: 3 }, (_, index) => ({
    size: index === 2 ? 1 : 2,
    players: { bonzo: Array(index === 2 ? 1 : 2).fill(null), caboose: Array(index === 2 ? 1 : 2).fill(null) },
    winner: null,
  }));
}

function createKingData() {
  return { kingTeam: null, kingPlayer: "", queues: { bonzo: Array(5).fill(null), caboose: Array(5).fill(null) }, winners: [] };
}

const initialState = {
  teams: { bonzo: [], caboose: [] },
  winners: Array(games.length).fill(null),
  matchData: createMatchData(),
};

const elements = {
  athleteList: document.querySelector("#athlete-list"),
  bonzoRoster: document.querySelector("#bonzo-roster"),
  cabooseRoster: document.querySelector("#caboose-roster"),
  gameList: document.querySelector("#game-list"),
  saveStatus: document.querySelector("#save-status"),
  toast: document.querySelector("#toast"),
  connectionStatus: document.querySelector("#connection-status"),
  accessLabel: document.querySelector("#access-label"),
  loginButton: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
  resetButton: document.querySelector("#reset-button"),
  draftPool: document.querySelector("#athletes-panel"),
  draftPoolToggle: document.querySelector("#toggle-draft-pool"),
};

const configured =
  Boolean(config.supabaseUrl) &&
  Boolean(config.supabaseAnonKey) &&
  /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl);
let supabase;
let state = structuredClone(initialState);
let isAdmin = false;
let isSignedIn = false;
let isSaving = false;
let remoteReady = false;
let draftPoolHidden = false;
let toastTimer;

function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.teams || !Array.isArray(value.winners)) {
    return null;
  }
  const bonzo = value.teams.bonzo;
  const caboose = value.teams.caboose;
  if (!Array.isArray(bonzo) || !Array.isArray(caboose) || value.winners.length !== games.length) {
    return null;
  }
  const assigned = [...bonzo, ...caboose];
  const valid =
    bonzo.length <= 4 &&
    caboose.length <= 4 &&
    assigned.every((name) => athletes.includes(name)) &&
    new Set(assigned).size === assigned.length &&
    value.winners.every((winner) => winner === null || winner === "bonzo" || winner === "caboose");
  if (!valid) return null;
  const normalized = {
    teams: { bonzo: [...bonzo], caboose: [...caboose] },
    winners: [...value.winners],
    matchData: normalizeMatchData(value.matchData),
  };
  if (!isValidMatchData(normalized.matchData, normalized.teams)) return null;
  return normalized;
}

function normalizeSlots(values, size) {
  if (!Array.isArray(values) || values.length > size) return values;
  return Array.from({ length: size }, (_, index) => values[index] ?? null);
}

function normalizeMatchData(matchData) {
  const normalized = { ...createMatchData(), ...(matchData ?? {}) };
  for (const index of [6, 14]) {
    const data = normalized[index];
    if (!Array.isArray(data?.rounds) || data.rounds.length !== 3) continue;
    data.rounds = data.rounds.map((round, roundIndex) => ({
      ...round,
      size: roundIndex === 2 ? 1 : 2,
      players: {
        bonzo: normalizeSlots(round?.players?.bonzo ?? [], roundIndex === 2 ? 1 : 2),
        caboose: normalizeSlots(round?.players?.caboose ?? [], roundIndex === 2 ? 1 : 2),
      },
    }));
  }
  for (const index of [7, 15]) {
    const data = normalized[index];
    if (data?.queues) {
      data.queues = {
        bonzo: normalizeSlots(data.queues.bonzo ?? [], 5),
        caboose: normalizeSlots(data.queues.caboose ?? [], 5),
      };
    }
  }
  const manhunt = normalized[9];
  if (manhunt && Array.isArray(manhunt.opponents)) {
    manhunt.opponents = normalizeSlots(manhunt.opponents, 4);
  }
  return normalized;
}

function isValidMatchData(matchData, teams = state.teams) {
  return specialGameIndices.every((index) => {
    const data = matchData[index];
    if (!data || typeof data !== "object") return false;
    if (games[index].kind === "sets") {
      return (
        Array.isArray(data.rounds) &&
        data.rounds.length === 3 &&
        data.rounds.every(
          (round, roundIndex) =>
            round?.size === (roundIndex === 2 ? 1 : 2) &&
            round.players &&
            ["bonzo", "caboose"].every(
              (team) =>
                Array.isArray(round.players[team]) &&
                round.players[team].length === round.size &&
                round.players[team].every((name) => name === null || isTeamPlayer(name, team, teams)) &&
                new Set(round.players[team].filter(Boolean)).size === round.players[team].filter(Boolean).length &&
                (!round.winner || round.players[team].every(Boolean)),
            ) &&
            (round.winner === null || round.winner === "bonzo" || round.winner === "caboose"),
        )
      );
    }
    if (games[index].kind === "king") {
      return (
        (data.kingTeam === null || Boolean(captains[data.kingTeam])) &&
        typeof data.kingPlayer === "string" &&
        data.queues &&
        ["bonzo", "caboose"].every((team) => Array.isArray(data.queues[team])) &&
        ["bonzo", "caboose"].every(
          (team) =>
            Array.isArray(data.queues[team]) &&
            data.queues[team].length === 5 &&
            new Set(data.queues[team].filter(Boolean)).size === data.queues[team].filter(Boolean).length &&
            data.queues[team].every((name) => name === null || isTeamPlayer(name, team, teams)),
        ) &&
        (data.kingTeam === null
          ? data.kingPlayer === ""
          : data.kingPlayer === ""
            ? data.queues[data.kingTeam][0] === null
            : data.kingPlayer === data.queues[data.kingTeam][0] &&
              isTeamPlayer(data.kingPlayer, data.kingTeam, teams)) &&
        Array.isArray(data.winners) &&
        (!data.winners.length ||
          (data.kingTeam &&
            data.kingPlayer &&
            data.queues.bonzo.every(Boolean) &&
            data.queues.caboose.every(Boolean))) &&
        data.winners.length <= 9 &&
        data.winners.every((winner) => winner === "bonzo" || winner === "caboose")
      );
    }
    return (
      (data.soloTeam === null || captains[data.soloTeam]) &&
      typeof data.soloPlayer === "string" &&
      (!data.soloPlayer || isTeamPlayer(data.soloPlayer, data.soloTeam, teams)) &&
      Array.isArray(data.opponents) &&
      data.opponents.length === 4 &&
      new Set(data.opponents.filter(Boolean)).size === data.opponents.filter(Boolean).length &&
      data.opponents.every((name) => name === null || isTeamPlayer(name, data.soloTeam === "bonzo" ? "caboose" : "bonzo", teams)) &&
      Array.isArray(data.winners) &&
      (!data.winners.length || (data.soloPlayer && data.opponents.every(Boolean))) &&
      data.winners.length <= 1 &&
      data.winners.every((winner) => winner === "bonzo" || winner === "caboose")
    );
  });
}

function isTeamPlayer(player, team, teams = state.teams) {
  return team === "bonzo"
    ? player === captains.bonzo.name || teams.bonzo.includes(player)
    : team === "caboose"
      ? player === captains.caboose.name || teams.caboose.includes(player)
      : false;
}

function getTeamPlayers(team) {
  return [captains[team].name, ...state.teams[team]];
}

function getGameWinner(index) {
  const kind = games[index].kind;
  const data = state.matchData[index];
  if (kind === "sets") {
    const scores = { bonzo: 0, caboose: 0 };
    for (const round of data.rounds) {
      if (round.winner) scores[round.winner] += 1;
    }
    return scores.bonzo >= 2 ? "bonzo" : scores.caboose >= 2 ? "caboose" : null;
  }
  if (kind === "king") {
    return simulateKingMatch(data).winner;
  }
  if (kind === "one-vs-four") {
    return data.winners.length ? data.winners[0] : null;
  }
  return state.winners[index];
}

function simulateKingMatch(data) {
  if (!data.kingTeam || !data.kingPlayer || !data.queues[data.kingTeam].includes(data.kingPlayer)) {
    return { fights: [], winner: null };
  }
  if (
    data.queues.bonzo.length !== 5 ||
    data.queues.caboose.length !== 5 ||
    !data.queues.bonzo.every(Boolean) ||
    !data.queues.caboose.every(Boolean)
  ) {
    return { fights: [], winner: null };
  }
  let kingTeam = data.kingTeam;
  let kingPlayer = data.kingPlayer;
  const pointers = { bonzo: 0, caboose: 0 };
  pointers[kingTeam] = data.queues[kingTeam].indexOf(kingPlayer) + 1;
  const fights = [];
  let winner = null;

  for (let fightIndex = 0; fightIndex < 9; fightIndex += 1) {
    const challengerTeam = kingTeam === "bonzo" ? "caboose" : "bonzo";
    const challenger = data.queues[challengerTeam][pointers[challengerTeam]];
    if (!challenger) {
      winner = kingTeam;
      break;
    }
    const fightWinner = data.winners[fightIndex] ?? null;
    fights.push({ kingTeam, kingPlayer, challengerTeam, challenger, winner: fightWinner });
    if (!fightWinner) break;
    pointers[challengerTeam] += 1;
    if (fightWinner === challengerTeam) {
      pointers[kingTeam] += 1;
      kingTeam = challengerTeam;
      kingPlayer = challenger;
    }
  }
  return { fights, winner };
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
      const otherTeam = teamKey === "bonzo" ? "caboose" : "bonzo";
      const full = (key) => state.teams[key].length >= 4;
      let controls;
      if (isAdmin && remoteReady) {
        controls = teamKey
          ? `<div class="assigned-actions">
              <span class="assigned-note">Picked by <strong>${assignedTeam}</strong></span>
              <div class="pick-actions">
                <button class="pick-button" type="button" data-player="${player}" data-team="${otherTeam}" data-action="move"${isSaving || full(otherTeam) ? " disabled" : ""} aria-label="Move ${player} to ${captains[otherTeam].name}">MOVE</button>
                <button class="pick-button remove-pick" type="button" data-player="${player}" data-team="${teamKey}" data-action="remove"${isSaving ? " disabled" : ""} aria-label="Remove ${player} from ${assignedTeam}">REMOVE</button>
              </div>
            </div>`
          : `<div class="pick-actions">
              <button class="pick-button" type="button" data-player="${player}" data-team="bonzo"${isSaving || full("bonzo") ? " disabled" : ""} aria-label="Pick ${player} for Bonzo">BONZO</button>
              <button class="pick-button caboose-pick" type="button" data-player="${player}" data-team="caboose"${isSaving || full("caboose") ? " disabled" : ""} aria-label="Pick ${player} for CabooseMa">CABOOSE</button>
            </div>`;
      } else {
        controls = `<span class="${teamKey ? "assigned-note" : "unassigned-note"}">${
          teamKey ? `Picked by <strong>${assignedTeam}</strong>` : "UNASSIGNED"
        }</span>`;
      }
      return `<div class="athlete-card${teamKey ? ` assigned-${teamKey}` : ""}">
        <span class="athlete-name">${player}</span>${controls}
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
      const winner = getGameWinner(index);
      const winnerClass = winner ? ` decided decided-${winner}` : "";
      const result = game.kind === "sets"
        ? renderSetMatch(index, isAdmin && remoteReady)
        : game.kind === "king"
          ? renderKingMatch(index, isAdmin && remoteReady)
          : game.kind === "one-vs-four"
            ? renderOneVsFour(index, isAdmin && remoteReady)
            : renderStandardResult(index, winner, isAdmin && remoteReady);
      return `<article class="game-card${winnerClass}">
        <header class="game-card-heading">
          <span class="game-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="game-name-wrap">
            <span class="game-name">${game.name}</span>
            ${game.note ? `<span class="game-note">${game.note}</span>` : ""}
          </span>
          <span class="game-format">${game.format}</span>
          <span class="game-overall${winner ? ` winner-${winner}` : ""}">${winner ? `${captains[winner].name} WON` : "PENDING"}</span>
        </header>
        <div class="game-card-content">${result}</div>
      </article>`;
    })
    .join("");
  elements.gameList.querySelectorAll("[data-match-action]").forEach((control) => {
    control.addEventListener("change", () => handleMatchControl(control));
  });
  elements.gameList.querySelectorAll("[data-winner]").forEach((button) => {
    button.addEventListener("click", () => handleWinnerButton(button));
  });
}

function renderStandardResult(index, winner, editable) {
  if (!editable) return `<span class="winner-label${winner ? ` winner-${winner}` : ""}">${winner ? `${captains[winner].name} WON` : "PENDING"}</span>`;
  const disabled = isSaving ? " disabled" : "";
  return `<div class="winner-actions">
    <span class="winner-action-label">WINNER</span>
    <button class="winner-button${winner === "bonzo" ? " selected-bonzo" : ""}" type="button" data-winner="bonzo" data-game="${index}" aria-label="${games[index].name}: Bonzo wins" aria-pressed="${winner === "bonzo"}"${disabled}>A · BONZO</button>
    <button class="winner-button${winner === "caboose" ? " selected-caboose" : ""}" type="button" data-winner="caboose" data-game="${index}" aria-label="${games[index].name}: CabooseMa wins" aria-pressed="${winner === "caboose"}"${disabled}>B · CABOOSEMA</button>
  </div>`;
}

function renderPlayerSelect(team, selected, action, gameIndex, roundIndex, slotIndex, selectedInGroup = []) {
  const options = getTeamPlayers(team);
  return `<select class="player-select" data-match-action="${action}" data-game="${gameIndex}" data-team="${team}" data-round="${roundIndex}" data-slot="${slotIndex}" aria-label="${captains[team].name} player ${slotIndex + 1}"${isSaving ? " disabled" : ""}>
    <option value="">Select player</option>
    ${options.map((player) => `<option value="${player}"${selected === player ? " selected" : ""}${selectedInGroup.includes(player) && selected !== player ? " disabled" : ""}>${player}</option>`).join("")}
  </select>`;
}

function renderSetMatch(index, editable) {
  const match = state.matchData[index];
  const rounds = match.rounds.map((round, roundIndex) => {
    const players = ["bonzo", "caboose"].map((team) => {
      const picks = round.players[team];
      const slots = Array.from({ length: round.size }, (_, slotIndex) =>
        editable
          ? renderPlayerSelect(
              team,
              picks[slotIndex] ?? "",
              "set-player",
              index,
              roundIndex,
              slotIndex,
              picks.filter((player) => player !== picks[slotIndex]),
            )
          : `<span class="selected-player">${picks[slotIndex] ?? "Player TBD"}</span>`,
      ).join("");
      return `<div class="match-team match-${team}">
        <span class="match-team-name">${captains[team].name}</span>
        <div class="match-player-list">${slots}</div>
      </div>`;
    }).join('<span class="match-vs">VS</span>');
    return `<section class="submatch">
      <div class="submatch-heading"><span>SET ${roundIndex + 1}</span><span>${round.size}V${round.size}</span></div>
      <div class="match-participants">${players}</div>
      ${renderSubmatchWinner(index, roundIndex, round.winner, editable)}
    </section>`;
  }).join("");
  const score = { bonzo: 0, caboose: 0 };
  match.rounds.forEach((round) => { if (round.winner) score[round.winner] += 1; });
  return `<div class="submatch-list">${rounds}</div>
    <div class="aggregate-score"><span>BEST OF 3</span><strong class="aggregate-bonzo">${score.bonzo}</strong><i>:</i><strong class="aggregate-caboose">${score.caboose}</strong><span>FIRST TO 2 WINS</span></div>`;
}

function renderSubmatchWinner(gameIndex, roundIndex, winner, editable) {
  if (!editable) return `<div class="submatch-result${winner ? ` winner-${winner}` : ""}">${winner ? `${captains[winner].name} won` : "Result pending"}</div>`;
  const disabled = isSaving ? " disabled" : "";
  return `<div class="winner-actions submatch-actions">
    <button class="winner-button${winner === "bonzo" ? " selected-bonzo" : ""}" type="button" data-winner="bonzo" data-game="${gameIndex}" data-round="${roundIndex}" aria-label="Set ${roundIndex + 1}: Bonzo wins"${disabled}>BONZO</button>
    <button class="winner-button${winner === "caboose" ? " selected-caboose" : ""}" type="button" data-winner="caboose" data-game="${gameIndex}" data-round="${roundIndex}" aria-label="Set ${roundIndex + 1}: CabooseMa wins"${disabled}>CABOOSEMA</button>
  </div>`;
}

function renderKingMatch(index, editable) {
  const data = state.matchData[index];
  const teamSelectors = ["bonzo", "caboose"].map((team) => {
    const lineup = data.queues[team];
    const slots = Array.from({ length: 5 }, (_, slotIndex) =>
      editable
        ? renderPlayerSelect(
            team,
            lineup[slotIndex] ?? "",
            "king-queue",
            index,
            -1,
            slotIndex,
            lineup.filter((player) => player !== lineup[slotIndex]),
          )
        : `<span class="selected-player">${lineup[slotIndex] ?? "Player TBD"}</span>`,
    ).join("");
    return `<div class="king-lineup match-${team}">
      <h4>${captains[team].name}${team === data.kingTeam && data.kingPlayer ? ` · KING: ${data.kingPlayer}` : ""}</h4>
      <div class="king-queue">${slots}</div>
    </div>`;
  }).join("");
  const kingSide = editable
    ? `<label class="king-side-picker">STARTING KING'S TEAM
        <select class="player-select team-select" data-match-action="king-team" data-game="${index}" aria-label="Choose the starting king's team"${isSaving ? " disabled" : ""}>
          <option value="">Select team</option>
          <option value="bonzo"${data.kingTeam === "bonzo" ? " selected" : ""}>Bonzo</option>
          <option value="caboose"${data.kingTeam === "caboose" ? " selected" : ""}>CabooseMa</option>
        </select>
      </label>`
    : `<span class="king-side-readonly">${data.kingTeam ? `Starting king: ${data.kingPlayer || "not selected"}` : "Starting king not selected"}</span>`;
  const simulation = simulateKingMatch(data);
  const fights = simulation.fights.map((fight, fightIndex) => `
    <div class="king-fight">
      <span class="fight-number">FIGHT ${fightIndex + 1}</span>
      <span class="fighter king-fighter">${fight.kingPlayer} <small>KING</small></span>
      <span class="match-vs">VS</span>
      <span class="fighter challenger">${fight.challenger}</span>
      ${renderFightWinner(index, fightIndex, fight.winner, editable)}
    </div>`).join("");
  const ready = data.kingTeam && data.queues.bonzo.length === 5 && data.queues.caboose.length === 5;
  const fightPanel = !ready
    ? `<p class="match-hint">Choose the starting king and set both five-player queues to begin.</p>`
    : `<div class="king-fight-list">${fights || `<p class="match-hint">No challenger is available.</p>`}</div>
       ${simulation.winner ? `<div class="king-victory">${captains[simulation.winner].name} wins the King of the Hill.</div>` : ""}`;
  return `<div class="king-setup">${kingSide}<div class="king-lineups">${teamSelectors}</div></div>${fightPanel}`;
}

function renderFightWinner(gameIndex, fightIndex, winner, editable) {
  if (!editable) return `<span class="submatch-result${winner ? ` winner-${winner}` : ""}">${winner ? captains[winner].name : "PENDING"}</span>`;
  const disabled = isSaving ? " disabled" : "";
  return `<div class="winner-actions fight-actions">
    <button class="winner-button${winner === "bonzo" ? " selected-bonzo" : ""}" type="button" data-winner="bonzo" data-game="${gameIndex}" data-fight="${fightIndex}" aria-label="Fight ${fightIndex + 1}: Bonzo wins"${disabled}>A</button>
    <button class="winner-button${winner === "caboose" ? " selected-caboose" : ""}" type="button" data-winner="caboose" data-game="${gameIndex}" data-fight="${fightIndex}" aria-label="Fight ${fightIndex + 1}: CabooseMa wins"${disabled}>B</button>
  </div>`;
}

function renderOneVsFour(index, editable) {
  const data = state.matchData[index];
  const soloTeam = data.soloTeam ?? "bonzo";
  const opponentTeam = soloTeam === "bonzo" ? "caboose" : "bonzo";
  const sideSelector = editable
    ? `<label class="match-field"><span>SOLO PLAYER'S TEAM</span>
        <select class="player-select team-select" data-match-action="solo-team" data-game="${index}"${isSaving ? " disabled" : ""}>
          <option value="bonzo"${soloTeam === "bonzo" ? " selected" : ""}>Bonzo</option>
          <option value="caboose"${soloTeam === "caboose" ? " selected" : ""}>CabooseMa</option>
        </select>
      </label>`
    : `<span class="match-team-name">${captains[soloTeam].name} · SOLO</span>`;
  const soloPlayer = editable
    ? renderPlayerSelect(soloTeam, data.soloPlayer, "solo-player", index, -1, 0)
    : `<span class="selected-player">${data.soloPlayer || "Solo player TBD"}</span>`;
  const opposingPlayers = Array.from({ length: 4 }, (_, slotIndex) => {
    const selected = data.opponents[slotIndex] ?? "";
    return editable
      ? renderPlayerSelect(
          opponentTeam,
          selected,
          "opponent-player",
          index,
          -1,
          slotIndex,
          data.opponents.filter((player) => player !== selected),
        )
      : `<span class="selected-player">${selected || "Player TBD"}</span>`;
  }).join("");
  return `<div class="one-four-setup">
    <div class="solo-side">${sideSelector}<div class="match-player-list">${soloPlayer}</div></div>
    <span class="match-vs">VS</span>
    <div class="four-side"><span class="match-team-name">${captains[opponentTeam].name} · FOUR</span><div class="match-player-list">${opposingPlayers}</div></div>
  </div>
  ${renderSubmatchWinner(index, 0, data.winners[0] ?? null, editable)}`;
}

function handleMatchControl(control) {
  if (!isAdmin || isSaving || !remoteReady) return;
  const gameIndex = Number(control.dataset.game);
  const matchData = structuredClone(state.matchData);
  const data = matchData[gameIndex];
  const team = control.dataset.team;
  const slot = Number(control.dataset.slot);
  const value = control.value;

  if (control.dataset.matchAction === "set-player") {
    const round = data.rounds[Number(control.dataset.round)];
    const players = [...round.players[team]];
    players[slot] = value || null;
    round.players[team] = players;
    round.winner = null;
  } else if (control.dataset.matchAction === "king-team") {
    data.kingTeam = value || null;
    data.kingPlayer = value ? data.queues[value][0] ?? "" : "";
    data.winners = [];
  } else if (control.dataset.matchAction === "king-queue") {
    const queue = [...data.queues[team]];
    queue[slot] = value || null;
    data.queues[team] = queue;
    if (data.kingTeam) data.kingPlayer = data.queues[data.kingTeam][0] ?? "";
    data.winners = [];
  } else if (control.dataset.matchAction === "solo-team") {
    data.soloTeam = value;
    data.soloPlayer = "";
    data.opponents = [];
    data.winners = [];
  } else if (control.dataset.matchAction === "solo-player") {
    data.soloPlayer = value;
    data.winners = [];
  } else if (control.dataset.matchAction === "opponent-player") {
    const opponents = [...data.opponents];
    opponents[slot] = value || null;
    data.opponents = opponents;
    data.winners = [];
  }

  persistMatchData(matchData);
}

function handleWinnerButton(button) {
  if (!isAdmin || isSaving || !remoteReady) return;
  const gameIndex = Number(button.dataset.game);
  const winner = button.dataset.winner;
  if (!captains[winner]) return;
  if (games[gameIndex].kind === "sets") {
    const matchData = structuredClone(state.matchData);
    const roundIndex = Number(button.dataset.round);
    const round = matchData[gameIndex].rounds[roundIndex];
    if (
      round.players.bonzo.filter(Boolean).length !== round.size ||
      round.players.caboose.filter(Boolean).length !== round.size
    ) {
      showToast(`Select all players for set ${roundIndex + 1} first.`);
      return;
    }
    round.winner = round.winner === winner ? null : winner;
    persistMatchData(matchData);
  } else if (games[gameIndex].kind === "king") {
    const matchData = structuredClone(state.matchData);
    const fightIndex = Number(button.dataset.fight);
    const winners = matchData[gameIndex].winners.slice(0, fightIndex);
    if (matchData[gameIndex].winners[fightIndex] !== winner) winners[fightIndex] = winner;
    matchData[gameIndex].winners = winners;
    persistMatchData(matchData);
  } else if (games[gameIndex].kind === "one-vs-four") {
    const matchData = structuredClone(state.matchData);
    const data = matchData[gameIndex];
    if (!data.soloPlayer || data.opponents.filter(Boolean).length !== 4) {
      showToast("Select the solo player and all four opponents first.");
      return;
    }
    data.winners = data.winners[0] === winner ? [] : [winner];
    persistMatchData(matchData);
  } else {
    setWinner(gameIndex, winner);
  }
}

function persistMatchData(matchData) {
  void persistState({ ...state, matchData });
}

function renderScore() {
  const winners = games.map((_, index) => getGameWinner(index));
  const bonzoWins = winners.filter((winner) => winner === "bonzo").length;
  const cabooseWins = winners.filter((winner) => winner === "caboose").length;
  const played = bonzoWins + cabooseWins;
  document.querySelector("#bonzo-score").textContent = bonzoWins;
  document.querySelector("#caboose-score").textContent = cabooseWins;
  document.querySelector("#bonzo-wins").textContent = String(bonzoWins).padStart(2, "0");
  document.querySelector("#caboose-wins").textContent = String(cabooseWins).padStart(2, "0");
  document.querySelector("#progress-fill").style.width = `${(played / games.length) * 100}%`;
  document.querySelector("#progress-label").textContent = `${played} / ${games.length} ROUNDS PLAYED`;
  document.querySelector("#games-summary-count").textContent = `${played} OF ${games.length} DECIDED`;
}

function renderAccess() {
  elements.loginButton.hidden = !configured || isSignedIn;
  elements.logoutButton.hidden = !isSignedIn;
  elements.resetButton.hidden = !isAdmin || isSaving || !remoteReady;
  elements.accessLabel.textContent = isAdmin
    ? "ADMIN MODE"
    : isSignedIn
      ? "VIEW ONLY"
      : "VIEW ONLY";
  elements.accessLabel.classList.toggle("admin", isAdmin);
  document.querySelector("#roster-instructions").textContent = isAdmin
    ? "Assign, move, or remove athletes. Four picks per team."
    : "Team rosters are visible to everyone. Editing is admin-only.";
  document.querySelector("#game-instructions").textContent = isAdmin
    ? "Set each game's lineup and record match results."
    : "Lineups and results update live. Only the admin can change them.";
  const teamsComplete = state.teams.bonzo.length === 4 && state.teams.caboose.length === 4;
  elements.draftPoolToggle.hidden = !teamsComplete;
  elements.draftPoolToggle.textContent = draftPoolHidden ? "Show draft pool" : "Hide draft pool";
  elements.draftPool.hidden = draftPoolHidden && teamsComplete;
}

function render() {
  renderRoster("bonzo", elements.bonzoRoster);
  renderRoster("caboose", elements.cabooseRoster);
  renderAthletes();
  renderGames();
  renderScore();
  renderAccess();
}

function setConnectionStatus(status, message = "") {
  elements.connectionStatus.textContent = status;
  if (message) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.classList.add("error");
  }
}

async function loadSharedState() {
  const { data, error } = await supabase
    .from("gauntlet_state")
    .select("state")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Shared match row is missing. Follow the database setup instructions.");
  const normalized = normalizeState(data.state);
  if (!normalized) throw new Error("The shared match data is invalid.");
  state = normalized;
  remoteReady = true;
  elements.saveStatus.textContent = "LIVE MATCH — CHANGES SYNC FOR EVERYONE";
  elements.saveStatus.classList.remove("error");
  render();
}

function applySession(session) {
  const user = session?.user;
  isSignedIn = Boolean(user);
  isAdmin = Boolean(user && config.adminUserId && user.id === config.adminUserId);
  render();
}

async function initialize() {
  if (!configured) {
    setConnectionStatus("SETUP REQUIRED", "SETUP REQUIRED — SEE SETUP.md");
    elements.loginButton.hidden = true;
    render();
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    applySession(data.session);
    supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    await loadSharedState();
    supabase
      .channel("gauntlet-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gauntlet_state", filter: "id=eq.1" },
        (payload) => {
          const normalized = normalizeState(payload.new.state);
          if (!normalized) {
            console.error("Received invalid shared match data.", payload.new.state);
            setConnectionStatus("SYNC ERROR", "SYNC ERROR — RECEIVED INVALID MATCH DATA");
            return;
          }
          state = normalized;
          elements.saveStatus.textContent = "LIVE MATCH — CHANGES SYNC FOR EVERYONE";
          elements.saveStatus.classList.remove("error");
          render();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          elements.connectionStatus.textContent = "LIVE";
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("OFFLINE", "REAL-TIME UPDATES UNAVAILABLE — REFRESH TO RETRY");
        }
      });
  } catch (error) {
    console.error("Could not connect to the shared match.", error);
    remoteReady = false;
    setConnectionStatus("OFFLINE", `MATCH CONNECTION FAILED — ${error.message}`);
    render();
  }
}

async function persistState(nextState) {
  const normalized = normalizeState(nextState);
  if (!isAdmin || !remoteReady || isSaving) return;
  if (!normalized) {
    const error = new Error("The updated match data failed validation.");
    console.error("Could not save the shared match.", error);
    showToast(error.message);
    return;
  }
  const previousState = state;
  isSaving = true;
  state = normalized;
  elements.saveStatus.textContent = "SAVING MATCH…";
  elements.saveStatus.classList.remove("error");
  render();
  try {
    const { data, error } = await supabase
      .from("gauntlet_state")
      .update({ state: normalized, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The database rejected this edit. Check the admin access policy.");
    elements.saveStatus.textContent = "SAVED — LIVE FOR EVERYONE";
    elements.saveStatus.classList.remove("error");
  } catch (error) {
    console.error("Could not save the shared match.", error);
    state = previousState;
    setConnectionStatus("SAVE ERROR", `SAVE FAILED — ${error.message}`);
    try {
      await loadSharedState();
    } catch (loadError) {
      console.error("Could not restore the last saved match.", loadError);
    }
  } finally {
    isSaving = false;
    render();
  }
}

function pickPlayer(player, team) {
  if (!isAdmin || !athletes.includes(player) || !captains[team]) return;
  if (state.teams.bonzo.includes(player) || state.teams.caboose.includes(player)) return;
  if (state.teams[team].length >= 4) {
    showToast(`${captains[team].name}'s team is full.`);
    return;
  }
  void persistState({
    ...state,
    teams: { ...state.teams, [team]: [...state.teams[team], player] },
    matchData: createMatchData(),
  });
}

function removePlayer(player, team) {
  if (!isAdmin || !captains[team] || !state.teams[team].includes(player)) return;
  void persistState({
    ...state,
    teams: { ...state.teams, [team]: state.teams[team].filter((name) => name !== player) },
    matchData: createMatchData(),
  });
}

function movePlayer(player, team) {
  if (!isAdmin || !captains[team]) return;
  const currentTeam = team === "bonzo" ? "caboose" : "bonzo";
  if (!state.teams[currentTeam].includes(player) || state.teams[team].length >= 4) return;
  void persistState({
    ...state,
    teams: {
      ...state.teams,
      [currentTeam]: state.teams[currentTeam].filter((name) => name !== player),
      [team]: [...state.teams[team], player],
    },
    matchData: createMatchData(),
  });
}

function setWinner(round, winner) {
  if (!isAdmin || !Number.isInteger(round) || round < 0 || round >= games.length) return;
  if (!captains[winner]) return;
  const winners = [...state.winners];
  winners[round] = winners[round] === winner ? null : winner;
  void persistState({ ...state, winners });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2500);
}

elements.loginButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.href },
  });
  if (error) {
    console.error("GitHub sign-in failed.", error);
    showToast(`GitHub sign-in failed: ${error.message}`);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Could not sign out.", error);
    showToast(`Sign-out failed: ${error.message}`);
  }
});

elements.resetButton.addEventListener("click", () => {
  if (!isAdmin || !window.confirm("Reset all team picks and round results? This cannot be undone.")) {
    return;
  }
  void persistState(structuredClone(initialState));
});

elements.draftPoolToggle.addEventListener("click", () => {
  const teamsComplete = state.teams.bonzo.length === 4 && state.teams.caboose.length === 4;
  if (!teamsComplete) return;
  draftPoolHidden = !draftPoolHidden;
  renderAccess();
});

render();
void initialize();
