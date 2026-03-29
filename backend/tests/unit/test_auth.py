"""
Unit tests for Telegram initData validation and JWT.
Uses synthetic test data — no real Telegram or DB needed.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import hmac
import hashlib
import json
import time
from urllib.parse import urlencode, quote

from auth import validate_init_data, create_jwt, decode_jwt


TEST_BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


def _make_init_data(user_data: dict, bot_token: str = TEST_BOT_TOKEN) -> str:
    """Create valid Telegram initData with proper HMAC signature."""
    auth_date = str(int(time.time()))
    user_json = json.dumps(user_data, separators=(",", ":"))

    params = {
        "user": user_json,
        "auth_date": auth_date,
    }

    # Build data-check-string
    data_check_parts = []
    for key in sorted(params.keys()):
        data_check_parts.append(f"{key}={params[key]}")
    data_check_string = "\n".join(data_check_parts)

    # Compute HMAC
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    params["hash"] = computed_hash
    return urlencode(params)


def test_validate_valid_data():
    user = {"id": 12345, "first_name": "Test", "username": "testuser"}
    init_data = _make_init_data(user)
    result = validate_init_data(init_data, bot_token=TEST_BOT_TOKEN)
    assert result["id"] == 12345
    assert result["first_name"] == "Test"
    assert result["username"] == "testuser"
    print("  ✅ test_validate_valid_data passed")


def test_validate_invalid_hash():
    user = {"id": 12345, "first_name": "Test"}
    init_data = _make_init_data(user)
    # Tamper with the hash
    init_data = init_data.replace(init_data[-10:], "0000000000")
    try:
        validate_init_data(init_data, bot_token=TEST_BOT_TOKEN)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Invalid" in str(e) or "signature" in str(e).lower()
    print("  ✅ test_validate_invalid_hash passed")


def test_validate_missing_hash():
    try:
        validate_init_data("user={}&auth_date=123", bot_token=TEST_BOT_TOKEN)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "hash" in str(e).lower()
    print("  ✅ test_validate_missing_hash passed")


def test_validate_wrong_bot_token():
    user = {"id": 12345, "first_name": "Test"}
    init_data = _make_init_data(user, bot_token=TEST_BOT_TOKEN)
    try:
        validate_init_data(init_data, bot_token="wrong:token")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    print("  ✅ test_validate_wrong_bot_token passed")


def test_jwt_roundtrip():
    secret = "test-secret"
    token = create_jwt(user_id=12345, db_user_id=1, secret=secret)
    payload = decode_jwt(token, secret=secret)
    assert payload["telegram_id"] == 12345
    assert payload["user_id"] == 1
    print("  ✅ test_jwt_roundtrip passed")


def test_jwt_invalid_token():
    try:
        decode_jwt("invalid.jwt.token", secret="test-secret")
        assert False, "Should have raised"
    except Exception:
        pass
    print("  ✅ test_jwt_invalid_token passed")


if __name__ == "__main__":
    print("Running auth unit tests...")
    test_validate_valid_data()
    test_validate_invalid_hash()
    test_validate_missing_hash()
    test_validate_wrong_bot_token()
    test_jwt_roundtrip()
    test_jwt_invalid_token()
    print("\n✅ All auth tests passed!")
