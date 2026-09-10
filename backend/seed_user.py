import uuid
from sqlalchemy import text
from app.db.session import engine

officer_id = "1d537368-0376-4d52-bca0-2badc97f3f8a"
with engine.connect() as conn:
    # Check if user exists
    res = conn.execute(text("SELECT id FROM users WHERE id = :id"), {"id": officer_id}).scalar()
    if not res:
        conn.execute(
            text("INSERT INTO users (id, email, full_name, role, is_active, created_at) VALUES (:id, 'admin@example.com', 'Admin', 'officer', true, now())"),
            {"id": officer_id}
        )
        conn.commit()
        print(f"Created user {officer_id}")
    else:
        print(f"User {officer_id} already exists")
