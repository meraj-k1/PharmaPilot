
"""Restore conversations and conversation messages.

Revision ID: a555dadaa55d
Revises: 69155eb6771f
Create Date: 2026-11-22

Restores conversation tables accidentally removed
by migration 22e8000b6c49.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# ============================================
# ALEMBIC REVISION INFORMATION
# ============================================

revision: str = "a555dadaa55d"

down_revision: str | Sequence[str] | None = (
    "69155eb6771f"
)

branch_labels: str | Sequence[str] | None = None

depends_on: str | Sequence[str] | None = None


# ============================================
# UPGRADE
# ============================================

def upgrade() -> None:
    """Create conversations and conversation messages."""

    # ----------------------------------------
    # CONVERSATIONS TABLE
    # ----------------------------------------

    op.create_table(
        "conversations",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "pharmacy_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "owner_user_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(length=150),
            nullable=False,
        ),

        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.CheckConstraint(
            "version >= 0",
            name="ck_conversation_version",
        ),

        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
        ),

        sa.ForeignKeyConstraint(
            ["pharmacy_id"],
            ["pharmacies.id"],
        ),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint(
            "id",
            "pharmacy_id",
            name="uq_conversation_id_pharmacy",
        ),
    )

    # Conversations indexes

    op.create_index(
        op.f("ix_conversations_owner_user_id"),
        "conversations",
        ["owner_user_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_conversations_pharmacy_id"),
        "conversations",
        ["pharmacy_id"],
        unique=False,
    )

    # ----------------------------------------
    # CONVERSATION MESSAGES TABLE
    # ----------------------------------------

    op.create_table(
        "conversation_messages",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "pharmacy_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "conversation_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "sequence",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "role",
            sa.String(length=10),
            nullable=False,
        ),

        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.CheckConstraint(
            "role IN ('user', 'model')",
            name="ck_conversation_message_role",
        ),

        sa.ForeignKeyConstraint(
            ["conversation_id", "pharmacy_id"],
            [
                "conversations.id",
                "conversations.pharmacy_id",
            ],
            name="fk_message_conversation_tenant",
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint(
            "conversation_id",
            "sequence",
            name="uq_conversation_message_sequence",
        ),
    )

    # Conversation messages indexes

    op.create_index(
        op.f("ix_conversation_messages_conversation_id"),
        "conversation_messages",
        ["conversation_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_conversation_messages_pharmacy_id"),
        "conversation_messages",
        ["pharmacy_id"],
        unique=False,
    )


# ============================================
# DOWNGRADE
# ============================================

def downgrade() -> None:
    """Drop restored conversation tables."""

    # Drop message indexes

    op.drop_index(
        op.f("ix_conversation_messages_pharmacy_id"),
        table_name="conversation_messages",
    )

    op.drop_index(
        op.f("ix_conversation_messages_conversation_id"),
        table_name="conversation_messages",
    )

    # Drop message table first
    op.drop_table("conversation_messages")

    # Drop conversation indexes

    op.drop_index(
        op.f("ix_conversations_pharmacy_id"),
        table_name="conversations",
    )

    op.drop_index(
        op.f("ix_conversations_owner_user_id"),
        table_name="conversations",
    )

    # Drop conversations table
    op.drop_table("conversations")
