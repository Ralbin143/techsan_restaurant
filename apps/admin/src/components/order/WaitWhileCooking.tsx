"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  Circle,
  Gamepad2,
  Gauge,
  Grid2X2,
  Hash,
  Lightbulb,
  RefreshCw,
  Scissors,
  Square,
  Zap,
} from "lucide-react";

type OrderLite = {
  _id: string;
  orderNumber: string;
  status: string;
};

const KITCHEN_WAIT_STATUSES = new Set(["pending", "confirmed", "preparing", "ready"]);

const FOOD_FACTS = [
  {
    title: "Did you know?",
    text: "Basmati rice is aged for months so each grain stays long and separate when cooked.",
  },
  {
    title: "Kitchen tip",
    text: "Resting grilled paneer for a minute helps it stay juicy—your chef knows the timing.",
  },
  {
    title: "Spice story",
    text: "Black cardamom adds a smoky depth to biryanis and dals—often used whole, not ground.",
  },
  {
    title: "Around the world",
    text: "Naan dough often uses yogurt, which tenderizes the bread and adds a subtle tang.",
  },
  {
    title: "Freshness",
    text: "Citrus zest in drinks releases oils that smell brighter than juice alone.",
  },
  {
    title: "Sweet finish",
    text: "Gulab jamun syrup is often scented with rose or cardamom—classic North Indian comfort.",
  },
];

type Cell = "X" | "O" | null;
const EMPTY: Cell[] = Array(9).fill(null);

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winner(board: Cell[]): "X" | "O" | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

function findWinningIndex(board: Cell[], player: "X" | "O"): number | null {
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const next = [...board] as Cell[];
    next[i] = player;
    if (winner(next) === player) return i;
  }
  return null;
}

function pickAiMove(board: Cell[]): number {
  const w = findWinningIndex(board, "O");
  if (w !== null) return w;
  const block = findWinningIndex(board, "X");
  if (block !== null) return block;
  if (!board[4]) return 4;
  const prefs = [0, 2, 6, 8, 1, 3, 5, 7];
  for (const i of prefs) {
    if (!board[i]) return i;
  }
  return board.findIndex((c) => !c);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MEMORY_EMOJIS = ["🍕", "🍜", "🥗", "🍰"] as const;

type MemCard = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

type Tab =
  | "facts"
  | "ttt"
  | "rush"
  | "rps"
  | "guess"
  | "reaction"
  | "memory";

const TAB_CONFIG: { id: Tab; label: string; icon: typeof Lightbulb }[] = [
  { id: "facts", label: "Facts", icon: Lightbulb },
  { id: "ttt", label: "Tic-tac", icon: Gamepad2 },
  { id: "rush", label: "Tap rush", icon: Zap },
  { id: "rps", label: "R · P · S", icon: Scissors },
  { id: "guess", label: "Guess #", icon: Hash },
  { id: "reaction", label: "Reflex", icon: Gauge },
  { id: "memory", label: "Pairs", icon: Grid2X2 },
];

const STATUS_WORD: Record<string, string> = {
  pending: "being received",
  confirmed: "confirmed with the kitchen",
  preparing: "being prepared",
  ready: "ready and on the way",
};

type RPS = "rock" | "paper" | "scissors";

function rpsWinner(a: RPS, b: RPS): "win" | "lose" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  ) {
    return "win";
  }
  return "lose";
}

function randomRPS(): RPS {
  const opts: RPS[] = ["rock", "paper", "scissors"];
  return opts[Math.floor(Math.random() * 3)];
}

function buildMemoryDeck(): MemCard[] {
  const pairs = MEMORY_EMOJIS.flatMap((emoji, pairIdx) => [
    { id: pairIdx * 2, emoji, flipped: false, matched: false },
    { id: pairIdx * 2 + 1, emoji, flipped: false, matched: false },
  ]);
  return shuffle(pairs);
}

