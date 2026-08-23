import json
import re
from pathlib import Path

from backend.errors import error_detail, error_status


def test_engine_business_errors_are_present_in_terminology_catalog():
    catalog = json.loads(Path('data/terminology.json').read_text(encoding='utf-8'))['errors']
    engine_source = "\n".join(path.read_text(encoding='utf-8') for path in Path('backend/engine').glob('*.py'))
    codes = set(re.findall(r'raise ValueError\("([a-z][a-z0-9_]+)"\)', engine_source))
    assert codes <= set(catalog)


def test_error_catalog_returns_chinese_message_and_recovery():
    catalog = {"errors": {"invalid_route": "请选择一条可通行路线。"}}
    assert error_detail(catalog, "invalid_route") == {
        "code": "invalid_route",
        "message": "请选择一条可通行路线。",
        "details": {},
        "recovery": "choose_another_action",
    }


def test_error_catalog_never_exposes_unknown_code_as_player_message():
    detail = error_detail({"errors": {}}, "unsupported_content_mechanism:effect")
    assert detail["message"] == "操作暂时无法完成，请重新选择。"
    assert detail["recovery"] == "choose_another_action"
    assert error_status("invalid_seat_token") == 401
