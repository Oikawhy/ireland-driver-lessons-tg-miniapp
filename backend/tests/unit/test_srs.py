"""
Unit tests for the FSRS-Lite SRS algorithm.
Tests are pure logic — no DB or network needed.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from srs import SRSCard, process_correct, process_wrong, is_mastered, clamp, compute_due_date
from datetime import datetime, timezone


def test_clamp():
    assert clamp(5.0, 1.0, 10.0) == 5.0
    assert clamp(0.0, 1.0, 10.0) == 1.0
    assert clamp(15.0, 1.0, 10.0) == 10.0
    assert clamp(-5.0, 0.0, 1.0) == 0.0
    print("  ✅ test_clamp passed")


def test_new_card_defaults():
    card = SRSCard()
    assert card.stability == 0.4
    assert card.difficulty == 5.0
    assert card.interval_days == 0
    assert card.repetitions == 0
    assert card.lapses == 0
    print("  ✅ test_new_card_defaults passed")


def test_process_wrong():
    card = SRSCard(stability=2.0, difficulty=5.0, interval_days=10.0, repetitions=3, lapses=1)
    updated = process_wrong(card)

    # Stability should halve
    assert updated.stability == 1.0
    # Difficulty should increase by 0.5
    assert updated.difficulty == 5.5
    # Interval should reset to 1
    assert updated.interval_days == 1.0
    # Lapses should increment
    assert updated.lapses == 2
    # Repetitions unchanged
    assert updated.repetitions == 3
    print("  ✅ test_process_wrong passed")


def test_process_wrong_difficulty_cap():
    card = SRSCard(difficulty=9.8)
    updated = process_wrong(card)
    assert updated.difficulty == 10.0  # capped at 10
    print("  ✅ test_process_wrong_difficulty_cap passed")


def test_process_correct():
    card = SRSCard(stability=1.0, difficulty=5.0, interval_days=1.0, repetitions=0, lapses=0)
    updated = process_correct(card)

    # Difficulty decreases by 0.3
    assert updated.difficulty == 4.7

    # Stability grows: 1.0 * (1 + 0.5 * (11 - 4.7)) = 1.0 * 4.15 = 4.15
    assert abs(updated.stability - 4.15) < 0.01

    # Interval = stability * 0.9 = 4.15 * 0.9 = 3.735
    assert abs(updated.interval_days - 3.735) < 0.01

    # Repetitions increment
    assert updated.repetitions == 1
    assert updated.lapses == 0
    print("  ✅ test_process_correct passed")


def test_process_correct_minimum_interval():
    card = SRSCard(stability=0.1, difficulty=9.5)
    updated = process_correct(card)
    # Even with tiny stability, interval should be at least 1.0
    assert updated.interval_days >= 1.0
    print("  ✅ test_process_correct_minimum_interval passed")


def test_is_mastered():
    assert not is_mastered(SRSCard(interval_days=0))
    assert not is_mastered(SRSCard(interval_days=29.9))
    assert is_mastered(SRSCard(interval_days=30.0))
    assert is_mastered(SRSCard(interval_days=60.0))
    print("  ✅ test_is_mastered passed")


def test_correct_sequence_reaches_mastery():
    """Simulating multiple correct answers should eventually reach mastery."""
    card = SRSCard()
    for _ in range(20):
        card = process_correct(card)

    assert is_mastered(card), f"Expected mastered after 20 correct, got interval={card.interval_days:.1f}"
    print(f"  ✅ test_correct_sequence_reaches_mastery passed (interval={card.interval_days:.1f} days)")


def test_wrong_then_correct_recovery():
    """After a wrong answer, correct answers should recover the card."""
    card = SRSCard(stability=5.0, difficulty=3.0, interval_days=20.0, repetitions=5)
    # Wrong answer
    card = process_wrong(card)
    assert card.interval_days == 1.0
    assert card.lapses == 1

    # Several correct answers to recover
    for _ in range(5):
        card = process_correct(card)

    assert card.interval_days > 10.0, f"Expected recovery, got interval={card.interval_days:.1f}"
    print(f"  ✅ test_wrong_then_correct_recovery passed (interval={card.interval_days:.1f} days)")


def test_compute_due_date():
    now = datetime(2024, 1, 1, tzinfo=timezone.utc)
    card = SRSCard(interval_days=7.0)
    due = compute_due_date(card, from_date=now)
    assert due.day == 8
    assert due.month == 1
    print("  ✅ test_compute_due_date passed")


if __name__ == "__main__":
    print("Running SRS unit tests...")
    test_clamp()
    test_new_card_defaults()
    test_process_wrong()
    test_process_wrong_difficulty_cap()
    test_process_correct()
    test_process_correct_minimum_interval()
    test_is_mastered()
    test_correct_sequence_reaches_mastery()
    test_wrong_then_correct_recovery()
    test_compute_due_date()
    print("\n✅ All SRS tests passed!")
