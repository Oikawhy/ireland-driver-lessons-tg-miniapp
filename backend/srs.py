"""
FSRS-Lite — Spaced Repetition Algorithm

Simplified FSRS-inspired algorithm for binary quiz feedback (right/wrong).
Each wrongly-answered question becomes an SRS "card" with:
  - stability: days until ~90% chance of forgetting
  - difficulty: 1 (easy) to 10 (hard), affects stability growth

Algorithm:
  WRONG answer (any mode):
    new card → stability=0.4, difficulty=5.0, interval=0
    existing → lapses++, stability *= 0.5, interval = 1 day
    due_date = NOW

  CORRECT answer (in Incorrect Test mode):
    repetitions++
    difficulty = clamp(difficulty - 0.3, 1, 10)
    stability = stability × (1 + 0.5 × (11 - difficulty))
    interval = stability × 0.9
    due_date = NOW + interval days

  Mastered = interval ≥ 30 days
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class SRSCard:
    stability: float = 0.4
    difficulty: float = 5.0
    interval_days: float = 0
    repetitions: int = 0
    lapses: int = 0


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, value))


def process_wrong(card: SRSCard) -> SRSCard:
    """Process a wrong answer — reset interval, increase lapses."""
    return SRSCard(
        stability=card.stability * 0.5,
        difficulty=clamp(card.difficulty + 0.5, 1.0, 10.0),
        interval_days=1.0,
        repetitions=card.repetitions,
        lapses=card.lapses + 1,
    )


def process_correct(card: SRSCard) -> SRSCard:
    """Process a correct answer — grow interval based on stability and difficulty."""
    new_difficulty = clamp(card.difficulty - 0.3, 1.0, 10.0)

    # Stability grows faster for easier cards
    growth_factor = 1 + 0.5 * (11 - new_difficulty)
    new_stability = card.stability * growth_factor

    # Interval targets ~90% retention
    new_interval = new_stability * 0.9

    # Minimum interval of 1 day
    new_interval = max(new_interval, 1.0)

    return SRSCard(
        stability=new_stability,
        difficulty=new_difficulty,
        interval_days=new_interval,
        repetitions=card.repetitions + 1,
        lapses=card.lapses,
    )


def is_mastered(card: SRSCard) -> bool:
    """Card is considered mastered when interval reaches 30+ days."""
    return card.interval_days >= 30.0


def compute_due_date(card: SRSCard, from_date: datetime | None = None) -> datetime:
    """Calculate the next due date based on the card's interval."""
    base = from_date or datetime.now(timezone.utc)
    return base + timedelta(days=card.interval_days)
