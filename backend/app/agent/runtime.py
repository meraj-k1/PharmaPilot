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
        contents = []

        for item in history:
            contents.append(
                types.Content(
                    role=item["role"],
                    parts=[types.Part.from_text(text=item["content"])],
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=message)],
            )
        )

        tools_used = []

        # Each round may contain several tool calls.
        for _ in range(self.settings.AI_MAX_TOOL_ROUNDS):
            response = await self.llm.generate(contents)

            calls = response.function_calls or []

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

            function_parts = []

            # Bound tool execution to avoid excessive queries.
            for call in calls[:5]:
                name = call.name or ""
                arguments = dict(call.args or {})

                result = await self.tools.execute(
                    name=name,
                    arguments=arguments,
                )

                result_items = result.get("medicines") or result.get("batches") or []

                tools_used.append(
                    {
                        "name": name,
                        "arguments": arguments,
                        "result_count": len(result_items),
                    }
                )

                function_parts.append(
                    types.Part.from_function_response(
                        name=name,
                        response=result,
                    )
                )

            # Return a result for every model-requested function.
            # Too many calls are rejected rather than silently omitted.
            # if len(calls) > 5:
            #     raise AppException(
            #         message="AI requested too many tool calls.",
            #         status_code=502,
            #         error_code="AI_TOOL_LIMIT",
            #     )

            for call in calls:
                name = call.name or ""
                arguments = dict(call.args or {})

            contents.append(
                types.Content(
                    role="tool",
                    parts=function_parts,
                )
            )

        raise AppException(
            message="AI exceeded the permitted tool-call rounds.",
            status_code=502,
            error_code="AI_TOOL_ROUND_LIMIT",
        )
