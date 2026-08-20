import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Flag,
  History,
  Moon,
  RotateCcw,
  Settings,
  Sun,
  Trophy,
  Undo2,
  Redo2,
  Copy,
  Download,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { getBestMove } from "./chessAI";

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

const FILES = ["a","b","c","d","e","f","g","h"];
const START_FEN = new Chess().fen();

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function snapshot(fen, moves, lastMove) {
  return { fen, moves, lastMove };
}

function App() {
  const [fen, setFen] = useState(START_FEN);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [moves, setMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [mode, setMode] = useState("pvp");
  const [screen, setScreen] = useState("menu");
  const [aiDepth, setAiDepth] = useState(2);
  const [timeControl, setTimeControl] = useState(600);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [gameOver, setGameOver] = useState(false);
  const [status, setStatus] = useState("White to move");
  const [promotion, setPromotion] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [sound, setSound] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fenInput, setFenInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const board = chess.board();

  const currentTurn = chess.turn();
  const isAITurn = mode === "ai" && currentTurn === "b" && !gameOver;

  const currentSnapshot = () => snapshot(fen, moves, lastMove);

  const playTone = (frequency = 440) => {
    if (!sound) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  };

  const refreshStatus = (game) => {
    if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "Black" : "White";
      setStatus(`Checkmate — ${winner} wins`);
      setGameOver(true);
      return;
    }
    if (game.isStalemate()) {
      setStatus("Stalemate — Draw");
      setGameOver(true);
      return;
    }
    if (game.isThreefoldRepetition()) {
      setStatus("Threefold repetition — Draw");
      setGameOver(true);
      return;
    }
    if (game.isInsufficientMaterial()) {
      setStatus("Insufficient material — Draw");
      setGameOver(true);
      return;
    }
    if (game.isDraw()) {
      setStatus("Draw");
      setGameOver(true);
      return;
    }
    if (game.isCheck()) {
      setStatus(`${game.turn() === "w" ? "White" : "Black"} is in check`);
    } else {
      setStatus(`${game.turn() === "w" ? "White" : "Black"} to move`);
    }
  };

  const commitMove = (moveData) => {
    const next = new Chess(fen);
    let result;
    try {
      result = next.move(moveData);
    } catch {
      return false;
    }

    setPast((p) => [...p, currentSnapshot()]);
    setFuture([]);
    setFen(next.fen());
    setMoves((m) => [...m, result.san]);
    setLastMove({ from: result.from, to: result.to });
    setSelected(null);
    setLegalMoves([]);
    refreshStatus(next);
    playTone(result.captured ? 300 : 520);
    return true;
  };

  const selectSquare = (square) => {
    if (gameOver || thinking) return;

    const piece = chess.get(square);
    if (selected) {
      const candidate = legalMoves.find((m) => m.to === square);
      if (candidate) {
        if (candidate.promotion) {
          setPromotion({ from: selected, to: square, color: currentTurn });
        } else {
          commitMove({ from: selected, to: square });
        }
        return;
      }

      if (piece && piece.color === currentTurn) {
        const nextMoves = chess.moves({ square, verbose: true });
        setSelected(square);
        setLegalMoves(nextMoves);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }

    if (piece && piece.color === currentTurn) {
      const nextMoves = chess.moves({ square, verbose: true });
      if (nextMoves.length) {
        setSelected(square);
        setLegalMoves(nextMoves);
      }
    }
  };

  const undo = () => {
    if (!past.length || thinking) return;
    const previous = past[past.length - 1];
    setFuture((f) => [currentSnapshot(), ...f]);
    setPast((p) => p.slice(0, -1));
    setFen(previous.fen);
    setMoves(previous.moves);
    setLastMove(previous.lastMove);
    setSelected(null);
    setLegalMoves([]);
    setGameOver(false);
    setTimeout(() => refreshStatus(new Chess(previous.fen)), 0);
  };

  const redo = () => {
    if (!future.length || thinking) return;
    const next = future[0];
    setPast((p) => [...p, currentSnapshot()]);
    setFuture((f) => f.slice(1));
    setFen(next.fen);
    setMoves(next.moves);
    setLastMove(next.lastMove);
    setSelected(null);
    setLegalMoves([]);
    setGameOver(false);
    setTimeout(() => refreshStatus(new Chess(next.fen)), 0);
  };

  const reset = () => {
    setFen(START_FEN);
    setPast([]);
    setFuture([]);
    setMoves([]);
    setLastMove(null);
    setSelected(null);
    setLegalMoves([]);
    setGameOver(false);
    setStatus("White to move");
    setPromotion(null);
    setWhiteTime(timeControl);
    setBlackTime(timeControl);
    setThinking(false);
  };

  const startGame = (selectedMode = mode) => {
    setMode(selectedMode);
    reset();
    setScreen("game");
  };

  const loadFen = () => {
    try {
      const loaded = new Chess(fenInput.trim());
      setFen(loaded.fen());
      setPast([]);
      setFuture([]);
      setMoves([]);
      setLastMove(null);
      setSelected(null);
      setLegalMoves([]);
      setGameOver(false);
      refreshStatus(loaded);
      setScreen("game");
      setShowSettings(false);
    } catch {
      alert("Invalid FEN position.");
    }
  };

  const exportPGN = () => {
    const game = new Chess(START_FEN);
    for (const san of moves) {
      try {
        game.move(san);
      } catch {}
    }
    const blob = new Blob([game.pgn()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chess-game.pgn";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyFen = async () => {
    await navigator.clipboard?.writeText(fen);
  };

  useEffect(() => {
    if (screen !== "game" || gameOver) return;
    const id = setInterval(() => {
      if (currentTurn === "w") {
        setWhiteTime((t) => {
          if (t <= 1) {
            setGameOver(true);
            setStatus("Time out — Black wins");
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTime((t) => {
          if (t <= 1) {
            setGameOver(true);
            setStatus("Time out — White wins");
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [screen, gameOver, currentTurn]);

  useEffect(() => {
    if (!isAITurn) return;
    let cancelled = false;
    setThinking(true);

    const id = setTimeout(() => {
      if (cancelled) return;
      const best = getBestMove(fen, aiDepth);
      if (best) commitMove({ from: best.from, to: best.to, promotion: best.promotion });
      setThinking(false);
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(id);
      setThinking(false);
    };
  }, [isAITurn, fen, aiDepth]);

  useEffect(() => {
    localStorage.setItem("chess-pro-theme", theme);
    localStorage.setItem("chess-pro-sound", String(sound));
  }, [theme, sound]);

  const rows = flipped ? [...board].reverse() : board;
  const cols = flipped ? [...FILES].reverse() : FILES;

  const captured = (() => {
    const counts = { w: { p:0,n:0,b:0,r:0,q:0 }, b: { p:0,n:0,b:0,r:0,q:0 } };
    const start = { p:8,n:2,b:2,r:2,q:1 };
    const current = { w:{...start}, b:{...start} };
    for (const row of board) {
      for (const p of row) {
        if (p && p.type !== "k") current[p.color][p.type]--;
      }
    }
    for (const color of ["w","b"]) {
      for (const type of Object.keys(start)) counts[color][type] = Math.max(0, start[type] - current[color][type]);
    }
    return counts;
  })();

  const renderBoard = () => (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">♞</div>
          <div>
            <strong>Chess Pro</strong>
            <span>React Chess Platform</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setFlipped((v) => !v)} title="Flip board"><RotateCcw size={18}/></button>
          <button className="icon-btn" onClick={() => setSound((v) => !v)} title="Sound">{sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          <button className="icon-btn" onClick={() => setTheme((v) => v === "dark" ? "light" : "dark")} title="Theme">{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings"><Settings size={18}/></button>
        </div>
      </header>

      <main className="game-layout">
        <aside className="side-panel left-panel">
          <div className="panel-card profile-card">
            <div className="avatar black">♚</div>
            <div><strong>{mode === "ai" ? "Chess AI" : "Black Player"}</strong><span>{thinking ? "Thinking..." : "Black"}</span></div>
            <div className={`clock ${currentTurn === "b" ? "active-clock" : ""}`}>{formatTime(blackTime)}</div>
          </div>

          <div className="panel-card">
            <div className="panel-title"><History size={16}/> Move History</div>
            <div className="move-list">
              {moves.length === 0 && <div className="empty">No moves yet</div>}
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => (
                <div className="move-row" key={i}>
                  <span>{i + 1}.</span>
                  <span>{moves[i * 2] || ""}</span>
                  <span>{moves[i * 2 + 1] || ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title">Captured</div>
            <div className="captured-row">
              <span>{Object.entries(captured.b).map(([p,n]) => PIECES.w[p].repeat(n)).join("")}</span>
              <span className="material-count">+{Object.values(captured.b).reduce((a,b)=>a+b,0)}</span>
            </div>
            <div className="captured-row">
              <span>{Object.entries(captured.w).map(([p,n]) => PIECES.b[p].repeat(n)).join("")}</span>
              <span className="material-count">+{Object.values(captured.w).reduce((a,b)=>a+b,0)}</span>
            </div>
          </div>
        </aside>

        <section className="board-section">
          <div className="board-header">
            <div>
              <span className="eyebrow">{mode === "ai" ? "PLAYER VS AI" : "PLAYER VS PLAYER"}</span>
              <h1>{status}</h1>
            </div>
            {thinking && <div className="thinking"><Brain size={17}/> AI thinking</div>}
          </div>

          <div className="board-wrap">
            <div className="rank-labels">
              {(flipped ? ["1","2","3","4","5","6","7","8"] : ["8","7","6","5","4","3","2","1"]).map(r => <span key={r}>{r}</span>)}
            </div>
            <div className="board">
              {rows.map((row, ri) => row.map((piece, ci) => {
                const actualRow = flipped ? 7 - ri : ri;
                const actualCol = flipped ? 7 - ci : ci;
                const square = `${FILES[actualCol]}${8 - actualRow}`;
                const isSelected = selected === square;
                const isLegal = legalMoves.some(m => m.to === square);
                const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
                const isCheck = piece?.type === "k" && piece.color === currentTurn && chess.isCheck();

                return (
                  <button
                    key={square}
                    className={`square ${(actualRow + actualCol) % 2 ? "dark-square" : "light-square"} ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""} ${isLast ? "last-move" : ""} ${isCheck ? "in-check" : ""}`}
                    onClick={() => selectSquare(square)}
                    aria-label={square}
                  >
                    {piece && <span className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}>{PIECES[piece.color][piece.type]}</span>}
                    {isLegal && <span className={`move-dot ${piece ? "capture-dot" : ""}`}/>}
                  </button>
                );
              }))}
              <div className="file-labels">
                {cols.map(f => <span key={f}>{f}</span>)}
              </div>
            </div>
          </div>

          <div className="board-controls">
            <button onClick={undo} disabled={!past.length || thinking}><Undo2 size={17}/> Undo</button>
            <button onClick={redo} disabled={!future.length || thinking}><Redo2 size={17}/> Redo</button>
            <button onClick={reset}><RotateCcw size={17}/> New Game</button>
            <button onClick={exportPGN}><Download size={17}/> PGN</button>
          </div>
        </section>

        <aside className="side-panel right-panel">
          <div className="panel-card profile-card">
            <div className="avatar white">♔</div>
            <div><strong>White Player</strong><span>White</span></div>
            <div className={`clock ${currentTurn === "w" ? "active-clock" : ""}`}>{formatTime(whiteTime)}</div>
          </div>

          <div className="panel-card">
            <div className="panel-title">Position</div>
            <div className="fen-box">{fen}</div>
            <div className="mini-actions">
              <button onClick={copyFen}><Copy size={15}/> Copy FEN</button>
              <button onClick={() => setFlipped(v => !v)}><RotateCcw size={15}/> Flip</button>
            </div>
          </div>

          <div className="panel-card action-card">
            <button className="danger-btn" onClick={() => setScreen("menu")}><ChevronLeft size={17}/> Exit to menu</button>
          </div>
        </aside>
      </main>

      {promotion && (
        <div className="modal-backdrop">
          <div className="promotion-modal">
            <div className="modal-head"><h2>Choose promotion</h2><button onClick={() => setPromotion(null)}><X size={18}/></button></div>
            <div className="promotion-options">
              {["q","r","b","n"].map(type => (
                <button key={type} onClick={() => { commitMove({ from: promotion.from, to: promotion.to, promotion: type }); setPromotion(null); }}>
                  {PIECES[promotion.color][type]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop">
          <div className="settings-modal">
            <div className="modal-head"><h2>Game Settings</h2><button onClick={() => setShowSettings(false)}><X size={18}/></button></div>
            <label>AI difficulty
              <select value={aiDepth} onChange={e => setAiDepth(Number(e.target.value))}>
                <option value="1">Easy</option><option value="2">Medium</option><option value="3">Hard</option>
              </select>
            </label>
            <label>Time control
              <select value={timeControl} onChange={e => setTimeControl(Number(e.target.value))}>
                <option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="900">15 minutes</option>
              </select>
            </label>
            <label>Load FEN
              <input value={fenInput} onChange={e => setFenInput(e.target.value)} placeholder="Paste a FEN position" />
            </label>
            <button className="primary-btn" onClick={loadFen}>Load Position</button>
            <button className="secondary-btn" onClick={copyFen}><Clipboard size={16}/> Copy current FEN</button>
          </div>
        </div>
      )}
    </div>
  );

  if (screen === "menu") {
    return (
      <div className={`menu-screen ${theme}`}>
        <div className="hero-card">
          <div className="hero-logo">♞</div>
          <span className="eyebrow">REACT • CHESS.JS • AI</span>
          <h1>Chess Pro</h1>
          <p>A complete browser chess experience with legal move validation, AI, clocks, history and analysis tools.</p>
          <div className="mode-grid">
            <button className="mode-card" onClick={() => startGame("pvp")}>
              <Trophy size={28}/><strong>Player vs Player</strong><span>Local two-player match</span>
            </button>
            <button className="mode-card" onClick={() => startGame("ai")}>
              <Brain size={28}/><strong>Player vs AI</strong><span>Challenge the minimax engine</span>
            </button>
          </div>
          <div className="menu-settings">
            <label>Time
              <select value={timeControl} onChange={e => setTimeControl(Number(e.target.value))}>
                <option value="180">3 min</option><option value="300">5 min</option><option value="600">10 min</option><option value="900">15 min</option>
              </select>
            </label>
            <label>AI
              <select value={aiDepth} onChange={e => setAiDepth(Number(e.target.value))}>
                <option value="1">Easy</option><option value="2">Medium</option><option value="3">Hard</option>
              </select>
            </label>
          </div>
          <div className="feature-strip">
            <span>✓ Castling</span><span>✓ En passant</span><span>✓ Promotion</span><span>✓ Checkmate</span><span>✓ PGN/FEN</span>
          </div>
        </div>
      </div>
    );
  }

  return <div className={theme}>{renderBoard()}</div>;
}

export default App;
