
from dataclasses import dataclass
from uuid import UUID

from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools.pharmacy_tools import PharmacyToolExecutor
from app.core.config import get_settings
from app.core.exceptions.base import AppException
from app.integrations.llm.gemini import GeminiService


@dataclass
class AgentResult:
    answer: str
    tools_used: list[dict]


class PharmaPilotAgent:
    MAX_TOOL_CALLS_PER_ROUND = 5

    def __init__(
        self,
        db: AsyncSession,
        pharmacy_id: UUID,
    ):
        self.settings = get_settings()
        self.llm = GeminiService()

        self.tools = PharmacyToolExecutor(
            db=db,
            pharmacy_id=pharmacy_id,
        )

    async def run(
        self,
        history: list[dict],
        message: str,
    ) -> AgentResult:

        contents: list[types.Content] = []

        # Restore previous conversation messages.
        for item in history:
            role = item.get("role")
            content = item.get("content", "")

            # Gemini Content accepts user/model roles.
            if role == "assistant":
                role = "model"

            if role not in ("user", "model"):
                continue

            if not isinstance(content, str) or not content.strip():
                continue

            contents.append(
                types.Content(
                    role=role,
                    parts=[
                        types.Part.from_text(
                            text=content
                        )
                    ],
                )
            )

        # Add the new user message.
        contents.append(
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=message
                    )
                ],
            )
        )

        tools_used: list[dict] = []

        # Limit the total number of tool-calling rounds.
        for _ in range(self.settings.AI_MAX_TOOL_ROUNDS):

            response = await self.llm.generate(contents)

            calls = response.function_calls or []

            # Return final response when no tools are requested.
            if not calls:
                answer = response.text

                if not answer or not answer.strip():
                    raise AppException(
                        message="AI returned no usable answer.",
                        status_code=502,
                        error_code="AI_EMPTY_RESPONSE",
                    )

                return AgentResult(
                    answer=answer.strip(),
                    tools_used=tools_used,
                )

            # Reject excessive tool calls before execution.
            if len(calls) > self.MAX_TOOL_CALLS_PER_ROUND:
                raise AppException(
                    message=(
                        "AI requested too many tool calls "
                        "in a single round."
                    ),
                    status_code=502,
                    error_code="AI_TOOL_LIMIT",
                )

            # Preserve the actual Gemini function-call content.
            if not response.candidates:
                raise AppException(
                    message="Invalid AI tool response.",
                    status_code=502,
                    error_code="AI_INVALID_RESPONSE",
                )

            model_content = response.candidates[0].content

            if model_content is None:
                raise AppException(
                    message="Invalid AI tool response.",
                    status_code=502,
                    error_code="AI_INVALID_RESPONSE",
                )

            contents.append(model_content)

            function_parts: list[types.Part] = []

            # Execute every model-requested function.
            for call in calls:

                name = call.name or ""
                arguments = dict(call.args or {})

                if not name:
                    raise AppException(
                        message="AI requested a tool without a name.",
                        status_code=502,
                        error_code="AI_INVALID_TOOL_CALL",
                    )

                result = await self.tools.execute(
                    name=name,
                    arguments=arguments,
                )

                result_items = (
                    result.get("medicines")
                    or result.get("batches")
                    or []
                )

                tools_used.append(
                    {
                        "name": name,
                        "arguments": arguments,
                        "result_count": (
                            len(result_items)
                            if isinstance(result_items, list)
                            else 0
                        ),
                    }
                )

                function_parts.append(
                    types.Part.from_function_response(
                        name=name,
                        response=result,
                    )
                )

            # Gemini expects function responses as user content.
            contents.append(
                types.Content(
                    role="user",
                    parts=function_parts,
                )
            )

        raise AppException(
            message=(
                "AI exceeded the permitted "
                "tool-call rounds."
            ),
            status_code=502,
            error_code="AI_TOOL_ROUND_LIMIT",
        )
