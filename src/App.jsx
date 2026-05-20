import { useState, useEffect } from "react";

// ─── DATA ───────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = "Wiz2026CDM!";


const TOP_SCORERS_CDM = [
  "Kylian Mbappé (France)",
  "Erling Haaland (Norvège)",
  "Vinicius Jr (Brésil)",
  "Lionel Messi (Argentine)",
  "Lamine Yamal (Espagne)",
  "Harry Kane (Angleterre)",
  "Romelu Lukaku (Belgique)",
  "Bukayo Saka (Angleterre)",
  "Pedri (Espagne)",
  "Ferran Torres (Espagne)",
  "Rafael Leão (Portugal)",
  "Diogo Jota (Portugal)",
  "Gonçalo Ramos (Portugal)",
  "Ousmane Dembélé (France)",
  "Marcus Thuram (France)",
  "Randal Kolo Muani (France)",
  "Serhou Guirassy (Sénégal)",
  "Sadio Mané (Sénégal)",
  "Victor Osimhen (Nigeria → Égypte non qualifiée)",
  "Robert Lewandowski (Pologne → non qualifié)",
  "Niclas Füllkrug (Allemagne)",
  "Kai Havertz (Allemagne)",
  "Alvaro Morata (Espagne)",
  "Darwin Núñez (Uruguay)",
  "Facundo Torres (Uruguay)",
  "Julian Alvarez (Argentine)",
  "Lautaro Martínez (Argentine)",
  "Richarlison (Brésil)",
  "Karim Benzema (Arabie saoudite)",
  "Mehdi Taremi (Iran)",
];

// Vrais groupes CDM 2026 — 48 équipes, 12 groupes de 4
const GROUPS = {
  A: ["Mexique", "Corée du Sud", "Tchéquie", "Afrique du Sud"],
  B: ["Suisse", "Canada", "Bosnie-Herzégovine", "Qatar"],
  C: ["Brésil", "Maroc", "Écosse", "Haïti"],
  D: ["Turquie", "États-Unis", "Australie", "Paraguay"],
  E: ["Allemagne", "Côte d'Ivoire", "Équateur", "Curaçao"],
  F: ["Pays-Bas", "Japon", "Suède", "Tunisie"],
  G: ["Belgique", "Iran", "Égypte", "Nouvelle-Zélande"],
  H: ["Espagne", "Uruguay", "Arabie saoudite", "Cap-Vert"],
  I: ["France", "Sénégal", "Norvège", "Irak"],
  J: ["Argentine", "Autriche", "Algérie", "Jordanie"],
  K: ["Portugal", "Colombie", "Ouzbékistan", "RD Congo"],
  L: ["Angleterre", "Croatie", "Ghana", "Panama"],
};

// 72 matchs de poules — chaque équipe joue 3 matchs dans son groupe
const GROUP_MATCHES = [];
Object.entries(GROUPS).forEach(([group, [t0, t1, t2, t3]]) => {
  GROUP_MATCHES.push(
    { id: `${group}1`, group, home: t0, away: t1 },
    { id: `${group}2`, group, home: t2, away: t3 },
    { id: `${group}3`, group, home: t0, away: t2 },
    { id: `${group}4`, group, home: t1, away: t3 },
    { id: `${group}5`, group, home: t0, away: t3 },
    { id: `${group}6`, group, home: t1, away: t2 },
  );
});

// Phase KO — 32 équipes (2 premiers + 8 meilleurs 3es)
// Score KO = score à la fin des prolongations
// Vainqueur KO = équipe qui passe (tient compte des tirs au but)
const KO_PHASES = [
  { key: "R16", label: "Seizièmes de finale", matches: 16 },
  { key: "QF",  label: "Quarts de finale",    matches: 8  },
  { key: "SF",  label: "Demi-finales",         matches: 4  },
  { key: "F",   label: "Finale",               matches: 1  },
];

// ─── STANDINGS CALCULATOR (raw, utilisé tôt dans calcScore) ──────────────────

function calcGroupStandingsRaw(group, groupResults) {
  const teams = GROUPS[group];
  const stats = {};
  teams.forEach(t => {
    stats[t] = { pts: 0, gf: 0, ga: 0, gd: 0, played: 0, originalIdx: teams.indexOf(t) };
  });

  // Calcul des stats générales
  GROUP_MATCHES.filter(m => m.group === group).forEach(m => {
    const r = groupResults?.[m.id];
    if (!r || r.homeScore === "" || r.awayScore === "") return;
    const h = parseInt(r.homeScore), a = parseInt(r.awayScore);
    if (isNaN(h) || isNaN(a)) return;
    stats[m.home].played++; stats[m.away].played++;
    stats[m.home].gf += h; stats[m.home].ga += a;
    stats[m.away].gf += a; stats[m.away].ga += h;
    stats[m.home].gd += (h - a);
    stats[m.away].gd += (a - h);
    if (h > a)      { stats[m.home].pts += 3; }
    else if (h < a) { stats[m.away].pts += 3; }
    else            { stats[m.home].pts += 1; stats[m.away].pts += 1; }
  });

  // Confrontations directes entre deux équipes (règle FIFA)
  function h2h(teamA, teamB) {
    let ptsA = 0, ptsB = 0, gdA = 0, gfA = 0;
    GROUP_MATCHES.filter(m => m.group === group &&
      ((m.home === teamA && m.away === teamB) || (m.home === teamB && m.away === teamA))
    ).forEach(m => {
      const r = groupResults?.[m.id];
      if (!r || r.homeScore === "" || r.awayScore === "") return;
      const h = parseInt(r.homeScore), a = parseInt(r.awayScore);
      if (isNaN(h) || isNaN(a)) return;
      const [hA, hB] = m.home === teamA ? [h, a] : [a, h];
      if (hA > hB)      { ptsA += 3; }
      else if (hA < hB) { ptsB += 3; }
      else              { ptsA += 1; ptsB += 1; }
      gdA += (hA - hB);
      gfA += hA;
    });
    return { ptsA, ptsB, gdA, gfA };
  }

  const rows = teams.map(t => ({ team: t, ...stats[t] }));

  rows.sort((a, b) => {
    // 1. Points généraux
    if (b.pts !== a.pts) return b.pts - a.pts;
    // 2. Confrontation directe : points
    const duel = h2h(a.team, b.team);
    if (duel.ptsA !== duel.ptsB) return duel.ptsB - duel.ptsA;
    // 3. Confrontation directe : différence de buts
    if (duel.gdA !== 0) return -duel.gdA;
    // 4. Confrontation directe : buts marqués
    if (duel.gfA !== 0) return -duel.gfA;
    // 5. Différence de buts générale
    if (b.gd !== a.gd) return b.gd - a.gd;
    // 6. Buts marqués généraux
    if (b.gf !== a.gf) return b.gf - a.gf;
    // 7. Ordre original (tirage au sort)
    return a.originalIdx - b.originalIdx;
  });

  return rows;
}

// ─── SCORE CALCULATION ───────────────────────────────────────────────────────

function calcScore(player, results) {
  let total = 0;
  const detail = {};

  // Pronostics matchs de poules
  (player.predictions || []).forEach((pred) => {
    const res = results.groupResults?.[pred.matchId];
    if (!res || res.homeScore === "" || res.awayScore === "") return;
    const realHome = parseInt(res.homeScore);
    const realAway = parseInt(res.awayScore);
    const predHome = parseInt(pred.home);
    const predAway = parseInt(pred.away);
    if (isNaN(predHome) || isNaN(predAway)) return;

    if (predHome === realHome && predAway === realAway) {
      total += 3;
      detail[pred.matchId] = 3;
    } else {
      const realWinner = realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";
      const predWinner = predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";
      if (realWinner === predWinner) {
        total += 1;
        detail[pred.matchId] = 1;
      } else {
        detail[pred.matchId] = 0;
      }
    }
  });

  // Classement de groupe — comparaison classement pronostiqué vs classement réel calculé
  Object.keys(GROUPS).forEach(group => {
    // Classement réel calculé automatiquement depuis les vrais scores
    const realStandings = calcGroupStandingsRaw(group, results?.groupResults || {});
    if (!realStandings.some(s => s.played > 0)) return; // groupe pas encore joué

    // Reconstruit le classement pronostiqué depuis les scores saisis par le joueur
    const fakePreds = {};
    let groupPredCount = 0;
    (player.predictions || []).forEach(pred => {
      if (pred.home !== "" && pred.away !== "" && !isNaN(parseInt(pred.home)) && !isNaN(parseInt(pred.away))) {
        // Vérifier que ce match appartient bien à ce groupe
        const match = GROUP_MATCHES.find(m => m.id === pred.matchId && m.group === group);
        if (match) {
          fakePreds[pred.matchId] = { homeScore: pred.home, awayScore: pred.away };
          groupPredCount++;
        }
      }
    });

    // Ne calculer les +2 que si le joueur a pronostiqué AU MOINS les 6 matchs du groupe
    if (groupPredCount < 6) return;

    const predStandings = calcGroupStandingsRaw(group, fakePreds);
    predStandings.forEach((s, idx) => {
      if (realStandings[idx]?.team === s.team) {
        total += 2;
        detail[`rank_${group}_${idx}`] = 2;
      }
    });
  });

  // Pronostics KO (score après prolongations, vainqueur avec TAB)
  Object.entries(player.koPredictions || {}).forEach(([phase, preds]) => {
    const realPreds = results.koResults?.[phase] || {};
    (preds || []).forEach((pred) => {
      if (!pred.matchId || !pred.winner) return;
      const real = realPreds[pred.matchId];
      if (!real?.winner) return;
      const winnerOk = pred.winner.toLowerCase().trim() === real.winner.toLowerCase().trim();
      if (!winnerOk) { detail[`ko_${phase}_${pred.matchId}`] = 0; return; }
      // Score exact après prolongations = 3 pts (si pas de TAB, score normal ; si TAB, score à la fin des prolong)
      const scoreOk =
        pred.homeScore !== undefined && pred.awayScore !== undefined &&
        real.homeScore !== undefined && real.awayScore !== undefined &&
        parseInt(pred.homeScore) === parseInt(real.homeScore) &&
        parseInt(pred.awayScore) === parseInt(real.awayScore);
      if (scoreOk) {
        total += 3;
        detail[`ko_${phase}_${pred.matchId}`] = 3;
      } else {
        total += 2;
        detail[`ko_${phase}_${pred.matchId}`] = 2;
      }
    });
  });

  // Bonus vainqueur final (+5 pts)
  if (player.bonusPredictions?.winner && results.bonusResults?.winner) {
    if (player.bonusPredictions.winner.toLowerCase().trim() === results.bonusResults.winner.toLowerCase().trim()) {
      total += 5;
      detail["bonus_winner"] = 5;
    }
  }

  // Bonus meilleur buteur (+5 pts)
  if (player.bonusPredictions?.topScorer && results.bonusResults?.topScorer) {
    const normalizeScorer = s => s.toLowerCase().trim().replace(/\s*\(.*\)/, "").trim();
    if (normalizeScorer(player.bonusPredictions.topScorer) === normalizeScorer(results.bonusResults.topScorer)) {
      total += 5;
      detail["bonus_topScorer"] = 5;
    }
  }

  return { total, detail };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const FLAGS = {
  // Groupe A
  "Mexique": "🇲🇽", "Corée du Sud": "🇰🇷", "Tchéquie": "🇨🇿", "Afrique du Sud": "🇿🇦",
  // Groupe B
  "Suisse": "🇨🇭", "Canada": "🇨🇦", "Bosnie-Herzégovine": "🇧🇦", "Qatar": "🇶🇦",
  // Groupe C
  "Brésil": "🇧🇷", "Maroc": "🇲🇦", "Écosse": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Haïti": "🇭🇹",
  // Groupe D
  "Turquie": "🇹🇷", "États-Unis": "🇺🇸", "Australie": "🇦🇺", "Paraguay": "🇵🇾",
  // Groupe E
  "Allemagne": "🇩🇪", "Côte d'Ivoire": "🇨🇮", "Équateur": "🇪🇨", "Curaçao": "🇨🇼",
  // Groupe F
  "Pays-Bas": "🇳🇱", "Japon": "🇯🇵", "Suède": "🇸🇪", "Tunisie": "🇹🇳",
  // Groupe G
  "Belgique": "🇧🇪", "Iran": "🇮🇷", "Égypte": "🇪🇬", "Nouvelle-Zélande": "🇳🇿",
  // Groupe H
  "Espagne": "🇪🇸", "Uruguay": "🇺🇾", "Arabie saoudite": "🇸🇦", "Cap-Vert": "🇨🇻",
  // Groupe I
  "France": "🇫🇷", "Sénégal": "🇸🇳", "Norvège": "🇳🇴", "Irak": "🇮🇶",
  // Groupe J
  "Argentine": "🇦🇷", "Autriche": "🇦🇹", "Algérie": "🇩🇿", "Jordanie": "🇯🇴",
  // Groupe K
  "Portugal": "🇵🇹", "Colombie": "🇨🇴", "Ouzbékistan": "🇺🇿", "RD Congo": "🇨🇩",
  // Groupe L
  "Angleterre": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croatie": "🇭🇷", "Ghana": "🇬🇭", "Panama": "🇵🇦",
};

function flag(team) {
  return FLAGS[team] || "🏳️";
}

function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── SUPABASE STORAGE ────────────────────────────────────────────────────────

const SUPA_URL = "https://xbgxigaqcrghbpjeovgl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ3hpZ2FxY3JnaGJwamVvdmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTk3MDcsImV4cCI6MjA5NDU5NTcwN30.HQow6YC5vajBS0uvrCT3wv2GsahlPCCdJhLjqVZxYW8";

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadData(key) {
  try {
    const table = key === "players" ? "players" : "results";
    if (key === "players") {
      const rows = await supaFetch("players?select=id,data");
      return rows ? rows.map(r => r.data) : [];
    } else {
      const rows = await supaFetch("results?select=data&id=eq.main");
      return rows && rows.length > 0 ? rows[0].data : null;
    }
  } catch (e) { console.error("loadData error:", e); return key === "players" ? [] : null; }
}

async function saveData(key, value) {
  try {
    if (key === "players") {
      // Upsert chaque joueur individuellement
      const players = value;
      // Supprimer les joueurs qui n'existent plus
      const ids = players.map(p => p.id);
      // On fait un upsert de tous les joueurs
      for (const player of players) {
        await supaFetch("players", {
          method: "POST",
          headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ id: player.id, data: player }),
        });
      }
      // Supprimer les joueurs retirés
      if (ids.length > 0) {
        const idList = ids.map(id => `"${id}"`).join(",");
        await supaFetch(`players?id=not.in.(${idList})`, { method: "DELETE" });
      } else {
        await supaFetch("players", { method: "DELETE" });
      }
    } else {
      await supaFetch("results", {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: "main", data: value }),
      });
    }
  } catch (e) { console.error("saveData error:", e); }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("home"); // home | register | player | admin
  const [players, setPlayers] = useState([]);
  const [results, setResults] = useState({ groupResults: {}, koResults: {}, groupRankings: {}, locked: false });
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await loadData("players");
      const r = await loadData("results");
      if (p) setPlayers(p);
      if (r) setResults(r);
      setLoading(false);
    })();
  }, []);

  async function updatePlayers(p) {
    setPlayers(p);
    await saveData("players", p);
  }

  async function updateResults(r) {
    setResults(r);
    await saveData("results", r);
  }

  if (loading) return (
    <div style={styles.loading}>
      <div style={styles.loadingBall}>⚽</div>
      <p style={styles.loadingText}>Chargement…</p>
    </div>
  );

  return (
    <div style={styles.root}>
      <Header screen={screen} setScreen={setScreen} currentPlayer={currentPlayer} setCurrentPlayer={setCurrentPlayer} adminAuth={adminAuth} setAdminAuth={setAdminAuth} />
      <main style={styles.main}>
        {screen === "home" && <HomeScreen setScreen={setScreen} players={players} results={results} />}
        {screen === "register" && <RegisterScreen players={players} updatePlayers={updatePlayers} setScreen={setScreen} setCurrentPlayer={setCurrentPlayer} />}
        {screen === "player" && currentPlayer && <PlayerScreen player={currentPlayer} players={players} updatePlayers={updatePlayers} results={results} updateResults={updateResults} setCurrentPlayer={setCurrentPlayer} />}
        {screen === "admin" && <AdminScreen adminAuth={adminAuth} setAdminAuth={setAdminAuth} results={results} updateResults={updateResults} players={players} updatePlayers={updatePlayers} />}
        {screen === "leaderboard" && <LeaderboardScreen players={players} results={results} />}
        {screen === "login" && <LoginScreen players={players} setCurrentPlayer={setCurrentPlayer} setScreen={setScreen} />}
      </main>
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────

function Header({ screen, setScreen, currentPlayer, setCurrentPlayer, adminAuth, setAdminAuth }) {
  return (
    <header style={styles.header}>
      <div style={styles.headerInner}>
        <button style={styles.logo} onClick={() => setScreen("home")}>
          <span style={styles.logoIcon}>⚽</span>
          <span style={styles.logoText}>CDM 2026</span>
          <span style={styles.logoBadge}>PRONOS</span>
        </button>
        <nav style={styles.nav}>
          <NavBtn label="🏆 Classement" onClick={() => setScreen("leaderboard")} active={screen === "leaderboard"} />
          {currentPlayer
            ? <NavBtn label={`👤 ${currentPlayer.name.split(" ")[0]}`} onClick={() => setScreen("player")} active={screen === "player"} />
            : <NavBtn label="🎮 Jouer" onClick={() => setScreen("login")} active={screen === "login" || screen === "register"} />
          }
          <NavBtn label="⚙️ Admin" onClick={() => setScreen("admin")} active={screen === "admin"} />
        </nav>
      </div>
    </header>
  );
}

function NavBtn({ label, onClick, active }) {
  return (
    <button style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }} onClick={onClick}>
      {label}
    </button>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ setScreen, players, results }) {
  const ranked = [...players]
    .map(p => ({ ...p, score: calcScore(p, results).total }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const pot = players.length * 2;
  const prizes = [Math.round(pot * 0.6), Math.round(pot * 0.25), Math.round(pot * 0.15)];

  return (
    <div style={styles.homeWrap}>
      <div style={styles.hero}>
        <div style={styles.heroGlow} />
        <h1 style={styles.heroTitle}>Coupe du Monde 2026</h1>
        <p style={styles.heroSub}>Pronostics entre amis · {players.length} joueur{players.length > 1 ? "s" : ""} inscrit{players.length > 1 ? "s" : ""}</p>
        <div style={styles.heroActions}>
          <button style={styles.btnPrimary} onClick={() => setScreen("login")}>🎮 Mes pronostics</button>
          <button style={styles.btnSecondary} onClick={() => setScreen("register")}>✨ S'inscrire</button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.card}>
          <div style={styles.cardIcon}>💰</div>
          <div style={styles.cardLabel}>Cagnotte</div>
          <div style={styles.cardValue}>{pot}€</div>
          <div style={styles.cardSub}>
            🥇 {prizes[0]}€ · 🥈 {prizes[1]}€ · 🥉 {prizes[2]}€
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardIcon}>👥</div>
          <div style={styles.cardLabel}>Joueurs</div>
          <div style={styles.cardValue}>{players.length} / ~30</div>
          <div style={styles.cardSub}>2€ par joueur</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardIcon}>⚽</div>
          <div style={styles.cardLabel}>Matchs</div>
          <div style={styles.cardValue}>{GROUP_MATCHES.length}</div>
          <div style={styles.cardSub}>Phase de poules</div>
        </div>
      </div>

      <div style={styles.rulesBox}>
        <h3 style={styles.rulesTitle}>📋 Règlement</h3>
        <div style={styles.rulesGrid}>
          <RuleItem icon="🎯" label="Score exact (poules)" pts="3 pts" />
          <RuleItem icon="✅" label="Bon vainqueur (poules)" pts="1 pt" />
          <RuleItem icon="📊" label="Classement de groupe" pts="2 pts / place" />
          <RuleItem icon="🎯" label="Score exact phase finale (prolong.)" pts="3 pts" />
          <RuleItem icon="✅" label="Bon vainqueur phase finale (TAB ✓)" pts="2 pts" />
          <RuleItem icon="🏆" label="Vainqueur final CDM" pts="+5 pts bonus" />
          <RuleItem icon="⚽" label="Meilleur buteur" pts="+5 pts bonus" />
        </div>
      </div>
    </div>
  );
}

