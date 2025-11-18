
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import SessionLocal
from ..models import Message
from ..schemas import MessageIn, MessageOut

router = APIRouter(prefix="/api/messages", tags=["messages"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MessageOut)
def send_message(payload: MessageIn, db: Session = Depends(get_db)):
    msg = Message(
        from_id=payload.from_id,
        to_id=payload.to_id,
        iv=payload.iv,
        ciphertext=payload.ciphertext,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/history", response_model=List[MessageOut])
def get_history(user_id: int, peer_id: int, db: Session = Depends(get_db)):
    msgs = (
        db.query(Message)
        .filter(
            ((Message.from_id == user_id) & (Message.to_id == peer_id))
            | ((Message.from_id == peer_id) & (Message.to_id == user_id))
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    return msgs
