"""Check the configured LLM provider actually works, in one command.

    python scripts/check_llm.py

Diagnosing a provider through a pipeline stack trace is slow and misleading —
a key can authenticate, list models, and still fail every real call. This makes
the real call and reports the answer in one line.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.llm.base import LLMError  # noqa: E402
from app.llm.factory import get_provider  # noqa: E402
from app.llm.types import DocumentInput, LLMRole  # noqa: E402

PROBE = """[page 1]
6.1 Legal entity
The Bidder shall be registered under the Companies Act and shall have been in
continuous operation for at least 5 years as on the bid due date.
Applicability: Sole Bidder or prime bidder of the Consortium
Documents Required: Certificate of Incorporation
Mandatory: Yes    Weight: 0
"""


def main() -> int:
    settings = get_settings()
    print(f"LLM_PROVIDER={settings.llm_provider}")

    failures = 0
    for role in (LLMRole.EXTRACTION, LLMRole.REASONING):
        name = settings.provider_for_role(str(role))
        key = settings.api_key_for(name)
        keyed = "no key needed" if name == "stub" else ("key set" if key else "KEY MISSING")

        try:
            provider = get_provider(role)
        except Exception as exc:  # noqa: BLE001
            print(f"  {role:<11} {name:<8} {keyed:<13} could not build: {exc}")
            failures += 1
            continue

        model = provider.model_id_for(role)
        if role is not LLMRole.REASONING:
            print(f"  {role:<11} {name:<8} {keyed:<13} model={model}")
            continue

        # Only the reasoning role is probed with a live call: one request is
        # enough to prove the key, and this should not burn quota needlessly.
        try:
            result = provider.extract_requirements(DocumentInput(text=PROBE))
            print(
                f"  {role:<11} {name:<8} {keyed:<13} model={model}  "
                f"OK — parsed {len(result.requirements)} requirement(s)"
            )
        except LLMError as exc:
            message = str(exc)
            hint = ""
            if "credit_balance_exhausted" in message or "insufficient_quota" in message:
                hint = "  → the account has no credit; add credit or change LLM_PROVIDER"
            elif "429" in message:
                hint = "  → rate limited or out of quota"
            elif "404" in message:
                hint = "  → this model is not available to this key; fix app/llm/config.py"
            print(f"  {role:<11} {name:<8} {keyed:<13} model={model}  FAILED{hint}")
            print(f"      {message[:220]}")
            failures += 1

    print("\nAll good." if not failures else f"\n{failures} problem(s). See above.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