function RuleItem({ icon, label, pts }) {
  return (
    <div style={styles.ruleItem}>
      <span style={styles.ruleIcon}>{icon}</span>
      <span style={styles.ruleLabel}>{label}</span>
      <span style={styles.rulePts}>{pts}</span>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginScreen({ players, setCurrentPlayer, setScreen }) {
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  function handlePinSubmit() {
    if (!selectedPlayer) return;
    if (selectedPlayer.pin && selectedPlayer.pin !== pin) {
      setPinError("Code incorrect, réessayez.");
      setPin("");
      return;
    }
    setCurrentPlayer(selectedPlayer);
    setScreen("player");
  }

  if (selectedPlayer) return (
    <div style={styles.formWrap}>
      <button style={{ ...styles.linkBtn, marginBottom: 8 }} onClick={() => { setSelectedPlayer(null); setPin(""); setPinError(""); }}>← Retour</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={styles.avatarLg}>{getInitials(selectedPlayer.name)}</div>
        <div>
          <h2 style={{ ...styles.playerName, margin: 0 }}>{selectedPlayer.name}</h2>
          <p style={styles.hint}>Entrez votre code à 4 chiffres</p>
        </div>
      </div>
      {selectedPlayer.pin ? (
        <>
          <input style={{ ...styles.input, fontSize: 24, letterSpacing: 8, textAlign: "center" }}
            type="password" inputMode="numeric" maxLength={4} placeholder="••••"
            value={pin} onChange={e => { setPin(e.target.value.replace(/[^0-9]/g,"")); setPinError(""); }}
            onKeyDown={e => e.key === "Enter" && handlePinSubmit()} autoFocus />
          {pinError && <p style={styles.error}>{pinError}</p>}
          <button style={styles.btnPrimary} onClick={handlePinSubmit}>Accéder →</button>
        </>
      ) : (
        <>
          <p style={{ ...styles.hint, color: "#f59e0b" }}>⚠️ Ce joueur n'a pas de code (inscription ancienne). Accès direct.</p>
          <button style={styles.btnPrimary} onClick={() => { setCurrentPlayer(selectedPlayer); setScreen("player"); }}>Accéder →</button>
        </>
      )}
    </div>
  );

  return (
    <div style={styles.formWrap}>
      <h2 style={styles.formTitle}>👤 Choisir votre profil</h2>
      <input style={styles.input} placeholder="Rechercher votre nom…" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={styles.playerList}>
        {filtered.length === 0 && <p style={styles.empty}>Aucun joueur trouvé. <button style={styles.linkBtn} onClick={() => setScreen("register")}>S'inscrire ?</button></p>}
        {filtered.map(p => (
          <button key={p.id} style={styles.playerListItem} onClick={() => { setSelectedPlayer(p); setPin(""); setPinError(""); }}>
            <div style={styles.avatarSm}>{getInitials(p.name)}</div>
            <span style={{ flex: 1 }}>{p.name}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{p.pin ? "🔐" : "⚠️"}</span>
            <span style={styles.chevron}>›</span>
          </button>
        ))}
      </div>
      <p style={styles.hint}>Pas encore inscrit ? <button style={styles.linkBtn} onClick={() => setScreen("register")}>Créer un compte</button></p>
    </div>
  );
}

// ─── REGISTER ────────────────────────────────────────────────────────────────

function RegisterScreen({ players, updatePlayers, setScreen, setCurrentPlayer }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [winner, setWinner] = useState("");
  const [topScorer, setTopScorer] = useState("");
  const [error, setError] = useState("");

  const allTeams = Object.values(GROUPS).flat();

  function handleRegister() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Entrez votre prénom et nom.");
    if (!winner.trim()) return setError("Indiquez votre vainqueur de la Coupe du Monde.");
    if (!topScorer.trim()) return setError("Indiquez votre meilleur buteur.");
    if (!/^[0-9]{4}$/.test(pin)) return setError("Le code doit être exactement 4 chiffres.");
    if (players.find(p => p.name.toLowerCase() === trimmed.toLowerCase())) return setError("Ce nom est déjà pris.");
    const newPlayer = {
      id: Date.now().toString(),
      name: trimmed,
      pin: pin,
      predictions: [],
      groupRankPredictions: {},
      koPredictions: {},
      bonusPredictions: { winner: winner.trim(), topScorer: topScorer.trim() }
    };
    const updated = [...players, newPlayer];
    updatePlayers(updated);
    setCurrentPlayer(newPlayer);
    setScreen("player");
  }

  return (
    <div style={styles.formWrap}>
      <h2 style={styles.formTitle}>✨ Inscription</h2>
      <p style={styles.hint}>Participez au pronostic Coupe du Monde 2026 !</p>

      <label style={styles.label}>Votre prénom et nom</label>
      <input style={styles.input} placeholder="Ex: Jean Dupont" value={name}
        onChange={e => { setName(e.target.value); setError(""); }}
        onKeyDown={e => e.key === "Enter" && handleRegister()} />

      <label style={styles.label}>Code secret à 4 chiffres <span style={{ color: C.textMuted, fontSize: 11 }}>(pour vous reconnecter)</span></label>
      <input style={styles.input} type="password" inputMode="numeric" maxLength={4} placeholder="Ex: 1234"
        value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g,"")); setError(""); }} />

      <div style={styles.bonusBox}>
        <div style={styles.bonusTitle}>🌟 Pronos bonus (à saisir maintenant, non modifiables)</div>
        <label style={styles.label}>🏆 Vainqueur de la Coupe du Monde <span style={styles.bonusPts}>+5 pts</span></label>
        <select style={styles.select} value={winner} onChange={e => { setWinner(e.target.value); setError(""); }}>
          <option value="">-- Choisir une équipe --</option>
          {allTeams.map(t => <option key={t} value={t}>{flag(t)} {t}</option>)}
        </select>

        <label style={{ ...styles.label, marginTop: 10 }}>⚽ Meilleur buteur <span style={styles.bonusPts}>+5 pts</span></label>
        <select style={styles.select}
          value={TOP_SCORERS_CDM.includes(topScorer) ? topScorer : (topScorer ? "__autre__" : "")}
          onChange={e => { if(e.target.value === "__autre__") setTopScorer(""); else setTopScorer(e.target.value); setError(""); }}>
          <option value="">-- Choisir un joueur --</option>
          {TOP_SCORERS_CDM.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__autre__">Autre (saisie libre)</option>
        </select>
        {/* Saisie libre si joueur hors liste et champ non vide, ou si "Autre" explicitement sélectionné */}
        {topScorer !== "" && !TOP_SCORERS_CDM.includes(topScorer) && (
          <input style={{ ...styles.input, marginTop: 4 }} placeholder="Saisir le nom du joueur"
            value={topScorer}
            onChange={e => { setTopScorer(e.target.value); setError(""); }} />
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      <button style={styles.btnPrimary} onClick={handleRegister}>S'inscrire →</button>
      <p style={styles.hint}>Déjà inscrit ? <button style={styles.linkBtn} onClick={() => setScreen("login")}>Se connecter</button></p>
    </div>
  );
}

// ─── PLAYER SCREEN ────────────────────────────────────────────────────────────

const PLAYER_TABS = [
  { key: "pronos",    label: "🎯 Pronostics" },
  { key: "mespronos", label: "📋 Mes classements" },
  { key: "joueurs",   label: "🏆 Classement joueurs" },
  { key: "reel",      label: "📊 Classement réel" },
  { key: "fin",       label: "🌟 Fin de tournoi" },
];

function PlayerScreen({ player, players, updatePlayers, results, updateResults, setCurrentPlayer }) {
  const [tab, setTab] = useState("pronos");
  const [preds, setPreds] = useState(() => {
    const map = {};
    (player.predictions || []).forEach(p => { map[p.matchId] = { home: p.home ?? "", away: p.away ?? "" }; });
    return map;
  });
  const [koPreds, setKoPreds] = useState(player.koPredictions || {});
  const [saved, setSaved] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);

  const isLocked = !!player.locked;
  const globalLocked = !!results.locked;
  const locked = isLocked || globalLocked;

  const { total, detail } = calcScore(player, results);

  function saveDraft() {
    if (locked) return;
    const predictions = Object.entries(preds).map(([matchId, v]) => ({ matchId, home: v.home, away: v.away }));
    const updated = players.map(p => p.id === player.id
      ? { ...p, predictions, koPredictions: koPreds, locked: false }
      : p);
    updatePlayers(updated);
    setCurrentPlayer(updated.find(p => p.id === player.id));
    setSaved("draft");
    setTimeout(() => setSaved(false), 2500);
  }

  function saveFinal() {
    if (locked) return;
    if (!confirmLock) { setConfirmLock(true); return; }
    const predictions = Object.entries(preds).map(([matchId, v]) => ({ matchId, home: v.home, away: v.away }));
    const updated = players.map(p => p.id === player.id
      ? { ...p, predictions, koPredictions: koPreds, locked: true }
      : p);
    updatePlayers(updated);
    setCurrentPlayer(updated.find(p => p.id === player.id));
    setConfirmLock(false);
    setSaved("final");
    setTimeout(() => setSaved(false), 3000);
  }

  // Banner si nouvelle phase ouverte non encore pronostiquée
  const openPhase = results.openKoPhase || "none";
  const phasePreds = koPreds[openPhase] || [];
  const phaseHasPreds = openPhase !== "none" && phasePreds.length > 0 && phasePreds.some(p => p.winner);
  const showPhaseBanner = openPhase !== "none" && !phaseHasPreds && !locked;

  return (
    <div style={styles.playerWrap}>
      {showPhaseBanner && (
        <div style={{ background: "#1a0d00", border: "1px solid #f97316", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
          <strong style={{ color: "#f97316" }}>🆕 Nouvelle phase ouverte !</strong>
          <p style={{ color: C.textMuted, fontSize: 12, margin: "4px 0 6px" }}>
            Tu peux maintenant pronostiquer les <strong style={{ color: C.text }}>{{ "R16": "Seizièmes", "QF": "Huitièmes", "SF": "Demi-finales", "F": "Finale" }[openPhase]}</strong>.
            Va dans l'onglet "🎯 Pronostics" et n'oublie pas de valider !
          </p>
          <button style={{ ...styles.btnPrimary, width: "auto", fontSize: 12, padding: "6px 12px", background: "#f97316" }}
            onClick={() => setTab("pronos")}>Saisir mes pronostics →</button>
        </div>
      )}
      <div style={styles.playerHeader}>
        <div style={styles.avatarLg}>{getInitials(player.name)}</div>
        <div>
          <h2 style={styles.playerName}>{player.name}</h2>
          <div style={styles.scoreDisplay}>🏆 Score : <strong>{total} pts</strong></div>
          <div style={{ fontSize: 11, marginTop: 2, color: locked ? "#22c55e" : "#f59e0b" }}>
            {locked ? (isLocked ? "🔒 Pronostics verrouillés" : "🔒 Verrouillé par l'admin") : "✏️ Brouillon — pensez à valider définitivement"}
          </div>
        </div>
      </div>

      {/* Onglets scrollables */}
      <div style={styles.tabs}>
        {PLAYER_TABS.map(t => (
          <button key={t.key}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. PRONOSTICS — scores poules + phase KO */}
      {tab === "pronos" && (
        <div>
          <div style={styles.sectionLabel}>⚽ Matchs de poules</div>
          <GroupMatchesTab preds={preds} setPreds={setPreds} results={results} detail={detail} locked={locked} />
          <div style={{ ...styles.sectionLabel, marginTop: 16 }}>🏆 Phase finale</div>
          <KOTab koPreds={koPreds} setKoPreds={setKoPreds} results={results} detail={detail} locked={locked} lockedKoPhases={player.lockedKoPhases || []} />
          {/* Bouton valider la phase KO ouverte */}
          {openPhase !== "none" && !locked && !(player.lockedKoPhases || []).includes(openPhase) && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#1a1208", border: "1px solid #f97316", borderRadius: 10 }}>
              <p style={{ ...styles.hint, color: "#f97316", marginBottom: 8 }}>
                <strong>Phase ouverte : {{ R16: "Seizièmes", QF: "Huitièmes", SF: "Demi-finales", F: "Finale" }[openPhase]}</strong> — pensez à valider vos pronostics avant la fermeture !
              </p>
              <button style={{ ...styles.btnPrimary, background: "#f97316" }}
                onClick={() => {
                  {
                    const predictions = Object.entries(preds).map(([matchId, v]) => ({ matchId, home: v.home, away: v.away }));
                    const updated = players.map(p => p.id === player.id
                      ? { ...p, predictions, koPredictions: koPreds, lockedKoPhases: [...(p.lockedKoPhases || []), openPhase] }
                      : p);
                    updatePlayers(updated);
                    setCurrentPlayer(updated.find(p => p.id === player.id));
                  }
                }}>
                🔒 Valider mes pronostics — {{ R16: "Seizièmes", QF: "Huitièmes", SF: "Demi-finales", F: "Finale" }[openPhase]}
              </button>
            </div>
          )}
          {openPhase !== "none" && (player.lockedKoPhases || []).includes(openPhase) && (
            <p style={{ ...styles.hint, color: "#22c55e", marginTop: 8 }}>✅ Pronostics des {{ R16: "Seizièmes", QF: "Huitièmes", SF: "Demi-finales", F: "Finale" }[openPhase]} verrouillés.</p>
          )}
        </div>
      )}

      {/* 2. FIN DE TOURNOI — vainqueur + meilleur buteur */}
      {tab === "fin" && (
        <BonusTab player={player} results={results} detail={detail} />
      )}

      {/* 3. CLASSEMENT RÉEL CDM — tableaux de groupes calculés auto */}
      {tab === "reel" && (
        <GroupRankingsTab results={results} detail={detail} />
      )}

      {/* 4. CLASSEMENT DES JOUEURS */}
      {tab === "joueurs" && (
        <LeaderboardScreen players={players} results={results} compact />
      )}

      {/* 5. MES CLASSEMENTS — classement déduit des scores pronostiqués */}
      {tab === "mespronos" && (
        <MyGroupPredictionsTab
          playerPredictions={Object.entries(preds).map(([matchId, v]) => ({ matchId, home: v.home, away: v.away }))}
          results={results}
          detail={detail}
        />
      )}

      <div style={styles.saveBar}>
        {locked ? (
          <div style={styles.lockedBanner}>
            🔒 Pronostics {isLocked ? "verrouillés définitivement" : "verrouillés par l'admin"} — consultation uniquement
          </div>
        ) : confirmLock ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ ...styles.hint, textAlign: "center", color: "#f59e0b" }}>
              ⚠️ Une fois verrouillé définitivement, aucune modification ne sera possible.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.btnPrimary, background: "#22c55e" }} onClick={saveFinal}>✅ Oui, verrouiller</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setConfirmLock(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={saveDraft}>
              {saved === "draft" ? "✅ Brouillon sauvé !" : "💾 Sauvegarder brouillon"}
            </button>
            <button style={{ ...styles.btnPrimary, flex: 1, background: "#22c55e" }} onClick={saveFinal}>
              {saved === "final" ? "🔒 Verrouillé !" : "🔒 Valider définitivement"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MY GROUP PREDICTIONS TAB ─────────────────────────────────────────────────
// Calcule le classement pronostiqué automatiquement depuis les scores saisis

function calcPlayerPredictedStandings(group, playerPredictions) {
  // On construit un faux "groupResults" depuis les prédictions du joueur
  const fakePredResults = {};
  playerPredictions.forEach(pred => {
    if (pred.home !== "" && pred.away !== "" && !isNaN(parseInt(pred.home)) && !isNaN(parseInt(pred.away))) {
      fakePredResults[pred.matchId] = { homeScore: pred.home, awayScore: pred.away };
    }
  });
  return calcGroupStandings(group, fakePredResults);
}

function MyGroupPredictionsTab({ playerPredictions, results, detail }) {
  const [viewGroup, setViewGroup] = useState(Object.keys(GROUPS)[0]);

  const predStandings = calcPlayerPredictedStandings(viewGroup, playerPredictions);
  const realStandings = calcGroupStandings(viewGroup, results.groupResults);
  const predHasData = predStandings.some(s => s.played > 0);
  const realHasData = realStandings.some(s => s.played > 0);

  // Points gagnés sur ce groupe (classement)
  const groupPts = [0,1,2,3].reduce((acc, i) => acc + (detail[`rank_${viewGroup}_${i}`] || 0), 0);

  return (
    <div>
      <p style={styles.hint}>
        Ton classement pronostiqué est <strong>calculé automatiquement</strong> depuis tes scores saisis. <strong style={{ color: C.accent }}>+2 pts</strong> par équipe bien placée.
      </p>

      <div style={styles.groupSelector}>
        {Object.keys(GROUPS).map(g => {
          const pts = [0,1,2,3].reduce((acc, i) => acc + (detail[`rank_${g}_${i}`] || 0), 0);
          const ps = calcPlayerPredictedStandings(g, playerPredictions);
          const hasPred = ps.some(s => s.played > 0);
          return (
            <button key={g}
              style={{ ...styles.groupBtn, ...(viewGroup === g ? styles.groupBtnActive : {}), opacity: hasPred ? 1 : 0.5 }}
              onClick={() => setViewGroup(g)}>
              {g}
              {pts > 0 && <span style={{ fontSize: 9, marginLeft: 3, color: viewGroup === g ? "#fff" : C.accent }}>+{pts}</span>}
            </button>
          );
        })}
      </div>

      <div style={styles.groupSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ ...styles.groupTitle, margin: 0 }}>Groupe {viewGroup}</h3>
          {groupPts > 0 && <span style={{ ...styles.ptsBadge, background: "#22c55e" }}>+{groupPts} pts gagnés</span>}
        </div>

        {!predHasData ? (
          <p style={styles.hint}>⚠️ Saisis tes scores dans l'onglet "🎯 Pronostics" pour voir ton classement calculé automatiquement ici.</p>
        ) : (
          <>
            {/* Tableau pronostiqué du joueur */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Ton classement pronostiqué
              </div>
              <div style={styles.standingsHeader}>
                <span style={{ flex: 1 }} />
                <span style={styles.standingsCol}>J</span>
                <span style={styles.standingsCol}>DB</span>
                <span style={styles.standingsCol}>Buts</span>
                <span style={styles.standingsCol}>Pts</span>
              </div>
              {predStandings.map((s, i) => {
                // Est-ce que ce rang coïncide avec le classement réel ?
                const realRank = realHasData ? realStandings.findIndex(r => r.team === s.team) : -1;
                const correct = realHasData && realRank === i;
                const isQ = i < 2;
                return (
                  <div key={s.team} style={{
                    ...styles.standingsRow,
                    background: correct ? "#0d2015" : isQ ? "#0a1a0f" : "transparent",
                    borderLeft: correct ? "3px solid #22c55e" : isQ ? "3px solid #22c55e44" : "3px solid transparent",
                  }}>
                    <span style={{ ...styles.rankPos, minWidth: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{flag(s.team)} {s.team}</span>
                    <span style={styles.standingsCol}>{s.played}</span>
                    <span style={styles.standingsCol}>{s.gd >= 0 ? "+" : ""}{s.gd}</span>
                    <span style={styles.standingsCol}>{s.gf}</span>
                    <span style={{ ...styles.standingsCol, fontWeight: 800, color: C.accent }}>{s.pts}</span>
                    {correct && <span style={{ ...styles.ptsBadge, background: "#22c55e", marginLeft: 4 }}>+2</span>}
                    {realHasData && !correct && realRank >= 0 && (
                      <span style={{ fontSize: 10, color: C.red, marginLeft: 4 }}>→ réel {realRank + 1}e</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Classement réel en comparaison */}
            {realHasData && (
              <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Classement réel actuel
                </div>
                {realStandings.map((s, i) => (
                  <div key={s.team} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                    <span style={{ ...styles.rankPos, minWidth: 18, color: i < 2 ? "#22c55e" : i === 2 ? "#f59e0b" : C.textMuted }}>{i + 1}</span>
                    <span style={{ flex: 1 }}>{flag(s.team)} {s.team}</span>
                    <span style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>{s.pts} pts</span>
                    <span style={{ color: C.textMuted, fontSize: 11 }}>{s.gd >= 0 ? "+" : ""}{s.gd} DB · {s.gf} buts</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── GROUP MATCHES TAB ────────────────────────────────────────────────────────

function GroupMatchesTab({ preds, setPreds, results, detail, locked }) {
  return (
    <div>
      {Object.entries(GROUPS).map(([group, teams]) => {
        const groupMatches = GROUP_MATCHES.filter(m => m.group === group);
        return (
          <div key={group} style={styles.groupSection}>
            <h3 style={styles.groupTitle}>Groupe {group}</h3>
            {groupMatches.map(m => {
              const res = results.groupResults?.[m.id];
              const hasResult = res && res.homeScore !== "" && res.awayScore !== "";
              const pts = detail[m.id];
              return (
                <div key={m.id} style={styles.matchRow}>
                  <div style={styles.matchTeams}>
                    <span style={styles.teamName}>{flag(m.home)} {m.home}</span>
                    <div style={styles.scoreInputs}>
                      <input
                        style={{ ...styles.scoreInput, ...(hasResult ? styles.scoreInputDone : {}) }}
                        type="number" inputMode="numeric" min="0" max="99"
                        value={preds[m.id]?.home ?? ""}
                        onChange={e => setPreds(p => ({ ...p, [m.id]: { ...p[m.id], home: e.target.value } }))}
                        disabled={hasResult || locked}
                        placeholder="-"
                      />
                      <span style={styles.vs}>–</span>
                      <input
                        style={{ ...styles.scoreInput, ...(hasResult || locked ? styles.scoreInputDone : {}) }}
                        type="number" inputMode="numeric" min="0" max="99"
                        value={preds[m.id]?.away ?? ""}
                        onChange={e => setPreds(p => ({ ...p, [m.id]: { ...p[m.id], away: e.target.value } }))}
                        disabled={hasResult || locked}
                        placeholder="-"
                      />
                    </div>
                    <span style={styles.teamName}>{flag(m.away)} {m.away}</span>
                  </div>
                  <div style={styles.matchMeta}>
                    {hasResult && <span style={styles.realScore}>Résultat : {res.homeScore} – {res.awayScore}</span>}
                    {pts !== undefined && <span style={{ ...styles.ptsBadge, background: pts === 3 ? "#22c55e" : pts === 1 ? "#f59e0b" : "#ef4444" }}>{pts === 3 ? "🎯 +3" : pts === 1 ? "✅ +1" : "❌ 0"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── STANDINGS CALCULATOR ────────────────────────────────────────────────────

function calcGroupStandings(group, groupResults) {
  return calcGroupStandingsRaw(group, groupResults);
}

// Calcule les 8 meilleurs troisièmes parmi les 12 groupes
function calcBest3rds(groupResults) {
  const thirds = Object.keys(GROUPS).map(group => {
    const standings = calcGroupStandings(group, groupResults);
    if (standings.length < 3 || standings[2].played === 0) return null;
    return { group, ...standings[2] };
  }).filter(Boolean);

  const groupOrder = Object.keys(GROUPS);
  return thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
  }).slice(0, 8);
}

// ─── GROUP RANKINGS TAB ──────────────────────────────────────────────────────

function GroupRankingsTab({ results, detail }) {
  const [viewGroup, setViewGroup] = useState(Object.keys(GROUPS)[0]);
  const [showBest3, setShowBest3] = useState(false);

  const best3rds = calcBest3rds(results.groupResults);
  const qualified8 = best3rds.map(t => t.team);

  return (
    <div>
      {/* Sélecteur de groupe */}
      <div style={styles.groupSelector}>
        {Object.keys(GROUPS).map(g => (
          <button key={g} style={{ ...styles.groupBtn, ...(viewGroup === g ? styles.groupBtnActive : {}) }}
            onClick={() => setViewGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      {/* Tableau de classement du groupe sélectionné */}
      <GroupStandingsCard
        group={viewGroup}
        groupResults={results.groupResults}
        detail={detail}
        qualified8={qualified8}
      />

      {/* Meilleurs 3es */}
      <div style={styles.groupSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setShowBest3(v => !v)}>
          <h3 style={{ ...styles.groupTitle, margin: 0 }}>🏅 Meilleurs 3es qualifiés ({qualified8.length}/8)</h3>
          <span style={{ color: C.textMuted }}>{showBest3 ? "▲" : "▼"}</span>
        </div>
        {showBest3 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ ...styles.hint, marginBottom: 8 }}>Les 8 meilleurs 3es (sur 12) se qualifient pour les 1/8. Critères : points → différence de buts → buts marqués.</p>
            {best3rds.length === 0
              ? <p style={styles.hint}>Aucun résultat de poule saisi.</p>
              : best3rds.map((t, i) => (
                <div key={t.team} style={styles.rankRow}>
                  <span style={styles.rankPos}>{i + 1}</span>
                  <span style={{ ...styles.rankTeam, flex: 1 }}>{flag(t.team)} {t.team} <span style={styles.rankReal}>(Gr. {t.group})</span></span>
                  <span style={styles.standingStat}>{t.pts} pts</span>
                  <span style={styles.standingStat}>{t.gd > 0 ? "+" : ""}{t.gd} DB</span>
                  <span style={styles.standingStat}>{t.gf} buts</span>
                  {i < 8 && <span style={{ ...styles.ptsBadge, background: "#22c55e", marginLeft: 4 }}>✅ Qualifié</span>}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

function GroupStandingsCard({ group, groupResults, detail, qualified8 }) {
  const standings = calcGroupStandings(group, groupResults);
  const hasRealData = standings.some(s => s.played > 0);

  return (
    <div style={styles.groupSection}>
      <h3 style={styles.groupTitle}>Groupe {group}</h3>

      {!hasRealData && <p style={styles.hint}>En attente des premiers résultats…</p>}

      {/* Classement réel calculé automatiquement */}
      {hasRealData && (
        <div>
          <div style={styles.standingsHeader}>
            <span style={{ flex: 1, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Classement réel</span>
            <span style={styles.standingsCol}>J</span>
            <span style={styles.standingsCol}>G</span>
            <span style={styles.standingsCol}>N</span>
            <span style={styles.standingsCol}>P</span>
            <span style={styles.standingsCol}>DB</span>
            <span style={styles.standingsCol}>Pts</span>
          </div>
          {standings.map((s, i) => {
            const isQ = i < 2;
            const is3rd = i === 2 && qualified8.includes(s.team);
            let wins = 0, draws = 0, losses = 0;
            GROUP_MATCHES.filter(m => m.group === group && (m.home === s.team || m.away === s.team)).forEach(m => {
              const r = groupResults?.[m.id];
              if (!r || r.homeScore === "" || r.awayScore === "") return;
              const h = parseInt(r.homeScore), a = parseInt(r.awayScore);
              if (isNaN(h) || isNaN(a)) return;
              const isHome = m.home === s.team;
              const myGoals = isHome ? h : a, oppGoals = isHome ? a : h;
              if (myGoals > oppGoals) wins++;
              else if (myGoals === oppGoals) draws++;
              else losses++;
            });
            return (
              <div key={s.team} style={{
                ...styles.standingsRow,
                background: isQ ? "#0d2015" : is3rd ? "#151a0a" : "transparent",
                borderLeft: isQ ? "3px solid #22c55e" : is3rd ? "3px solid #f59e0b" : "3px solid transparent"
              }}>
                <span style={{ ...styles.rankPos, minWidth: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{flag(s.team)} {s.team}</span>
                <span style={styles.standingsCol}>{s.played}</span>
                <span style={styles.standingsCol}>{wins}</span>
                <span style={styles.standingsCol}>{draws}</span>
                <span style={styles.standingsCol}>{losses}</span>
                <span style={styles.standingsCol}>{s.gd > 0 ? "+" : ""}{s.gd}</span>
                <span style={{ ...styles.standingsCol, fontWeight: 800, color: C.accent }}>{s.pts}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#22c55e" }}>█ Qualifié direct</span>
            <span style={{ fontSize: 11, color: "#f59e0b" }}>█ Meilleur 3e potentiel</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TABLEAU FIFA OFFICIEL ────────────────────────────────────────────────────

const R16_BRACKET = [
  { id: "R16_1",  home: { type: "2e",  group: "A" }, away: { type: "2e",  group: "B" } },
  { id: "R16_2",  home: { type: "1er", group: "C" }, away: { type: "2e",  group: "F" } },
  { id: "R16_3",  home: { type: "1er", group: "E" }, away: { type: "3e",  slots: ["A","B","C","D","F"] } },
  { id: "R16_4",  home: { type: "1er", group: "I" }, away: { type: "3e",  slots: ["C","D","F","G","H"] } },
  { id: "R16_5",  home: { type: "1er", group: "F" }, away: { type: "2e",  group: "C" } },
  { id: "R16_6",  home: { type: "2e",  group: "E" }, away: { type: "2e",  group: "I" } },
  { id: "R16_7",  home: { type: "1er", group: "A" }, away: { type: "3e",  slots: ["C","E","F","H","I"] } },
  { id: "R16_8",  home: { type: "1er", group: "L" }, away: { type: "3e",  slots: ["E","H","I","J","K"] } },
  { id: "R16_9",  home: { type: "1er", group: "G" }, away: { type: "3e",  slots: ["A","E","H","I","J"] } },
  { id: "R16_10", home: { type: "1er", group: "D" }, away: { type: "3e",  slots: ["B","E","F","I","J"] } },
  { id: "R16_11", home: { type: "1er", group: "H" }, away: { type: "2e",  group: "J" } },
  { id: "R16_12", home: { type: "2e",  group: "K" }, away: { type: "2e",  group: "L" } },
  { id: "R16_13", home: { type: "1er", group: "B" }, away: { type: "3e",  slots: ["E","F","G","I","J"] } },
  { id: "R16_14", home: { type: "2e",  group: "D" }, away: { type: "2e",  group: "G" } },
  { id: "R16_15", home: { type: "1er", group: "J" }, away: { type: "2e",  group: "H" } },
  { id: "R16_16", home: { type: "1er", group: "K" }, away: { type: "3e",  slots: ["D","E","I","J","L"] } },
];

const QF_BRACKET = [
  { id: "QF_1", home: { winner: "R16_1"  }, away: { winner: "R16_2"  } },
  { id: "QF_2", home: { winner: "R16_3"  }, away: { winner: "R16_4"  } },
  { id: "QF_3", home: { winner: "R16_5"  }, away: { winner: "R16_6"  } },
  { id: "QF_4", home: { winner: "R16_7"  }, away: { winner: "R16_8"  } },
  { id: "QF_5", home: { winner: "R16_9"  }, away: { winner: "R16_10" } },
  { id: "QF_6", home: { winner: "R16_11" }, away: { winner: "R16_12" } },
  { id: "QF_7", home: { winner: "R16_13" }, away: { winner: "R16_14" } },
  { id: "QF_8", home: { winner: "R16_15" }, away: { winner: "R16_16" } },
];

const SF_BRACKET = [
  { id: "SF_1", home: { winner: "QF_1" }, away: { winner: "QF_2" } },
  { id: "SF_2", home: { winner: "QF_3" }, away: { winner: "QF_4" } },
  { id: "SF_3", home: { winner: "QF_5" }, away: { winner: "QF_6" } },
  { id: "SF_4", home: { winner: "QF_7" }, away: { winner: "QF_8" } },
];

const F_BRACKET = [
  { id: "F_1", home: { winner: "SF_1" }, away: { winner: "SF_2" } },
  { id: "F_2", home: { winner: "SF_3" }, away: { winner: "SF_4" } },
];

// Retourne les équipes mathématiquement certaines même si le groupe n'est pas terminé
function calcCertainQualified(groupResults) {
  const certain = [];
  Object.keys(GROUPS).forEach(group => {
    const standings = calcGroupStandings(group, groupResults);
    const teams = GROUPS[group];
    const matchesPlayed = GROUP_MATCHES.filter(m => {
      const r = groupResults?.[m.id];
      return m.group === group && r && r.homeScore !== "" && r.awayScore !== "" && !isNaN(parseInt(r.homeScore));
    }).length;

    if (matchesPlayed === 0) return;

    // Calcule les points max que chaque équipe peut encore atteindre
    // (matchs restants × 3 + points actuels)
    const teamsData = standings.map(s => {
      const matchesLeft = 3 - s.played;
      return { ...s, maxPts: s.pts + matchesLeft * 3 };
    });

    // 1er certain : si l'équipe en tête a plus de points que le max possible du 2e
    if (teamsData[0].pts > teamsData[1].maxPts) {
      certain.push({ team: teamsData[0].team, rank: "1er", group });
    }
    // 2e certain : si les 2 premières ont plus de points que le max possible du 3e
    if (teamsData[1].pts > teamsData[2].maxPts && teamsData[0].pts > teamsData[2].maxPts) {
      if (!certain.find(c => c.group === group && c.rank === "1er")) {
        certain.push({ team: teamsData[0].team, rank: "1er", group });
      }
      certain.push({ team: teamsData[1].team, rank: "2e", group });
    }
    // Si groupe terminé : ajouter tous les qualifiés directs
    if (matchesPlayed === 6) {
      if (!certain.find(c => c.group === group && c.rank === "1er"))
        certain.push({ team: standings[0].team, rank: "1er", group });
      if (!certain.find(c => c.group === group && c.rank === "2e"))
        certain.push({ team: standings[1].team, rank: "2e", group });
    }
  });
  // Ajouter les meilleurs 3es seulement si tous les groupes sont terminés
  const allDone = Object.keys(GROUPS).every(g =>
    GROUP_MATCHES.filter(m => m.group === g).every(m => {
      const r = groupResults?.[m.id];
      return r && r.homeScore !== "" && !isNaN(parseInt(r.homeScore));
    })
  );
  if (allDone) {
    const best3rds = calcBest3rds(groupResults);
    best3rds.forEach(t => certain.push({ team: t.team, rank: "3e", group: t.group }));
  }
  return certain;
}

function resolveSlot(slot, qualified, koWinners) {
  if (slot.winner) return koWinners[slot.winner] || null;
  if (slot.type === "1er") {
    const q = qualified.find(q => q.rank === "1er" && q.group === slot.group);
    return q ? q.team : null;
  }
  if (slot.type === "2e") {
    const q = qualified.find(q => q.rank === "2e" && q.group === slot.group);
    return q ? q.team : null;
  }
  if (slot.type === "3e") {
    const thirds = qualified.filter(q => q.rank === "3e" && slot.slots.includes(q.group));
    return thirds.length > 0 ? thirds[0].team : null;
  }
  return null;
}

function slotLabel(slot) {
  if (slot.winner) return `V. ${slot.winner}`;
  if (slot.type === "3e") return `3e (${slot.slots.join(",")})`;
  return `${slot.type} Gr.${slot.group}`;
}

function calcQualified(groupResults) {
  const q = [];
  Object.keys(GROUPS).forEach(group => {
    const standings = calcGroupStandings(group, groupResults);
    const allPlayed = standings.every(s => s.played === 3);
    if (!allPlayed) return;
    q.push({ team: standings[0].team, rank: "1er", group });
    q.push({ team: standings[1].team, rank: "2e", group });
  });
  const best3rds = calcBest3rds(groupResults);
  best3rds.forEach(t => q.push({ team: t.team, rank: "3e", group: t.group }));
  return q;
}

function KOTab({ koPreds, setKoPreds, results, detail, locked, lockedKoPhases = [] }) {
  const qualified = calcQualified(results.groupResults); // pour scoring
  const certainQualified = calcCertainQualified(results.groupResults); // pour affichage anticipé
  const groupsComplete = Object.keys(GROUPS).filter(g =>
    calcGroupStandings(g, results.groupResults).every(t => t.played === 3)
  ).length;

  // Dictionnaires vainqueurs réels et pronostiqués pour propagation
  const realWinners = {};
  const predWinners = {};
  ["R16","QF","SF","F"].forEach(phase => {
    Object.entries(results.koResults?.[phase] || {}).forEach(([mid, v]) => {
      if (v?.winner) realWinners[mid] = v.winner;
    });
    (koPreds[phase] || []).forEach(p => {
      if (p?.winner) predWinners[p.matchId] = p.winner;
    });
  });

  const openPhase = results.openKoPhase || "none"; // phase ouverte par l'admin

  const allPhases = [
    { key: "R16", label: "Seizièmes de finale", bracket: R16_BRACKET },
    { key: "QF",  label: "Huitièmes de finale", bracket: QF_BRACKET },
    { key: "SF",  label: "Demi-finales",         bracket: SF_BRACKET },
    { key: "F",   label: "Finale",               bracket: F_BRACKET },
  ];

  // Ordre des phases pour savoir lesquelles sont "passées"
  const phaseOrder = ["R16", "QF", "SF", "F"];
  const openIdx = phaseOrder.indexOf(openPhase);

  return (
    <div>
      <div style={styles.koRuleBox}>
        <strong>📋 Règle phase finale</strong>
        <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          • Score exact <em>(après prolongations)</em> + bon vainqueur = <strong style={{ color: "#22c55e" }}>3 pts</strong><br/>
          • Bon vainqueur seulement <em>(TAB pris en compte)</em> = <strong style={{ color: "#f59e0b" }}>2 pts</strong>
        </div>
      </div>

      {groupsComplete < 12 && (
        <p style={{ ...styles.hint, marginBottom: 12 }}>
          ⏳ {12 - groupsComplete} groupe(s) pas encore terminé(s). Les adversaires des seizièmes s'afficheront automatiquement.
        </p>
      )}

      {allPhases.map(({ key, label, bracket }, phaseIdx) => {
        const phaseResults = results.koResults?.[key] || {};
        const phasePreds = koPreds[key] || [];
        const isOpen = key === openPhase;
        const isPast = openIdx > phaseOrder.indexOf(key);
        const isFuture = openIdx < phaseOrder.indexOf(key) && openPhase !== "none";
        const isNoneOpen = openPhase === "none";
        const phaseAdminLocked = lockedKoPhases.includes(key);
        const phaseLockedForInput = locked || phaseAdminLocked || (!isOpen);

        return (
          <div key={key} style={{ ...styles.groupSection, opacity: isFuture ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ ...styles.groupTitle, margin: 0 }}>{label}</h3>
              {isOpen && <span style={{ ...styles.ptsBadge, background: "#22c55e", fontSize: 12 }}>🟢 Ouverte</span>}
              {isPast && <span style={{ ...styles.ptsBadge, background: C.surface2, fontSize: 12 }}>✅ Terminée</span>}
              {isFuture && <span style={{ ...styles.ptsBadge, background: C.border, fontSize: 12 }}>🔒 Non encore ouverte</span>}
              {isNoneOpen && <span style={{ ...styles.ptsBadge, background: "#f59e0b", fontSize: 12 }}>⏳ Phase de poules en cours</span>}
            </div>
            {bracket.map(match => {
              const real = phaseResults[match.id];
              const pred = phasePreds.find(p => p.matchId === match.id);
              const hasResult = !!real?.winner;
              const pts = detail?.[`ko_${key}_${match.id}`];

              // Équipes réelles (résultats admin) et pronostiquées (choix joueur)
              const homeReal = resolveSlot(match.home, certainQualified, realWinners);
              const awayReal = resolveSlot(match.away, certainQualified, realWinners);
              const homePred = resolveSlot(match.home, certainQualified, predWinners);
              const awayPred = resolveSlot(match.away, certainQualified, predWinners);

              // Pour l'affichage : priorité au réel, sinon pronostiqué
              const homeDisplay = homeReal || homePred;
              const awayDisplay = awayReal || awayPred;
              const teamsForSelect = [homeDisplay, awayDisplay].filter(Boolean);

              const updatePred = (field, value) => {
                const base = pred || { matchId: match.id };
                const updated = [...phasePreds.filter(p => p.matchId !== match.id), { ...base, [field]: value }];
                setKoPreds(k => ({ ...k, [key]: updated }));
              };

              return (
                <div key={match.id} style={styles.koMatchRow}>
                  {/* Équipes */}
                  <div style={styles.koTeamsRow}>
                    <span style={styles.koTeam}>
                      {homeDisplay
                        ? <>{flag(homeDisplay)} {homeDisplay}</>
                        : <span style={{ color: C.textMuted, fontSize: 11 }}>{slotLabel(match.home)}</span>}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 11 }}>vs</span>
                    <span style={styles.koTeam}>
                      {awayDisplay
                        ? <>{flag(awayDisplay)} {awayDisplay}</>
                        : <span style={{ color: C.textMuted, fontSize: 11 }}>{slotLabel(match.away)}</span>}
                    </span>
                  </div>

                  {/* Résultat réel */}
                  {hasResult && (
                    <div style={{ fontSize: 12, color: "#22c55e", margin: "4px 0" }}>
                      ✅ {real.winner}{real.homeScore !== undefined ? ` (${real.homeScore}–${real.awayScore}${real.penalties ? ", TAB" : ""})` : ""}
                      {pts !== undefined && <span style={{ ...styles.ptsBadge, background: pts >= 3 ? "#22c55e" : pts === 2 ? "#f59e0b" : "#ef4444", marginLeft: 6 }}>{pts >= 3 ? "🎯 +3" : pts === 2 ? "✅ +2" : "❌ 0"}</span>}
                    </div>
                  )}

                  {/* Saisie pronostic */}
                  {!hasResult && (
                    <div style={styles.koMatchInputs}>
                      <input style={{ ...styles.scoreInput, width: 44, ...(phaseLockedForInput ? styles.scoreInputDone : {}) }}
                        type="number" min="0" max="20" placeholder="–"
                        value={pred?.homeScore ?? ""}
                        disabled={phaseLockedForInput}
                        onChange={e => updatePred("homeScore", e.target.value)} />
                      <span style={styles.vs}>–</span>
                      <input style={{ ...styles.scoreInput, width: 44, ...(phaseLockedForInput ? styles.scoreInputDone : {}) }}
                        type="number" min="0" max="20" placeholder="–"
                        value={pred?.awayScore ?? ""}
                        disabled={phaseLockedForInput}
                        onChange={e => updatePred("awayScore", e.target.value)} />
                      <span style={styles.koSep}>Vainqueur :</span>
                      {teamsForSelect.length === 2 && !phaseLockedForInput
                        ? <select style={{ ...styles.select, flex: 1 }}
                            value={pred?.winner || ""}
                            onChange={e => updatePred("winner", e.target.value)}>
                            <option value="">-- Choisir --</option>
                            {teamsForSelect.map(t => <option key={t} value={t}>{flag(t)} {t}</option>)}
                          </select>
                        : <div style={{ ...styles.koInput, flex: 1, background: C.surface2, opacity: 0.7, padding: "8px 10px", borderRadius: 8, fontSize: 13, color: pred?.winner ? C.text : C.textMuted }}>
                            {pred?.winner ? <>{flag(pred.winner)} {pred.winner}</> : teamsForSelect.length ? `${flag(teamsForSelect[0]||"")} ${teamsForSelect[0]||""}` : "En attente…"}
                          </div>
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
// ─── BONUS TAB ───────────────────────────────────────────────────────────────

function BonusTab({ player, results, detail }) {
  const bp = player.bonusPredictions || {};
  const br = results.bonusResults || {};
  const winnerCorrect = br.winner && bp.winner && bp.winner.toLowerCase().trim() === br.winner.toLowerCase().trim();
  const normScorer = s => s.toLowerCase().trim().replace(/\s*\(.*\)/, "").trim();
  const scorerCorrect = br.topScorer && bp.topScorer && normScorer(bp.topScorer) === normScorer(br.topScorer);

  return (
    <div style={styles.groupSection}>
      <h3 style={styles.groupTitle}>🌟 Pronostics bonus</h3>
      <p style={{ ...styles.hint, marginBottom: 12 }}>Ces pronostics ont été saisis à l'inscription et ne peuvent plus être modifiés.</p>

      <div style={styles.bonusRow}>
        <div style={styles.bonusRowLabel}>🏆 Vainqueur CDM</div>
        <div style={styles.bonusRowValue}>
          {bp.winner ? <><span style={styles.bonusTeam}>{flag(bp.winner)} {bp.winner}</span></> : <span style={styles.textMuted}>Non renseigné</span>}
        </div>
        <div>
          {br.winner
            ? winnerCorrect
              ? <span style={{ ...styles.ptsBadge, background: "#22c55e" }}>🎯 +5 pts</span>
              : <span style={{ ...styles.ptsBadge, background: "#ef4444" }}>❌ 0 pt — {flag(br.winner)} {br.winner}</span>
            : <span style={styles.hint}>En attente…</span>}
        </div>
      </div>

      <div style={{ ...styles.bonusRow, marginTop: 12 }}>
        <div style={styles.bonusRowLabel}>⚽ Meilleur buteur</div>
        <div style={styles.bonusRowValue}>
          {bp.topScorer ? <span style={styles.bonusTeam}>{bp.topScorer}</span> : <span style={styles.hint}>Non renseigné</span>}
        </div>
        <div>
          {br.topScorer
            ? scorerCorrect
              ? <span style={{ ...styles.ptsBadge, background: "#22c55e" }}>🎯 +5 pts</span>
              : <span style={{ ...styles.ptsBadge, background: "#ef4444" }}>❌ 0 pt — {br.topScorer}</span>
            : <span style={styles.hint}>En attente…</span>}
        </div>
      </div>
    </div>
  );
}




function LeaderboardScreen({ players, results, compact = false }) {
  const ranked = [...players]
    .map(p => ({ ...p, score: calcScore(p, results).total }))
    .sort((a, b) => b.score - a.score);

  const pot = players.length * 2;
  const prizes = [Math.round(pot * 0.6), Math.round(pot * 0.25), Math.round(pot * 0.15)];
  const br = results.bonusResults || {};

  return (
    <div style={styles.lbWrap}>
      <h2 style={styles.formTitle}>🏆 Classement général</h2>
      <div style={styles.potLine}>Cagnotte totale : <strong>{pot}€</strong> · 🥇{prizes[0]}€ 🥈{prizes[1]}€ 🥉{prizes[2]}€</div>
      {(br.winner || br.topScorer) && (
        <div style={styles.bonusResultsBox}>
          {br.winner && <span>🏆 Vainqueur : <strong>{flag(br.winner)} {br.winner}</strong></span>}
          {br.topScorer && <span>⚽ Meilleur buteur : <strong>{br.topScorer}</strong></span>}
        </div>
      )}
      {ranked.length === 0 && <p style={styles.empty}>Aucun joueur inscrit pour le moment.</p>}
      {ranked.map((p, i) => {
        const bp = p.bonusPredictions || {};
        const winnerOk = br.winner && bp.winner && bp.winner.toLowerCase().trim() === br.winner.toLowerCase().trim();
        const normSc = s => s.toLowerCase().trim().replace(/\s*\(.*\)/, '').trim(); const scorerOk = br.topScorer && bp.topScorer && normSc(bp.topScorer) === normSc(br.topScorer);
        return (
          <div key={p.id} style={{ ...styles.lbRow, ...(i === 0 ? styles.lbFirst : i === 1 ? styles.lbSecond : i === 2 ? styles.lbThird : {}) }}>
            <span style={styles.lbRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
            <div style={styles.avatarSm}>{getInitials(p.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.lbName}>{p.name} {p.locked ? <span style={{ fontSize: 10, color: '#22c55e' }}>🔒</span> : <span style={{ fontSize: 10, color: '#f59e0b' }}>✏️</span>}</div>
              <div style={styles.lbBonusLine}>
                {bp.winner && <span style={{ ...styles.lbBonusBadge, border: `1px solid ${winnerOk ? "#22c55e" : C.border}`, background: winnerOk ? "#16321a" : C.surface2 }}>🏆 {bp.winner}{winnerOk ? " ✅" : ""}</span>}
                {bp.topScorer && <span style={{ ...styles.lbBonusBadge, border: `1px solid ${scorerOk ? "#22c55e" : C.border}`, background: scorerOk ? "#16321a" : C.surface2 }}>⚽ {bp.topScorer}{scorerOk ? " ✅" : ""}</span>}
              </div>
            </div>
            <span style={styles.lbScore}>{p.score} pts</span>
            {i < 3 && <span style={styles.lbPrize}>{prizes[i]}€</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

function AdminScreen({ adminAuth, setAdminAuth, results, updateResults, players, updatePlayers }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("scores");

  if (!adminAuth) return (
    <div style={styles.formWrap}>
      <h2 style={styles.formTitle}>⚙️ Administration</h2>
      <p style={styles.hint}>Accès réservé à l'organisateur.</p>
      <input style={styles.input} type="password" placeholder="Mot de passe admin" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && (pwd === ADMIN_PASSWORD ? setAdminAuth(true) : setErr("Mot de passe incorrect."))} />
      {err && <p style={styles.error}>{err}</p>}
      <button style={styles.btnPrimary} onClick={() => pwd === ADMIN_PASSWORD ? setAdminAuth(true) : setErr("Mot de passe incorrect.")}>Connexion</button>
    </div>
  );

  return (
    <div style={styles.adminWrap}>
      <div style={styles.adminHeader}>
        <h2 style={styles.formTitle}>⚙️ Administration</h2>
        <button style={styles.btnDanger} onClick={() => setAdminAuth(false)}>Déconnexion</button>
      </div>
      {/* Verrou global */}
      <div style={{ background: results.locked ? "#0d2015" : "#1a1208", border: `1px solid ${results.locked ? "#22c55e" : "#f59e0b"}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 13, color: results.locked ? "#22c55e" : "#f59e0b" }}>
          {results.locked ? "🔒 Pronostics verrouillés — aucune modification possible pour les joueurs" : "🔓 Pronostics ouverts — les joueurs peuvent encore modifier"}
        </span>
        <button style={{ ...styles.btnPrimary, width: "auto", background: results.locked ? "#ef4444" : "#22c55e", fontSize: 13, padding: "8px 14px" }}
          onClick={() => updateResults({ ...results, locked: !results.locked })}>
          {results.locked ? "🔓 Déverrouiller" : "🔒 Verrouiller tous les pronostics"}
        </button>
      </div>
      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(tab === "scores" ? styles.tabActive : {}) }} onClick={() => setTab("scores")}>⚽ Scores poules</button>
        <button style={{ ...styles.tab, ...(tab === "rankings" ? styles.tabActive : {}) }} onClick={() => setTab("rankings")}>📊 Classements groupes</button>
        <button style={{ ...styles.tab, ...(tab === "ko" ? styles.tabActive : {}) }} onClick={() => setTab("ko")}>🏆 Phase finale</button>
        <button style={{ ...styles.tab, ...(tab === "phases" ? styles.tabActive : {}) }} onClick={() => setTab("phases")}>📅 Phases ouvertes</button>
        <button style={{ ...styles.tab, ...(tab === "bonus" ? styles.tabActive : {}) }} onClick={() => setTab("bonus")}>🌟 Bonus</button>
        <button style={{ ...styles.tab, ...(tab === "players" ? styles.tabActive : {}) }} onClick={() => setTab("players")}>👥 Joueurs</button>
        <button style={{ ...styles.tab, ...(tab === "detail" ? styles.tabActive : {}) }} onClick={() => setTab("detail")}>🔍 Détail points</button>
        <button style={{ ...styles.tab, ...(tab === "bracket" ? styles.tabActive : {}) }} onClick={() => setTab("bracket")}>🏆 Tableau KO</button>
        <button style={{ ...styles.tab, ...(tab === "test" ? styles.tabActive : {}), borderColor: "#7c3aed" }} onClick={() => setTab("test")}>🧪 Test</button>
      </div>
      {tab === "scores" && <AdminScores results={results} updateResults={updateResults} />}
      {tab === "rankings" && <AdminRankings results={results} updateResults={updateResults} />}
      {tab === "ko" && <AdminKO results={results} updateResults={updateResults} />}
      {tab === "phases" && <AdminPhases results={results} updateResults={updateResults} players={players} updatePlayers={updatePlayers} />}
      {tab === "bonus" && <AdminBonus results={results} updateResults={updateResults} />}
      {tab === "players" && <AdminPlayers players={players} updatePlayers={updatePlayers} />}
      {tab === "detail" && <AdminDetail players={players} results={results} />}
      {tab === "bracket" && <AdminBracket results={results} updateResults={updateResults} />}
      {tab === "test" && <AdminTest results={results} updateResults={updateResults} players={players} updatePlayers={updatePlayers} />}
    </div>
  );
}

function AdminScores({ results, updateResults }) {
  const [local, setLocal] = useState(results.groupResults || {});
  const [saved, setSaved] = useState(false);

  function save() {
    updateResults({ ...results, groupResults: local });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p style={styles.hint}>Saisissez les scores réels des matchs de poules.</p>
      {Object.entries(GROUPS).map(([group]) => {
        const gm = GROUP_MATCHES.filter(m => m.group === group);
        return (
          <div key={group} style={styles.groupSection}>
            <h3 style={styles.groupTitle}>Groupe {group}</h3>
            {gm.map(m => (
              <div key={m.id} style={styles.matchRow}>
                <span style={styles.teamName}>{flag(m.home)} {m.home}</span>
                <input style={{ ...styles.scoreInput, width: 48 }} type="number" min="0" max="99"
                  value={local[m.id]?.homeScore ?? ""}
                  onChange={e => setLocal(l => ({ ...l, [m.id]: { ...l[m.id], homeScore: e.target.value } }))}
                  placeholder="-" />
                <span style={styles.vs}>–</span>
                <input style={{ ...styles.scoreInput, width: 52 }} type="number" inputMode="numeric" min="0" max="99"
                  value={local[m.id]?.awayScore ?? ""}
                  onChange={e => setLocal(l => ({ ...l, [m.id]: { ...l[m.id], awayScore: e.target.value } }))}
                  placeholder="-" />
                <span style={styles.teamName}>{flag(m.away)} {m.away}</span>
              </div>
            ))}
          </div>
        );
      })}
      <button style={styles.btnPrimary} onClick={save}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder les scores"}</button>
    </div>
  );
}

function AdminRankings({ results, updateResults }) {
  const [local, setLocal] = useState(results.groupRankings || {});
  const [saved, setSaved] = useState(false);

  function save() {
    updateResults({ ...results, groupRankings: local });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p style={styles.hint}>Saisissez le classement final de chaque groupe (1er → 4e).</p>
      {Object.entries(GROUPS).map(([group, teams]) => (
        <div key={group} style={styles.groupSection}>
          <h3 style={styles.groupTitle}>Groupe {group}</h3>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={styles.matchRow}>
              <span style={styles.rankPos}>{i + 1}e</span>
              <select style={styles.select}
                value={local[group]?.[i] || ""}
                onChange={e => setLocal(l => {
                  const arr = [...(l[group] || ["", "", "", ""])];
                  arr[i] = e.target.value;
                  return { ...l, [group]: arr };
                })}>
                <option value="">-- Choisir --</option>
                {teams.map(t => <option key={t} value={t}>{flag(t)} {t}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}
      <button style={styles.btnPrimary} onClick={save}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder les classements"}</button>
    </div>
  );
}

function AdminKO({ results, updateResults }) {
  const [local, setLocal] = useState(results.koResults || {});
  const [saved, setSaved] = useState(false);

  function save() {
    updateResults({ ...results, koResults: local });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function setField(phaseKey, matchId, field, value) {
    setLocal(l => ({
      ...l,
      [phaseKey]: {
        ...(l[phaseKey] || {}),
        [matchId]: { ...(l[phaseKey]?.[matchId] || {}), [field]: value }
      }
    }));
  }

  return (
    <div>
      <div style={styles.koRuleBox}>
        <strong>Instructions admin :</strong>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.6 }}>
          • Score = score à la fin du temps réglementaire <strong>ou des prolongations</strong><br/>
          • Cocher "TAB" si le match a été décidé aux tirs au but<br/>
          • Vainqueur = équipe qualifiée (même si TAB)
        </div>
      </div>
      {KO_PHASES.map(phase => {
        const slots = Array.from({ length: phase.matches }, (_, i) => ({ matchId: `${phase.key}_${i + 1}`, label: `Match ${i + 1}` }));
        return (
          <div key={phase.key} style={styles.groupSection}>
            <h3 style={styles.groupTitle}>{phase.label}</h3>
            {slots.map(slot => {
              const m = local[phase.key]?.[slot.matchId] || {};
              return (
                <div key={slot.matchId} style={styles.koMatchRow}>
                  <div style={styles.koMatchHeader}>
                    <span style={styles.koLabel}>{slot.label}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!m.penalties}
                        onChange={e => setField(phase.key, slot.matchId, "penalties", e.target.checked)} />
                      TAB (tirs au but)
                    </label>
                  </div>
                  <div style={styles.koMatchInputs}>
                    <input style={{ ...styles.scoreInput, width: 48 }} type="number" min="0" max="20" placeholder="–"
                      value={m.homeScore ?? ""}
                      onChange={e => setField(phase.key, slot.matchId, "homeScore", e.target.value)} />
                    <span style={styles.vs}>–</span>
                    <input style={{ ...styles.scoreInput, width: 48 }} type="number" min="0" max="20" placeholder="–"
                      value={m.awayScore ?? ""}
                      onChange={e => setField(phase.key, slot.matchId, "awayScore", e.target.value)} />
                    <span style={styles.koSep}>Vainqueur :</span>
                    <input style={{ ...styles.koInput, flex: 1 }} placeholder="Équipe qualifiée"
                      value={m.winner || ""}
                      onChange={e => setField(phase.key, slot.matchId, "winner", e.target.value)} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <button style={styles.btnPrimary} onClick={save}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}</button>
    </div>
  );
}

function AdminPhases({ results, updateResults, players, updatePlayers }) {
  const phaseOrder = ["none", "R16", "QF", "SF", "F"];
  const phases = [
    { key: "none", label: "⏳ Phase de poules", desc: "Pronostics phase finale fermés — les joueurs saisissent leurs scores de poules." },
    { key: "R16",  label: "Seizièmes de finale", desc: "Les joueurs pronostiquent les 16 matchs des seizièmes. Les poules précédentes sont verrouillées." },
    { key: "QF",   label: "Huitièmes de finale", desc: "Les joueurs pronostiquent les 8 quarts. Les seizièmes sont verrouillés." },
    { key: "SF",   label: "Demi-finales",         desc: "Les joueurs pronostiquent les 4 demi-finales. Les quarts sont verrouillés." },
    { key: "F",    label: "Finale",               desc: "Les joueurs pronostiquent la finale. Les demi-finales sont verrouillées." },
  ];
  const current = results.openKoPhase || "none";
  const currentIdx = phaseOrder.indexOf(current);

  const [confirmPhase, setConfirmPhase] = useState(null);

  function openPhase(key) {
    setConfirmPhase(key);
  }

  function confirmOpenPhase() {
    const key = confirmPhase;
    const prevPhase = phaseOrder[phaseOrder.indexOf(key) - 1];
    if (prevPhase && prevPhase !== "none") {
      const updatedPlayers = players.map(p => ({
        ...p,
        lockedKoPhases: [...new Set([...(p.lockedKoPhases || []), prevPhase])]
      }));
      updatePlayers(updatedPlayers);
    }
    updateResults({ ...results, openKoPhase: key });
    setConfirmPhase(null);
  }

  const confirmingPhase = phases.find(p => p.key === confirmPhase);

  return (
    <div>
      <p style={styles.hint}>Ouvre chaque phase une fois les résultats précédents saisis. L'ouverture d'une nouvelle phase <strong style={{ color: C.text }}>verrouille automatiquement la phase précédente</strong> pour tous les joueurs.</p>

      {/* Confirmation inline (remplace window.confirm bloqué sur mobile) */}
      {confirmPhase && (
        <div style={{ background: "#1a0d00", border: "1px solid #f97316", borderRadius: 10, padding: "14px", marginBottom: 12 }}>
          <p style={{ color: "#f97316", fontWeight: 700, margin: "0 0 6px" }}>⚠️ Confirmer l'ouverture</p>
          <p style={{ color: C.text, fontSize: 13, margin: "0 0 12px" }}>
            Ouvrir <strong>{confirmingPhase?.label}</strong> ?{" "}
            {confirmPhase !== "none" && <span style={{ color: C.textMuted }}>La phase précédente sera verrouillée pour tous les joueurs.</span>}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.btnPrimary, background: "#22c55e", flex: 1 }} onClick={confirmOpenPhase}>✅ Confirmer</button>
            <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setConfirmPhase(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {phases.map((p, idx) => {
          const isActive = current === p.key;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx;
          return (
            <div key={p.key} style={{
              ...styles.groupSection,
              border: isActive ? "1px solid #22c55e" : isPast ? `1px solid ${C.border}` : `1px solid ${C.border}`,
              background: isActive ? "#0d2015" : isPast ? "#0a1208" : C.surface,
              opacity: isFuture ? 0.6 : 1
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isActive ? "#22c55e" : isPast ? C.textMuted : C.text }}>
                    {isPast ? "✅ " : isActive ? "🟢 " : "🔒 "}{p.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{p.desc}</div>
                </div>
                {isActive
                  ? <span style={{ ...styles.ptsBadge, background: "#22c55e", fontSize: 12 }}>Phase actuelle</span>
                  : isPast
                  ? <span style={{ ...styles.ptsBadge, background: C.surface2, fontSize: 12 }}>Terminée</span>
                  : <button style={{ ...styles.btnPrimary, width: "auto", fontSize: 12, padding: "7px 14px" }}
                      onClick={() => openPhase(p.key)}>
                      Ouvrir →
                    </button>
                }
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "10px 14px", background: C.surface2, borderRadius: 10, fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
        <strong style={{ color: C.text }}>Workflow recommandé :</strong><br/>
        1. Avant le tournoi → laisser sur "Phase de poules"<br/>
        2. Après les poules → saisir scores + ouvrir "Seizièmes"<br/>
        3. Après les seizièmes → saisir résultats phase finale + ouvrir "Huitièmes"<br/>
        4. Et ainsi de suite jusqu'à la Finale
      </div>
    </div>
  );
}

function AdminBonus({ results, updateResults }) {
  const [winner, setWinner] = useState(results.bonusResults?.winner || "");
  const [topScorer, setTopScorer] = useState(results.bonusResults?.topScorer || "");
  const [saved, setSaved] = useState(false);
  const allTeams = Object.values(GROUPS).flat();

  function save() {
    updateResults({ ...results, bonusResults: { winner: winner.trim(), topScorer: topScorer.trim() } });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={styles.groupSection}>
      <h3 style={styles.groupTitle}>🌟 Résultats bonus</h3>
      <p style={styles.hint}>À saisir une fois le tournoi terminé pour attribuer les points bonus.</p>

      <div style={{ marginTop: 12 }}>
        <label style={styles.label}>🏆 Vainqueur de la Coupe du Monde</label>
        <select style={{ ...styles.select, marginTop: 6, width: "100%" }} value={winner} onChange={e => setWinner(e.target.value)}>
          <option value="">-- Choisir --</option>
          {allTeams.map(t => <option key={t} value={t}>{flag(t)} {t}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={styles.label}>⚽ Meilleur buteur</label>
        <select style={{ ...styles.select, marginTop: 6, width: "100%" }}
          value={TOP_SCORERS_CDM.includes(topScorer) ? topScorer : (topScorer ? "__autre__" : "")}
          onChange={e => { if(e.target.value === "__autre__") setTopScorer(""); else setTopScorer(e.target.value); }}>
          <option value="">-- Choisir le meilleur buteur --</option>
          {TOP_SCORERS_CDM.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__autre__">Autre (saisie libre)</option>
        </select>
        {!TOP_SCORERS_CDM.includes(topScorer) && (
          <input style={{ ...styles.input, marginTop: 6 }} placeholder="Saisir le nom du joueur"
            value={topScorer} onChange={e => setTopScorer(e.target.value)} />
        )}
      </div>

      <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={save}>{saved ? "✅ Sauvegardé !" : "💾 Valider les résultats bonus"}</button>
    </div>
  );
}

function AdminTest({ results, updateResults, players, updatePlayers }) {
  const [status, setStatus] = useState("");

  function rand(n) { return Math.floor(Math.random() * n); }

  const FAKE_NAMES = [
    "Alice Martin","Bob Dupont","Claire Moreau","David Leroy",
    "Emma Bernard","François Petit","Hugo Simon",
    "Inès Thomas","Julien Robert","Laura Blanc"
  ];
  const ALL_TEAMS = Object.values(GROUPS).flat();
  const TOP_SCORERS = ["Kylian Mbappé","Erling Haaland","Vinicius Jr",
    "Lionel Messi","Harry Kane","Lamine Yamal","Romelu Lukaku","João Félix"];

  // Résultats réels fixes pour les groupes A et I (complets) + C partiel
  const REAL_SCORES = {
    A1:{homeScore:"3",awayScore:"0"}, A2:{homeScore:"1",awayScore:"1"},
    A3:{homeScore:"2",awayScore:"0"}, A4:{homeScore:"1",awayScore:"2"},
    A5:{homeScore:"1",awayScore:"0"}, A6:{homeScore:"2",awayScore:"1"},
    I1:{homeScore:"2",awayScore:"0"}, I2:{homeScore:"1",awayScore:"1"},
    I3:{homeScore:"3",awayScore:"1"}, I4:{homeScore:"2",awayScore:"0"},
    I5:{homeScore:"1",awayScore:"0"}, I6:{homeScore:"1",awayScore:"2"},
    C1:{homeScore:"4",awayScore:"0"}, C2:{homeScore:"2",awayScore:"1"},
    C3:{homeScore:"1",awayScore:"0"},
  };

  function loadTestData() {
    

    const fakePlayers = FAKE_NAMES.map((name, i) => {
      const predictions = GROUP_MATCHES.map(m => ({
        matchId: m.id, home: `${rand(4)}`, away: `${rand(4)}`
      }));
      // Greg pronostique exactement les bons scores pour le groupe I (pour tester les +3)
      if (name === "Hugo Simon") {
        ["I1","I2","I3","I4","I5","I6"].forEach(id => {
          const r = REAL_SCORES[id];
          const pred = predictions.find(p => p.matchId === id);
          if (pred && r) { pred.home = r.homeScore; pred.away = r.awayScore; }
        });
      }
      return {
        id: `test_${i+1}`,
        name,
        pin: `${1000 + i * 111}`.slice(0,4),
        predictions,
        koPredictions: {},
        bonusPredictions: {
          winner: ALL_TEAMS[rand(ALL_TEAMS.length)],
          topScorer: TOP_SCORERS[rand(TOP_SCORERS.length)],
        },
        locked: false,
        lockedKoPhases: [],
      };
    });

    // Greg pronostique France vainqueur + Mbappé meilleur buteur
    fakePlayers[6].bonusPredictions = { winner: "France", topScorer: "Kylian Mbappé" };

    const testResults = {
      groupResults: REAL_SCORES,
      koResults: {},
      groupRankings: {},
      bonusResults: { winner: "France", topScorer: "Kylian Mbappé" },
      locked: false,
      openKoPhase: "none",
    };

    updatePlayers(fakePlayers);
    updateResults(testResults);
    setStatus("✅ Données de test chargées ! Rechargez la page pour les voir.");
  }

  function clearTestData() {
    
    updatePlayers([]);
    updateResults({ groupResults:{}, koResults:{}, groupRankings:{}, locked:false, openKoPhase:"none" });
    setStatus("🗑️ Données effacées.");
  }

  const pins = FAKE_NAMES.map((n,i) => `${n} → PIN: ${`${1000+i*111}`.slice(0,4)}`);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:"#1a0d1a", border:"1px solid #7c3aed", borderRadius:10, padding:"12px 14px" }}>
        <strong style={{ color:"#a78bfa" }}>🧪 Mode test — données fictives</strong>
        <p style={{ ...styles.hint, marginTop:4 }}>Injecte 10 joueurs avec pronostics aléatoires + résultats réels des groupes A, I (complets) et C (partiel).</p>
        <p style={{ ...styles.hint, marginTop:4, color:"#f59e0b" }}>⚠️ Hugo Simon a pronostiqué les scores exacts du groupe I → il doit marquer le maximum de points. Greg Pornin Vallet a pronostiqué France + Mbappé → +10 pts bonus.</p>
      </div>

      <button style={{ ...styles.btnPrimary, background:"#7c3aed" }} onClick={loadTestData}>
        🧪 Charger les données de test
      </button>
      <button style={{ ...styles.btnDanger }} onClick={clearTestData}>
        🗑️ Effacer toutes les données
      </button>

      {status && <p style={{ color:"#22c55e", fontWeight:600, fontSize:13 }}>{status}</p>}

      <div style={{ ...styles.groupSection, marginTop:8 }}>
        <h3 style={styles.groupTitle}>📋 PINs des joueurs de test</h3>
        {pins.map((p,i) => <div key={i} style={{ fontSize:12, color:C.textMuted, padding:"3px 0" }}>{p}</div>)}
        <div style={{ fontSize:12, color:"#f59e0b", marginTop:8 }}>
          Résultats réels injectés : <strong style={{color:C.text}}>🏆 France</strong> · <strong style={{color:C.text}}>⚽ Kylian Mbappé</strong>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DETAIL POINTS ─────────────────────────────────────────────────────

function AdminDetail({ players, results }) {
  const [selectedId, setSelectedId] = useState(players[0]?.id || "");
  const player = players.find(p => p.id === selectedId);
  if (!player) return <p style={styles.hint}>Aucun joueur.</p>;

  const { total, detail } = calcScore(player, results);

  // Grouper les points par catégorie
  const matchPts = Object.entries(detail).filter(([k]) => !k.startsWith("rank_") && !k.startsWith("ko_") && !k.startsWith("bonus_"));
  const rankPts = Object.entries(detail).filter(([k]) => k.startsWith("rank_"));
  const koPts = Object.entries(detail).filter(([k]) => k.startsWith("ko_"));
  const bonusPts = Object.entries(detail).filter(([k]) => k.startsWith("bonus_"));

  const matchTotal = matchPts.reduce((s, [,v]) => s + v, 0);
  const rankTotal = rankPts.reduce((s, [,v]) => s + v, 0);
  const koTotal = koPts.reduce((s, [,v]) => s + v, 0);
  const bonusTotal = bonusPts.reduce((s, [,v]) => s + v, 0);

  return (
    <div>
      {/* Sélecteur joueur */}
      <select style={{ ...styles.select, marginBottom: 16 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        {players.map(p => {
          const { total } = calcScore(p, results);
          return <option key={p.id} value={p.id}>{p.name} — {total} pts</option>;
        })}
      </select>

      {/* Résumé */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "⚽ Matchs", val: matchTotal, color: C.accent },
          { label: "📊 Classements", val: rankTotal, color: "#3b82f6" },
          { label: "🏆 Phase finale", val: koTotal, color: "#f59e0b" },
          { label: "🌟 Bonus", val: bonusTotal, color: "#22c55e" },
          { label: "TOTAL", val: total, color: C.text },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Détail matchs */}
      <div style={styles.groupSection}>
        <h3 style={styles.groupTitle}>⚽ Détail matchs de poules</h3>
        {GROUP_MATCHES.map(m => {
          const pred = player.predictions?.find(p => p.matchId === m.id);
          const real = results.groupResults?.[m.id];
          const pts = detail[m.id];
          if (!pred || pred.home === "" || !real || real.homeScore === "") return null;
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: C.textMuted, minWidth: 20 }}>{m.group}</span>
              <span style={{ flex: 1 }}>{flag(m.home)} {m.home} vs {flag(m.away)} {m.away}</span>
              <span style={{ color: C.textMuted }}>Pronos: <strong style={{ color: C.text }}>{pred.home}-{pred.away}</strong></span>
              <span style={{ color: C.textMuted }}>Réel: <strong style={{ color: C.text }}>{real.homeScore}-{real.awayScore}</strong></span>
              <span style={{ ...styles.ptsBadge, background: pts === 3 ? "#22c55e" : pts === 1 ? "#f59e0b" : "#ef4444" }}>
                {pts === 3 ? "🎯 +3" : pts === 1 ? "✅ +1" : "❌ 0"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Détail classements */}
      {rankTotal > 0 && (
        <div style={styles.groupSection}>
          <h3 style={styles.groupTitle}>📊 Points classements de groupe</h3>
          {Object.keys(GROUPS).map(group => {
            const groupPts = [0,1,2,3].reduce((acc, i) => acc + (detail[`rank_${group}_${i}`] || 0), 0);
            if (groupPts === 0) return null;
            return (
              <div key={group} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span>Groupe {group}</span>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>+{groupPts} pts</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bonus */}
      {bonusTotal > 0 && (
        <div style={styles.groupSection}>
          <h3 style={styles.groupTitle}>🌟 Bonus</h3>
          {detail["bonus_winner"] && <div style={{ fontSize: 13, padding: "4px 0" }}>🏆 Vainqueur CDM correct → <strong style={{ color: "#22c55e" }}>+5 pts</strong></div>}
          {detail["bonus_topScorer"] && <div style={{ fontSize: 13, padding: "4px 0" }}>⚽ Meilleur buteur correct → <strong style={{ color: "#22c55e" }}>+5 pts</strong></div>}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN BRACKET KO ────────────────────────────────────────────────────────

function AdminBracket({ results, updateResults }) {
  const qualified = calcQualified(results.groupResults);
  const certain = calcCertainQualified(results.groupResults);

  // Vainqueurs réels saisis
  const realWinners = {};
  ["R16","QF","SF","F"].forEach(phase => {
    Object.entries(results.koResults?.[phase] || {}).forEach(([mid, v]) => {
      if (v?.winner) realWinners[mid] = v.winner;
    });
  });

  const [localKo, setLocalKo] = useState(results.koResults || {});
  const [saved, setSaved] = useState(false);

  function save() {
    updateResults({ ...results, koResults: localKo });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const allPhases = [
    { key: "R16", label: "Seizièmes de finale", bracket: R16_BRACKET },
    { key: "QF",  label: "Huitièmes de finale", bracket: QF_BRACKET },
    { key: "SF",  label: "Demi-finales",         bracket: SF_BRACKET },
    { key: "F",   label: "Finale",               bracket: F_BRACKET },
  ];

  return (
    <div>
      <p style={styles.hint}>Tableau calculé automatiquement depuis les résultats de poules. Tu peux corriger manuellement si besoin.</p>

      {allPhases.map(({ key, label, bracket }) => (
        <div key={key} style={styles.groupSection}>
          <h3 style={styles.groupTitle}>{label}</h3>
          {bracket.map(match => {
            const homeTeam = resolveSlot(match.home, certain, realWinners);
            const awayTeam = resolveSlot(match.away, certain, realWinners);
            const current = localKo[key]?.[match.id];
            const teamsForMatch = [homeTeam, awayTeam].filter(Boolean);

            return (
              <div key={match.id} style={{ ...styles.matchRow, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13, minWidth: 120 }}>
                  {homeTeam ? <>{flag(homeTeam)} {homeTeam}</> : <span style={{ color: C.textMuted, fontSize: 11 }}>{slotLabel(match.home)}</span>}
                  <span style={{ color: C.textMuted, margin: "0 4px" }}>vs</span>
                  {awayTeam ? <>{flag(awayTeam)} {awayTeam}</> : <span style={{ color: C.textMuted, fontSize: 11 }}>{slotLabel(match.away)}</span>}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                  <input style={{ ...styles.scoreInput, width: 44 }} type="number" inputMode="numeric" min="0" max="20" placeholder="–"
                    value={current?.homeScore ?? ""}
                    onChange={e => setLocalKo(k => ({ ...k, [key]: { ...(k[key]||{}), [match.id]: { ...(k[key]?.[match.id]||{}), homeScore: e.target.value } } }))} />
                  <span style={styles.vs}>–</span>
                  <input style={{ ...styles.scoreInput, width: 44 }} type="number" inputMode="numeric" min="0" max="20" placeholder="–"
                    value={current?.awayScore ?? ""}
                    onChange={e => setLocalKo(k => ({ ...k, [key]: { ...(k[key]||{}), [match.id]: { ...(k[key]?.[match.id]||{}), awayScore: e.target.value } } }))} />
                  {teamsForMatch.length === 2
                    ? <select style={{ ...styles.select, flex: 1 }}
                        value={current?.winner || ""}
                        onChange={e => setLocalKo(k => ({ ...k, [key]: { ...(k[key]||{}), [match.id]: { ...(k[key]?.[match.id]||{}), winner: e.target.value } } }))}>
                        <option value="">-- Vainqueur --</option>
                        {teamsForMatch.map(t => <option key={t} value={t}>{flag(t)} {t}</option>)}
                      </select>
                    : <input style={{ ...styles.koInput, flex: 1 }} placeholder="Vainqueur"
                        value={current?.winner || ""}
                        onChange={e => setLocalKo(k => ({ ...k, [key]: { ...(k[key]||{}), [match.id]: { ...(k[key]?.[match.id]||{}), winner: e.target.value } } }))} />
                  }
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button style={styles.btnPrimary} onClick={save}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder le tableau"}</button>
    </div>
  );
}

function AdminPlayers({ players, updatePlayers }) {
  function removePlayer(id) {
    // confirm supprimé (bloqué sur mobile) — action directe
    updatePlayers(players.filter(p => p.id !== id));
  }

  function unlockPlayer(id) {

    updatePlayers(players.map(p => p.id === id ? { ...p, locked: false } : p));
  }

  function unlockKoPhase(id, phase) {
    const label = { R16: "Seizièmes", QF: "Huitièmes", SF: "Demi-finales", F: "Finale" }[phase];

    updatePlayers(players.map(p => p.id === id
      ? { ...p, lockedKoPhases: (p.lockedKoPhases || []).filter(ph => ph !== phase) }
      : p));
  }

  return (
    <div>
      <h3 style={styles.groupTitle}>Joueurs inscrits ({players.length})</h3>
      {players.length === 0 && <p style={styles.empty}>Aucun joueur inscrit.</p>}
      {players.map(p => (
        <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          {/* Ligne principale */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={styles.avatarSm}>{getInitials(p.name)}</div>
            <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
            <span style={{ fontSize: 12, fontFamily: "monospace", background: C.surface2, padding: "2px 8px", borderRadius: 6, color: p.pin ? C.gold : C.red }}>
              {p.pin ? `🔐 ${p.pin}` : "⚠️ Sans PIN"}
            </span>
            <button style={{ ...styles.btnSecondary, fontSize: 11, padding: "4px 8px" }}
              onClick={() => {
                const np = prompt(`Nouveau code 4 chiffres pour ${p.name} :`);
                if (np && /^[0-9]{4}$/.test(np)) { updatePlayers(players.map(pl => pl.id === p.id ? { ...pl, pin: np } : pl)); alert("Code mis à jour !"); }
                else if (np) alert("Code invalide (4 chiffres requis)");
              }}>
              🔑 Code
            </button>
            <button style={styles.btnDanger} onClick={() => removePlayer(p.id)}>🗑️</button>
          </div>

          {/* Statut verrous */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {/* Verrou poules */}
            <span style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 20,
              background: p.locked ? "#0d2015" : C.surface2,
              border: `1px solid ${p.locked ? "#22c55e" : C.border}`,
              color: p.locked ? "#22c55e" : C.textMuted,
              cursor: p.locked ? "pointer" : "default",
            }}
              onClick={() => p.locked && unlockPlayer(p.id)}
              title={p.locked ? "Cliquer pour déverrouiller" : ""}
            >
              {p.locked ? "🔒 Poules verrouillées" : "✏️ Poules ouvertes"}
            </span>

            {/* Verrous phases finale */}
            {["R16","QF","SF","F"].map(phase => {
              const label = { R16:"1/16", QF:"1/8", SF:"1/2", F:"Finale" }[phase];
              const isLocked = (p.lockedKoPhases || []).includes(phase);
              if (!isLocked) return null;
              return (
                <span key={phase} style={{
                  fontSize: 11, padding: "3px 8px", borderRadius: 20,
                  background: "#0d2015", border: "1px solid #22c55e",
                  color: "#22c55e", cursor: "pointer",
                }}
                  onClick={() => unlockKoPhase(p.id, phase)}
                  title="Cliquer pour déverrouiller"
                >
                  🔒 {label} — cliquer pour déverrouiller
                </span>
              );
            })}

            {/* Pronostics saisis */}
            <span style={{ fontSize: 11, color: C.textMuted, padding: "3px 8px" }}>
              {(p.predictions || []).filter(x => x.home !== "" && x.away !== "").length}/72 matchs pronostiqués
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0e1a",
  surface: "#111827",
  surface2: "#1a2332",
  border: "#1e2d42",
  accent: "#f97316",
  accentDark: "#c2410c",
  gold: "#fbbf24",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#f59e0b",
};

const styles = {
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", overflowX: "hidden", WebkitTextSizeAdjust: "100%" },
  loading: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, color: C.text },
  loadingBall: { fontSize: 48, animation: "spin 1s linear infinite" },
  loadingText: { color: C.textMuted, marginTop: 12 },
  main: { maxWidth: 800, margin: "0 auto", padding: "16px 12px 100px" },

  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, WebkitOverflowScrolling: "touch" },
  headerInner: { maxWidth: 800, margin: "0 auto", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  logo: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 0", touchAction: "manipulation" },
  logoIcon: { fontSize: 22 },
  logoText: { color: C.text, fontWeight: 800, fontSize: 16, letterSpacing: 2 },
  logoBadge: { background: C.accent, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: 1 },
  nav: { display: "flex", gap: 4 },
  navBtn: { background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: "10px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, minHeight: 44, touchAction: "manipulation" },
  navBtnActive: { background: C.surface2, color: C.text },

  homeWrap: { display: "flex", flexDirection: "column", gap: 20 },
  hero: { position: "relative", background: `linear-gradient(135deg, ${C.surface} 0%, #0d1b2e 100%)`, borderRadius: 16, padding: "36px 24px", textAlign: "center", overflow: "hidden", border: `1px solid ${C.border}` },
  heroGlow: { position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, background: `radial-gradient(circle, ${C.accent}22 0%, transparent 70%)`, pointerEvents: "none" },
  heroTitle: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -1, color: C.text },
  heroSub: { color: C.textMuted, marginTop: 8, fontSize: 15 },
  heroActions: { marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },

  cardsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, textAlign: "center" },
  cardIcon: { fontSize: 28 },
  cardLabel: { color: C.textMuted, fontSize: 12, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  cardValue: { fontSize: 22, fontWeight: 800, color: C.text, marginTop: 4 },
  cardSub: { color: C.textMuted, fontSize: 11, marginTop: 4 },

  rulesBox: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 },
  rulesTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  rulesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  ruleItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.surface2, borderRadius: 8 },
  ruleIcon: { fontSize: 18 },
  ruleLabel: { flex: 1, fontSize: 13, color: C.text },
  rulePts: { fontWeight: 800, color: C.accent, fontSize: 13 },

  formWrap: { maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" },
  formTitle: { margin: "0 0 4px", fontSize: 22, fontWeight: 800 },
  label: { fontSize: 13, color: C.textMuted, marginBottom: -4 },
  input: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 14px", color: C.text, fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box", minHeight: 48 },
  select: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 12px", color: C.text, fontSize: 16, outline: "none", flex: 1, minHeight: 48, width: "100%", boxSizing: "border-box" },
  error: { color: C.red, fontSize: 13, margin: 0 },
  hint: { color: C.textMuted, fontSize: 13, margin: 0 },
  empty: { color: C.textMuted, textAlign: "center", padding: 20 },
  linkBtn: { background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" },

  btnPrimary: { background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "14px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", minHeight: 50, touchAction: "manipulation" },
  btnSecondary: { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer", minHeight: 50, touchAction: "manipulation" },
  btnDanger: { background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  playerList: { display: "flex", flexDirection: "column", gap: 6 },
  playerListItem: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px", cursor: "pointer", color: C.text, fontSize: 16, textAlign: "left", minHeight: 52, touchAction: "manipulation", width: "100%" },
  chevron: { marginLeft: "auto", color: C.textMuted },

  playerWrap: { display: "flex", flexDirection: "column", gap: 16 },
  playerHeader: { display: "flex", alignItems: "center", gap: 14, background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` },
  playerName: { margin: 0, fontSize: 20, fontWeight: 800 },
  scoreDisplay: { color: C.textMuted, fontSize: 14, marginTop: 4 },
  avatarLg: { width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, flexShrink: 0 },
  avatarSm: { width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 },

  tabs: { display: "flex", gap: 6, overflowX: "auto" },
  tab: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.textMuted, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500, minHeight: 44, touchAction: "manipulation" },
  tabActive: { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` },

  groupSection: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 },
  groupTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1 },
  matchRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" },
  matchTeams: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  teamName: { fontSize: 13, color: C.text, whiteSpace: "nowrap" },
  scoreInputs: { display: "flex", alignItems: "center", gap: 4 },
  scoreInput: { width: 44, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 4px", color: C.text, fontSize: 16, textAlign: "center", outline: "none", minHeight: 44 },
  scoreInputDone: { opacity: 0.5 },
  vs: { color: C.textMuted, fontSize: 12 },
  matchMeta: { display: "flex", alignItems: "center", gap: 6 },
  realScore: { fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" },
  ptsBadge: { fontSize: 11, fontWeight: 700, color: "#fff", padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap" },

  rankRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: `1px solid ${C.border}` },
  rankCorrect: { background: "#16321a" },
  rankPos: { width: 20, color: C.gold, fontWeight: 700, fontSize: 14, textAlign: "center" },
  rankTeam: { flex: 1, fontSize: 13 },
  rankReal: { fontSize: 11, color: C.textMuted },
  rankBtns: { display: "flex", gap: 2 },
  rankBtn: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.textMuted, cursor: "pointer", fontSize: 16, minHeight: 44, minWidth: 44, touchAction: "manipulation" },

  groupSelector: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 },
  groupBtn: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  groupBtnActive: { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` },
  standingsHeader: { display: "flex", alignItems: "center", padding: "4px 6px", marginBottom: 2 },
  standingsRow: { display: "flex", alignItems: "center", padding: "5px 6px", borderRadius: 6, marginBottom: 2 },
  standingsCol: { minWidth: 28, textAlign: "center", fontSize: 12, color: C.textMuted },
  standingStat: { minWidth: 40, textAlign: "center", fontSize: 12, color: C.textMuted },
  qualifiedGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, marginTop: 8 },
  qualifiedBadge: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 6px", borderRadius: 8, border: "1px solid", textAlign: "center" },

  koLabel: { fontSize: 13, color: C.textMuted, minWidth: 70 },
  koInput: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 13, outline: "none" },
  koMatchRow: { borderBottom: `1px solid ${C.border}`, padding: "10px 0" },
  koMatchHeader: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  koMatchInputs: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 },
  koTeamsRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  koTeam: { fontSize: 13, fontWeight: 600, color: C.text, flex: 1, minWidth: 100 },
  koSep: { fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" },
  koRuleBox: { background: "#0d1f2d", border: `1px solid #1e3a4a`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.text },

  saveBar: { position: "sticky", bottom: 0, background: C.bg, padding: "12px 0 20px", borderTop: `1px solid ${C.border}`, zIndex: 50 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, padding: "8px 0 4px" },

  lbWrap: { display: "flex", flexDirection: "column", gap: 8 },
  potLine: { color: C.textMuted, fontSize: 14, padding: "8px 0 4px" },
  lbRow: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" },
  lbFirst: { border: `1px solid ${C.gold}`, background: "#1a1408" },
  lbSecond: { border: `1px solid #94a3b8`, background: "#131820" },
  lbThird: { border: `1px solid #b45309`, background: "#171008" },
  lbRank: { fontSize: 18, minWidth: 30, textAlign: "center" },
  lbName: { fontWeight: 600 },
  lbBonusLine: { display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 },
  lbBonusBadge: { fontSize: 10, padding: "2px 6px", borderRadius: 10, color: C.textMuted },
  lbScore: { fontWeight: 800, color: C.accent, fontSize: 16 },
  lbPrize: { background: C.gold, color: "#000", fontWeight: 800, fontSize: 12, padding: "3px 8px", borderRadius: 20 },
  bonusResultsBox: { display: "flex", gap: 12, flexWrap: "wrap", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text },
  bonusBox: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6 },
  bonusTitle: { fontWeight: 700, fontSize: 13, color: C.accent, marginBottom: 4 },
  bonusPts: { background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, marginLeft: 6 },
  bonusRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" },
  bonusRowLabel: { fontSize: 13, fontWeight: 600, minWidth: 140, color: C.textMuted },
  bonusRowValue: { flex: 1 },
  bonusTeam: { fontSize: 14, fontWeight: 700, color: C.text },

  lockedBanner: { background: "#0d2015", border: "1px solid #22c55e", borderRadius: 10, padding: "12px 16px", color: "#22c55e", fontWeight: 600, fontSize: 13, textAlign: "center" },
  adminWrap: { display: "flex", flexDirection: "column", gap: 16 },
  adminHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
};
