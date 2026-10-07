from app.main import app

if __name__ == "__main__":
    import uvicorn
    from app.config import AI_PORT

    uvicorn.run(app, host="0.0.0.0", port=AI_PORT)
