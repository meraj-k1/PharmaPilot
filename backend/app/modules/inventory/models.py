import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MedicineBatch(Base):
    __tablename__ = "medicine_batches"

    __table_args__ = (
        ForeignKeyConstraint(
            ["medicine_id", "pharmacy_id"],
            ["medicines.id", "medicines.pharmacy_id"],
            name="fk_batch_medicine_tenant",
        ),
        UniqueConstraint(
            "pharmacy_id",
            "medicine_id",
            "batch_number",
            name="uq_batch_identity",
        ),
        UniqueConstraint(
            "id",
            "pharmacy_id",
            name="uq_batch_id_pharmacy",
        ),
        CheckConstraint(
            "quantity_on_hand >= 0",
            name="ck_batch_nonnegative_stock",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_batch_nonnegative_cost",
        ),
        CheckConstraint(
            "manufactured_at IS NULL OR manufactured_at < expires_at",
            name="ck_batch_valid_dates",
        ),
        Index(
            "ix_batch_pharmacy_expiry",
            "pharmacy_id",
            "expires_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    pharmacy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pharmacies.id"),
        nullable=False,
        index=True,
    )

    medicine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    batch_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    manufactured_at: Mapped[date | None] = mapped_column(
        Date,
    )

    expires_at: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    quantity_on_hand: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class StockMovement(Base):
    __tablename__ = "stock_movements"

    __table_args__ = (
        ForeignKeyConstraint(
            ["batch_id", "pharmacy_id"],
            ["medicine_batches.id", "medicine_batches.pharmacy_id"],
            name="fk_movement_batch_tenant",
        ),
        ForeignKeyConstraint(
            ["purchase_order_item_id", "pharmacy_id"],
            [
                "purchase_order_items.id",
                "purchase_order_items.pharmacy_id",
            ],
            name="fk_movement_purchase_item_tenant",
        ),
        CheckConstraint(
            "quantity_delta <> 0",
            name="ck_movement_nonzero",
        ),
        CheckConstraint(
            "quantity_before >= 0 AND quantity_after >= 0",
            name="ck_movement_quantities",
        ),
        CheckConstraint(
            "quantity_after = quantity_before + quantity_delta",
            name="ck_movement_balance",
        ),
        CheckConstraint(
            "movement_type IN ('purchase_receipt', 'adjustment')",
            name="ck_movement_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    pharmacy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pharmacies.id"),
        nullable=False,
        index=True,
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    purchase_order_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
    )

    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    movement_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    quantity_delta: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    quantity_before: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    quantity_after: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
