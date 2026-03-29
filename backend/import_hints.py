"""Import hints from explanations_for_user.json into the questions table.

Run inside backend container:
  docker exec testdrive-backend-1 python import_hints.py
"""
import asyncio
import json
import os
import sys

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
JSON_PATH = os.path.join(os.path.dirname(__file__), "explanations_for_user.json")


async def main():
    with open(JSON_PATH, "r") as f:
        data = json.load(f)

    conn = await asyncpg.connect(DATABASE_URL)

    # Count existing hints
    existing = await conn.fetchval("SELECT COUNT(*) FROM questions WHERE hint IS NOT NULL")
    total_q = await conn.fetchval("SELECT COUNT(*) FROM questions")
    print(f"Before import: {existing}/{total_q} questions have hints")

    updated = 0
    skipped = 0

    for source_id_str, entry in data.items():
        source_id = int(source_id_str)
        hint = entry.get("hint", "").strip()
        if not hint:
            skipped += 1
            continue

        result = await conn.execute(
            "UPDATE questions SET hint = $1 WHERE source_id = $2 AND (hint IS NULL OR hint = '')",
            hint, source_id,
        )
        # asyncpg returns 'UPDATE N'
        if result.endswith("1"):
            updated += 1

    # Verify
    after = await conn.fetchval("SELECT COUNT(*) FROM questions WHERE hint IS NOT NULL")
    await conn.close()

    print(f"Updated: {updated}")
    print(f"Skipped (empty hint): {skipped}")
    print(f"After import: {after}/{total_q} questions have hints")

    if after == 0:
        print("\n❌ No hints imported! Check JSON file.")
        sys.exit(1)

    print("\n✅ Hints imported successfully!")


asyncio.run(main())
