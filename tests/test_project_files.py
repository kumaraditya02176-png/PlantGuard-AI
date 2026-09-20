from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def test_authoritative_docs_exist():
    assert (ROOT/'docs/project_report.pdf').exists()
    assert (ROOT/'docs/project_presentation.pptx').exists()
def test_codex_instructions_exist():
    assert (ROOT/'AGENTS.md').exists()
    assert (ROOT/'CODEX_MASTER_PROMPT.md').exists()
