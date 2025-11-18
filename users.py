
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import User
from ..schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register", response_model=UserOut)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        # update public key if changed
        if existing.public_key != payload.public_key:
            existing.public_key = payload.public_key
            db.commit()
            db.refresh(existing)
        return existing

    user = User(username=username, public_key=payload.public_key)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/search", response_model=list[UserOut])
def search_users(q: str, db: Session = Depends(get_db)):
    query = q.strip()
    if not query:
        return []
    users = db.query(User).filter(User.username.ilike(f"%{query}%")).all()
    return users


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
