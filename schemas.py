
from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    public_key: str  # JWK JSON string


class UserOut(BaseModel):
    id: int
    username: str
    public_key: str

    class Config:
        from_attributes = True


class MessageIn(BaseModel):
    from_id: int
    to_id: int
    iv: str
    ciphertext: str


class MessageOut(BaseModel):
    id: int
    from_id: int
    to_id: int
    iv: str
    ciphertext: str
    created_at: datetime

    class Config:
        from_attributes = True
