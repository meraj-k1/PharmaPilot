import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Medicine(Base):
    __tablename__ = "medicines"

    __table_args__ = (
        UniqueConstraint("pharmacy_id", "sku", name="uq_medicine_pharmacy_sku"),
        UniqueConstraint("id", "pharmacy_id", name="uq_medicine_id_pharmacy"),
        CheckConstraint(
            "reorder_level >= 0",
            name="ck_medicine_recorder",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    pharmacy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    sku: Mapped[str] = mapped_column(String(80), nullable=False)

    brand_name: Mapped[str] = mapped_column(String(200), nullable=False)

    generic_name: Mapped[str] = mapped_column(String(200), nullable=False)

    strength: Mapped[str] = mapped_column(String(80), nullable=False)

    dosage_form: Mapped[str | None] = mapped_column(String(50), nullable=True)

    manufacturer: Mapped[str | None] = mapped_column(
        String(200),
    )

    barcode: Mapped[str | None] = mapped_column(
        String(100),
    )

    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    reorder_level: Mapped[int] = mapped_column(
        default=10,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
