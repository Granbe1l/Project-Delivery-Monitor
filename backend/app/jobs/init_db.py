from app.db.session import Session
from app.services.sync import ensure_repositories

if __name__ == "__main__":
    with Session() as db:
        ensure_repositories(db)
    print("Configured public repository identities initialized; no GitHub metrics inserted.")
