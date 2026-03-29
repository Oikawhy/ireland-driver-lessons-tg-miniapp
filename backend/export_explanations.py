"""Export all question explanations as JSON for user to edit hints."""
import asyncio, json, os, sys
sys.path.insert(0, "/app")
import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    rows = await conn.fetch(
        "SELECT source_id, explanation FROM questions WHERE explanation IS NOT NULL ORDER BY source_id"
    )
    data = {}
    for r in rows:
        data[str(r["source_id"])] = {
            "explanation": r["explanation"],
            "hint": ""
        }
    with open("/app/explanations_for_user.json", "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Exported {len(data)} explanations to /app/explanations_for_user.json")

    # Also add discarded enum value
    try:
        await conn.execute("ALTER TYPE test_status ADD VALUE IF NOT EXISTS 'discarded'")
        print("Added 'discarded' to test_status enum")
    except Exception as e:
        print(f"Enum: {e}")

    await conn.close()

asyncio.run(main())
