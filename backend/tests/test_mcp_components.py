import json

import pytest

from app.integrations.mcp.prompts import (
    pharmacy_inventory_analysis_prompt,
    pharmacy_knowledge_qa_prompt,
)
from app.integrations.mcp.resources import (
    get_server_information,
    server_information_json,
)
from app.integrations.mcp.server import mcp


def test_server_information():
    info = get_server_information()

    assert info["name"] == "PharmaPilot"
    assert info["security"]["tenant_isolation"] is True

    assert "search_pharmacy_knowledge" in info["capabilities"]["tools"]


def test_resource_is_valid_json():
    result = json.loads(server_information_json())

    assert result["name"] == "PharmaPilot"


def test_inventory_prompt():
    result = pharmacy_inventory_analysis_prompt("expiring batches")

    assert "expiring batches" in result
    assert "authenticated pharmacy" in result


def test_knowledge_prompt():
    result = pharmacy_knowledge_qa_prompt("What do our documents say about storage?")

    assert "search_pharmacy_knowledge" in result
    assert "storage?" in result


def test_empty_knowledge_question_rejected():
    with pytest.raises(ValueError):
        pharmacy_knowledge_qa_prompt("")


@pytest.mark.asyncio
async def test_mcp_registration():
    tools = await mcp.list_tools()
    resources = await mcp.list_resources()
    prompts = await mcp.list_prompts()

    tool_names = {tool.name for tool in tools}
    resource_uris = {str(resource.uri) for resource in resources}
    prompt_names = {prompt.name for prompt in prompts}

    assert "search_medicines" in tool_names
    assert "get_low_stock_medicines" in tool_names
    assert "get_expiring_batches" in tool_names
    assert "search_pharmacy_knowledge" in tool_names

    assert "pharmapilot://server/info" in resource_uris

    assert "pharmacy_inventory_analysis" in prompt_names

    assert "pharmacy_knowledge_qa" in prompt_names
