import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    __table_args__ = (
        ForeignKeyConstraint(
            ["supplier_id", "pharmacy_id"],
            ["suppliers.id", "suppliers.pharmacy_id"],
            name="fk_purchase_supplier_tenant",
        ),
        UniqueConstraint(
            "pharmacy_id",
            "order_number",
            name="uq_purchase_number",
        ),
        UniqueConstraint(
            "id",
            "pharmacy_id",
            name="uq_purchase_id_pharmacy",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_purchase_total",
        ),
        CheckConstraint(
            "status IN ('draft', 'received')",
            name="ck_purchase_status",
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

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    order_number: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    received_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
    )

    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    __table_args__ = (
        ForeignKeyConstraint(
            ["purchase_order_id", "pharmacy_id"],
            ["purchase_orders.id", "purchase_orders.pharmacy_id"],
            name="fk_item_order_tenant",
        ),
        ForeignKeyConstraint(
            ["medicine_id", "pharmacy_id"],
            ["medicines.id", "medicines.pharmacy_id"],
            name="fk_item_medicine_tenant",
        ),
        UniqueConstraint(
            "id",
            "pharmacy_id",
            name="uq_purchase_item_id_pharmacy",
        ),
        UniqueConstraint(
            "purchase_order_id",
            "medicine_id",
            name="uq_purchase_item_medicine",
        ),
        CheckConstraint(
            "quantity > 0",
            name="ck_purchase_item_quantity",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_purchase_item_cost",
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
    )

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    medicine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
