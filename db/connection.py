import mariadb
import config

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = mariadb.ConnectionPool(
            host=config.DB_HOST,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            pool_name="sem_pool",
            pool_size=5
        )
    return _pool

def get_connection():
    return get_pool().get_connection()