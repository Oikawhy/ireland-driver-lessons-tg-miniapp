"""
Pydantic models — request/response schemas for the API.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ─── Auth ────────────────────────────────────────────

class AuthRequest(BaseModel):
    init_data: str


class AuthResponse(BaseModel):
    token: str
    user_id: int
    telegram_id: int
    first_name: Optional[str] = None


# ─── Questions & Answers ─────────────────────────────

class AnswerOut(BaseModel):
    id: int
    answer_text: str
    is_correct: Optional[bool] = None  # hidden during active quiz


class QuestionOut(BaseModel):
    id: int
    source_id: int
    question_text: str
    explanation: Optional[str] = None  # hidden during exam
    hint: Optional[str] = None
    image_filename: Optional[str] = None
    category_name: Optional[str] = None
    category_id: Optional[int] = None
    answers: list[AnswerOut] = []
    user_answer_id: Optional[int] = None
    user_correct: Optional[bool] = None


# ─── Categories ──────────────────────────────────────

class CategoryOut(BaseModel):
    id: int
    name: str
    question_count: int = 0
    accuracy: Optional[float] = None  # percentage, None if not attempted


# ─── Sessions ────────────────────────────────────────

class SessionCreateRequest(BaseModel):
    test_type: str  # 'exam', 'marathon', 'incorrect', 'category'
    category_id: Optional[int] = None
    time_limit_sec: Optional[int] = None


class SessionOut(BaseModel):
    id: int
    test_type: str
    status: str
    total_questions: int
    correct_count: int = 0
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    time_limit_sec: Optional[int] = None
    questions: list[QuestionOut] = []


class AnswerSubmitRequest(BaseModel):
    question_id: int
    answer_id: int


class AnswerSubmitResponse(BaseModel):
    is_correct: bool
    correct_answer_id: int
    explanation: Optional[str] = None


class SessionResultsOut(BaseModel):
    id: int
    test_type: str
    status: str
    total_questions: int
    correct_count: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    passed: Optional[bool] = None  # for exam mode
    questions: list[QuestionOut] = []


# ─── SRS ─────────────────────────────────────────────

class SRSCardOut(BaseModel):
    id: int
    question_id: int
    stability: float
    difficulty: float
    interval_days: float
    due_date: datetime
    repetitions: int
    lapses: int
    question: Optional[QuestionOut] = None


class SRSReviewRequest(BaseModel):
    question_id: int
    is_correct: bool


# ─── Stats ───────────────────────────────────────────

class DashboardStats(BaseModel):
    total_questions: int = 805
    exams_taken: int = 0
    exams_passed: int = 0
    pass_rate: Optional[float] = None
    mastered_count: int = 0
    due_today: int = 0
    overall_accuracy: Optional[float] = None


class CategoryStats(BaseModel):
    id: int
    name: str
    question_count: int
    attempted: int
    correct: int
    accuracy: Optional[float] = None


# ─── Settings ────────────────────────────────────────

class UserSettings(BaseModel):
    marathon_auto_next: int = 0
    theme: str = "auto"
    haptic_feedback: bool = True
    exam_time_limit: int = 2400
    language: str = "en"


# ─── Bookmarks ───────────────────────────────────────

class BookmarkCreate(BaseModel):
    question_id: int


class BookmarkOut(BaseModel):
    id: int
    question_id: int
    created_at: Optional[datetime] = None
    question: Optional[QuestionOut] = None
