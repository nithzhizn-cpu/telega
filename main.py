
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import Base, engine
from .routes.users import router as users_router
from .routes.messages import router as messages_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SpySignal v2 Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# static files (frontend)
app.mount("/static", StaticFiles(directory="../static"), name="static")


@app.get("/")
def index():
    return FileResponse("../static/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(users_router)
app.include_router(messages_router)
