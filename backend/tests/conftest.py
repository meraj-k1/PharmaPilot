import os

os.environ["APP_ENV"] = "test"

os.environ["JWT_SECRET_KEY"] = "pharmapilot-test-secret-with-more-than-32-characters"

os.environ["JWT_ALGORITHM"] = "HS256"

os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