export function WaitWhileCooking({ orders }: { orders: OrderLite[] }) {
  const show = useMemo(
    () => orders.some((o) => KITCHEN_WAIT_STATUSES.has(o.status)),
    [orders]
  );

  const [tab, setTab] = useState<Tab>("facts");
  const [factIndex, setFactIndex] = useState(0);

  const [board, setBoard] = useState<Cell[]>([...EMPTY]);
  const [tttMessage, setTttMessage] = useState<string | null>(null);

  const [rushActive, setRushActive] = useState(false);
  const [rushLeft, setRushLeft] = useState(0);
  const [rushScore, setRushScore] = useState(0);
  const [rushBest, setRushBest] = useState(0);

  const [rpsStreak, setRpsStreak] = useState(0);
  const [rpsLast, setRpsLast] = useState<{ you: RPS; kitchen: RPS; outcome: "win" | "lose" | "draw" } | null>(
    null
  );

  const [guessSecret, setGuessSecret] = useState(() => 1 + Math.floor(Math.random() * 30));
  const [guessInput, setGuessInput] = useState("");
  const [guessMsg, setGuessMsg] = useState<string | null>(null);
  const [guessCount, setGuessCount] = useState(0);

  type ReactionPhase = "idle" | "arming" | "go" | "early" | "done";
  const [reactionPhase, setReactionPhase] = useState<ReactionPhase>("idle");
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const goTimeRef = useRef(0);
  const armTimerRef = useRef<number | null>(null);

  const [memCards, setMemCards] = useState<MemCard[]>(() => buildMemoryDeck());
  const [memFlippedIdx, setMemFlippedIdx] = useState<number | null>(null);
  const [memMoves, setMemMoves] = useState(0);
  const [memLocked, setMemLocked] = useState(false);

  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => {
      setFactIndex((i) => (i + 1) % FOOD_FACTS.length);
    }, 14000);
    return () => window.clearInterval(id);
  }, [show]);

  useEffect(() => {
    return () => {
      if (armTimerRef.current != null) window.clearTimeout(armTimerRef.current);
    };
  }, []);

  const resetTtt = useCallback(() => {
    setBoard([...EMPTY]);
    setTttMessage(null);
  }, []);

  const playCell = (i: number) => {
    if (winner(board) || board[i]) return;
    const next = [...board] as Cell[];
    next[i] = "X";
    const w = winner(next);
    if (w === "X") {
      setBoard(next);
      setTttMessage("You win! Chef would be proud.");
      return;
    }
    if (w === "draw") {
      setBoard(next);
      setTttMessage("Draw — rematch?");
      return;
    }
    const ai = pickAiMove(next);
    next[ai] = "O";
    const w2 = winner(next);
    setBoard(next);
    if (w2 === "O") setTttMessage("Kitchen wins this round. Try again!");
    else if (w2 === "draw") setTttMessage("Draw — tap New game for a rematch.");
  };

  useEffect(() => {
    if (!rushActive) return;
    if (rushLeft <= 0) {
      setRushActive(false);
      setRushBest((b) => Math.max(b, rushScore));
      return;
    }
    const t = window.setTimeout(() => setRushLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [rushActive, rushLeft, rushScore]);

  const startRush = () => {
    setRushScore(0);
    setRushLeft(10);
    setRushActive(true);
  };

  const tapRush = () => {
    if (!rushActive || rushLeft <= 0) return;
    setRushScore((s) => s + 1);
  };

  const playRps = (you: RPS) => {
    const kitchen = randomRPS();
    const outcome = rpsWinner(you, kitchen);
    setRpsLast({ you, kitchen, outcome });
    if (outcome === "win") setRpsStreak((s) => s + 1);
    else if (outcome === "lose") setRpsStreak(0);
  };

  const resetGuess = () => {
    setGuessSecret(1 + Math.floor(Math.random() * 30));
    setGuessInput("");
    setGuessMsg(null);
    setGuessCount(0);
  };

  const submitGuess = () => {
    const n = parseInt(guessInput, 10);
    if (Number.isNaN(n) || n < 1 || n > 30) {
      setGuessMsg("Pick a whole number from 1 to 30.");
      return;
    }
    setGuessCount((c) => c + 1);
    if (n === guessSecret) {
      setGuessMsg(`Yes! It was ${guessSecret} in ${guessCount + 1} guess${guessCount ? "es" : ""}.`);
    } else if (n < guessSecret) {
      setGuessMsg("Higher than that.");
    } else {
      setGuessMsg("Lower than that.");
    }
  };

  const startReaction = () => {
    if (armTimerRef.current != null) window.clearTimeout(armTimerRef.current);
    setReactionPhase("arming");
    setReactionMs(null);
    const delay = 1800 + Math.random() * 4000;
    armTimerRef.current = window.setTimeout(() => {
      goTimeRef.current = performance.now();
      setReactionPhase("go");
      armTimerRef.current = null;
    }, delay);
  };

  const tapReaction = () => {
    if (reactionPhase === "early") {
      setReactionPhase("idle");
      setReactionMs(null);
      return;
    }
    if (reactionPhase === "idle" || reactionPhase === "done") {
      startReaction();
      return;
    }
    if (reactionPhase === "arming") {
      if (armTimerRef.current != null) window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
      setReactionPhase("early");
      return;
    }
    if (reactionPhase === "go") {
      setReactionMs(Math.round(performance.now() - goTimeRef.current));
      setReactionPhase("done");
    }
  };

  const resetMemory = () => {
    setMemCards(buildMemoryDeck());
    setMemFlippedIdx(null);
    setMemMoves(0);
    setMemLocked(false);
  };

  const flipMem = (idx: number) => {
    if (memLocked) return;
    const card = memCards[idx];
    if (!card || card.matched || card.flipped) return;

    const next = memCards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));

    if (memFlippedIdx === null) {
      setMemCards(next);
      setMemFlippedIdx(idx);
      return;
    }

    const first = memCards[memFlippedIdx];
    setMemMoves((m) => m + 1);
    if (first.emoji === card.emoji) {
      setMemCards(
        next.map((c, i) =>
          i === idx || i === memFlippedIdx ? { ...c, flipped: true, matched: true } : c
        )
      );
      setMemFlippedIdx(null);
    } else {
      setMemCards(next);
      setMemLocked(true);
      window.setTimeout(() => {
        setMemCards((cur) =>
          cur.map((c, i) =>
            i === idx || i === memFlippedIdx ? { ...c, flipped: c.matched } : c
          )
        );
        setMemFlippedIdx(null);
        setMemLocked(false);
      }, 650);
    }
  };

  if (!show) return null;

  const primary = orders.find((o) => KITCHEN_WAIT_STATUSES.has(o.status));
  const memDone = memCards.length > 0 && memCards.every((c) => c.matched);

  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/80 p-4 shadow-md ring-1 ring-amber-500/10"
      aria-label="Activities while you wait"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
          <ChefHat className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-stone-900">While your food is prepared</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {primary
              ? `${primary.orderNumber} is ${STATUS_WORD[primary.status] ?? "in progress"}. Pass the time below.`
              : "Your order is on the way. Here are a few things to do meanwhile."}
          </p>
        </div>
      </div>

      <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 rounded-xl bg-stone-900/5 p-1">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                tab === id
                  ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-[10rem] rounded-xl border border-stone-200/80 bg-white/90 p-4">
        {tab === "facts" && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              {FOOD_FACTS[factIndex].title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              {FOOD_FACTS[factIndex].text}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {FOOD_FACTS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Fact ${i + 1}`}
                    onClick={() => setFactIndex(i)}
                    className={`h-1.5 w-5 rounded-full transition sm:w-6 ${
                      i === factIndex ? "bg-amber-600" : "bg-stone-200 hover:bg-stone-300"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFactIndex((i) => (i + 1) % FOOD_FACTS.length)}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-800 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Next
              </button>
            </div>
          </div>
        )}

        {tab === "ttt" && (
          <div>
            <p className="text-xs text-stone-500">
              You are <span className="font-bold text-stone-800">X</span>. Beat the kitchen’s{" "}
              <span className="font-bold text-stone-800">O</span>.
            </p>
            <div className="mx-auto mt-3 grid w-[11.5rem] grid-cols-3 gap-1.5">
              {board.map((cell, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => playCell(i)}
                  disabled={!!winner(board) || !!cell}
                  className="flex aspect-square items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-xl font-bold text-stone-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cell || ""}
                </button>
              ))}
            </div>
            {tttMessage && (
              <p className="mt-3 text-center text-sm font-medium text-stone-800">{tttMessage}</p>
            )}
            <button
              type="button"
              onClick={resetTtt}
              className="mt-3 w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              New game
            </button>
          </div>
        )}

        {tab === "rush" && (
          <div className="text-center">
            <p className="text-xs text-stone-600">
              Tap as fast as you can in{" "}
              <span className="font-bold text-stone-900">10 seconds</span>.
            </p>
            <div className="mt-3 flex items-center justify-center gap-6">
              <div>
                <p className="text-2xl font-black tabular-nums text-amber-700">
                  {rushActive ? rushLeft : "—"}
                </p>
                <p className="text-[10px] font-medium uppercase text-stone-400">Time</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-stone-900">{rushScore}</p>
                <p className="text-[10px] font-medium uppercase text-stone-400">Taps</p>
              </div>
              {rushBest > 0 && (
                <div>
                  <p className="text-2xl font-black tabular-nums text-stone-500">{rushBest}</p>
                  <p className="text-[10px] font-medium uppercase text-stone-400">Best</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={rushActive && rushLeft > 0 ? tapRush : startRush}
              disabled={rushActive && rushLeft <= 0}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              {rushActive && rushLeft > 0 ? "Tap me!" : rushBest > 0 ? "Play again" : "Start"}
            </button>
          </div>
        )}

        {tab === "rps" && (
          <div>
            <p className="text-center text-xs text-stone-600">
              Beat the kitchen at rock · paper · scissors. Streak:{" "}
              <span className="font-bold text-amber-700">{rpsStreak}</span>
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {(
                [
                  ["rock", "Rock", Circle],
                  ["paper", "Paper", Square],
                  ["scissors", "Snip", Scissors],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => playRps(key)}
                  className="flex flex-1 max-w-[6.5rem] flex-col items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 py-3 text-xs font-semibold text-stone-800 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <Icon className="h-6 w-6 text-stone-600" />
                  {label}
                </button>
              ))}
            </div>
            {rpsLast && (
              <p className="mt-3 text-center text-sm text-stone-800">
                You: <span className="font-semibold capitalize">{rpsLast.you}</span> · Kitchen:{" "}
                <span className="font-semibold capitalize">{rpsLast.kitchen}</span>
                <br />
                <span className="font-bold text-amber-800">
                  {rpsLast.outcome === "win"
                    ? "You win!"
                    : rpsLast.outcome === "lose"
                      ? "Kitchen wins."
                      : "Draw — go again!"}
                </span>
              </p>
            )}
          </div>
        )}

        {tab === "guess" && (
          <div>
            <p className="text-center text-xs text-stone-600">
              I’m thinking of a number from <strong>1 to 30</strong>. How fast can you find it?
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="?"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-center text-lg font-bold text-stone-900"
              />
              <button
                type="button"
                onClick={submitGuess}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Guess
              </button>
            </div>
            {guessMsg && <p className="mt-2 text-center text-sm font-medium text-stone-800">{guessMsg}</p>}
            <button
              type="button"
              onClick={resetGuess}
              className="mt-3 w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              New number
            </button>
          </div>
        )}

        {tab === "reaction" && (
          <div className="text-center">
            <p className="text-xs text-stone-600">
              When the pad turns <span className="font-bold text-emerald-600">green</span>, tap as
              fast as you can. Don’t tap on orange!
            </p>
            <button
              type="button"
              onClick={tapReaction}
              className={`mt-4 flex h-28 w-full items-center justify-center rounded-2xl border-2 text-lg font-bold transition ${
                reactionPhase === "go"
                  ? "border-emerald-500 bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/30"
                  : reactionPhase === "arming"
                    ? "border-amber-400 bg-amber-100 text-amber-900"
                    : reactionPhase === "early"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : reactionPhase === "done" && reactionMs !== null
                        ? "border-stone-300 bg-stone-100 text-stone-800"
                        : "border-stone-200 bg-stone-50 text-stone-500"
              }`}
            >
              {reactionPhase === "idle" && "Tap to start"}
              {reactionPhase === "arming" && "Wait…"}
              {reactionPhase === "go" && "NOW!"}
              {reactionPhase === "early" && "Too soon — try again"}
              {reactionPhase === "done" && reactionMs !== null && `${reactionMs} ms`}
              {reactionPhase === "done" && reactionMs === null && "Tap to try again"}
            </button>
            {reactionPhase === "done" && reactionMs !== null && (
              <button
                type="button"
                onClick={() => {
                  setReactionPhase("idle");
                  setReactionMs(null);
                }}
                className="mt-3 text-xs font-semibold text-amber-800 underline"
              >
                Play again
              </button>
            )}
            {(reactionPhase === "early" || (reactionPhase === "done" && reactionMs === null)) && (
              <button
                type="button"
                onClick={() => {
                  setReactionPhase("idle");
                  setReactionMs(null);
                }}
                className="mt-3 text-xs font-semibold text-amber-800 underline"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {tab === "memory" && (
          <div>
            <p className="text-center text-xs text-stone-600">
              Flip two cards to find a pair. Moves:{" "}
              <span className="font-bold text-stone-900">{memMoves}</span>
              {memDone && <span className="text-emerald-700"> · All pairs found!</span>}
            </p>
            <div className="mx-auto mt-3 grid max-w-[16rem] grid-cols-4 gap-2">
              {memCards.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => flipMem(idx)}
                  disabled={c.matched || memLocked}
                  className={`flex aspect-square items-center justify-center rounded-xl border text-2xl font-medium transition active:scale-95 ${
                    c.matched
                      ? "border-emerald-300 bg-emerald-50 opacity-80"
                      : c.flipped
                        ? "border-amber-300 bg-white"
                        : "border-stone-200 bg-stone-100 text-transparent hover:bg-amber-50/50"
                  }`}
                >
                  {c.flipped || c.matched ? c.emoji : "?"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetMemory}
              className="mt-3 w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Shuffle new grid
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
