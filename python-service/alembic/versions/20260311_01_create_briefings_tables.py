"""Create briefing-related tables.

Revision ID: 20260311_create_briefings_tables
Revises: None
Create Date: 2026-03-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260311_create_briefings_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "briefings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("sector", sa.String(length=255), nullable=True),
        sa.Column("analyst_name", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column(
            "is_generated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "ticker = upper(ticker)",
            name="ck_briefings_ticker_upper",
        ),
    )

    op.create_table(
        "briefing_points",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("briefing_id", sa.Integer(), nullable=False),
        sa.Column("point_text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["briefing_id"],
            ["briefings.id"],
            ondelete="CASCADE",
            name="fk_briefing_points_briefing_id_briefings",
        ),
    )
    op.create_index(
        "ix_briefing_points_briefing_id",
        "briefing_points",
        ["briefing_id"],
    )

    op.create_table(
        "briefing_risks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("briefing_id", sa.Integer(), nullable=False),
        sa.Column("risk_text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["briefing_id"],
            ["briefings.id"],
            ondelete="CASCADE",
            name="fk_briefing_risks_briefing_id_briefings",
        ),
    )
    op.create_index(
        "ix_briefing_risks_briefing_id",
        "briefing_risks",
        ["briefing_id"],
    )

    op.create_table(
        "briefing_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("briefing_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ["briefing_id"],
            ["briefings.id"],
            ondelete="CASCADE",
            name="fk_briefing_metrics_briefing_id_briefings",
        ),
        sa.UniqueConstraint(
            "briefing_id",
            "name",
            name="uq_briefing_metrics_briefing_id_name",
        ),
    )
    op.create_index(
        "ix_briefing_metrics_briefing_id",
        "briefing_metrics",
        ["briefing_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_briefing_metrics_briefing_id", table_name="briefing_metrics")
    op.drop_table("briefing_metrics")

    op.drop_index("ix_briefing_risks_briefing_id", table_name="briefing_risks")
    op.drop_table("briefing_risks")

    op.drop_index("ix_briefing_points_briefing_id", table_name="briefing_points")
    op.drop_table("briefing_points")

    op.drop_table("briefings")

