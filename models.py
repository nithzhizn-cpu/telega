
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    public_key = Column(Text, nullable=False)  # ECC public key (JWK JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    from_id = Column(Integer, index=True, nullable=False)
    to_id = Column(Integer, index=True, nullable=False)
    iv = Column(Text, nullable=False)
    ciphertext = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
