from __future__ import annotations

import json
from typing import Any


def get_server_information() -> dict[str, Any]:
    return {
        "name": "PharmaPilot",
        "type": "pharmacy_operations_mcp_server",
        "version": "1.0.0",
        "capabilities": {
            "tools": [
                "search_medicines",
                "get_low_stock_medicines",
                "get_expiring_batches",
                "search_pharmacy_knowledge",
            ],
            "resources": [
                "pharmapilot://server/info",
            ],
            "prompts": [
                "pharmacy_inventory_analysis",
                "pharmacy_knowledge_qa",
            ],
        },
        "security": {
            "tenant_isolation": True,
            "read_only_tools": True,
            "authentication_required_for_http": True,
        },
        "description": (
            "PharmaPilot provides authenticated pharmacy "
            "operations and knowledge retrieval through MCP."
        ),
    }


def server_information_json() -> str:
    return json.dumps(
        get_server_information(),
        indent=2,
        ensure_ascii=False,
    )
