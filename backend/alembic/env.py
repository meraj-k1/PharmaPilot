
import asyncio
from logging.config import fileConfig

from alembic import context

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.db.base import Base

# =========================================================
# IMPORT ALL SQLALCHEMY MODELS
# Required for Alembic autogenerate and foreign key mapping.
# =========================================================

# Authentication / Identity
from app.modules.auth.models import (  # noqa: F401
    PharmacyMembership,
    Role,
    User,
)

# Pharmacies
from app.modules.pharmacies.models import (  # noqa: F401
    Pharmacy,
)

# Medicines
from app.modules.medicines.models import (  # noqa: F401
    Medicine,
)

# Suppliers
from app.modules.suppliers.models import (  # noqa: F401
    Supplier,
)

# Purchases
from app.modules.purchases import models as purchase_models  # noqa: F401

# Inventory
from app.modules.inventory.models import (  # noqa: F401
    MedicineBatch,
    StockMovement,
)

# AI Conversations
from app.modules.conversations import models as conversation_models  # noqa: F401

# Pharmacy Knowledge / RAG
# Import its models too, so Alembic does not interpret
# existing knowledge tables as tables to be removed.
from app.modules.knowledge import models as knowledge_models  # noqa: F401


# =========================================================
# ALEMBIC CONFIGURATION
# =========================================================

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


settings = get_settings()

config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%"),
)

target_metadata = Base.metadata


# =========================================================
# OFFLINE MIGRATIONS
# =========================================================

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# =========================================================
# MIGRATION EXECUTION
# =========================================================

def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# =========================================================
# ASYNC DATABASE MIGRATIONS
# =========================================================

async def run_async_migrations() -> None:
    configuration = config.get_section(
        config.config_ini_section,
        {},
    )

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
    finally:
        await connectable.dispose()


# =========================================================
# ONLINE MIGRATIONS
# =========================================================

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# =========================================================
# ENTRY POINT
# =========================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
