from app import app, run_startup_graph_sync_once

if __name__ == "__main__":
    run_startup_graph_sync_once()
    app.run()
