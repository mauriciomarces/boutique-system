def __getattr__(name):
    if name == "app":
        from app.main import app

        return app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

if __name__ == "__main__":
    import uvicorn
    from app.main import app
    from app.config import AI_PORT

    uvicorn.run(app, host="0.0.0.0", port=AI_PORT)
