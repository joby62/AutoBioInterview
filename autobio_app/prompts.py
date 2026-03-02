from typing import Any, Dict, List

ACTIVE_STAGES = ["daily", "evolution", "experience", "difficulty", "impact", "wrapup"]

DEFAULT_TEMPLATE: Dict[str, Any] = {
    "opening_script": (
        "欢迎参与数字学习自传访谈。你可以跳过任何问题、暂停或中途退出。"
        "回答越具体，最终自传越真实。"
    ),
    "stages": [
        {
            "key": "daily",
            "title": "日常学习场景",
            "goal": "收集平台、时间、内容、节奏",
            "prompt_hints": [
                "回忆最近48小时的一次数字学习",
                "说明你常见的学习时段和频率",
            ],
            "min_turns": 2,
            "min_chars": 40,
        },
        {
            "key": "evolution",
            "title": "阶段变化",
            "goal": "识别学习方式的变化节点",
            "prompt_hints": [
                "说清变化前后怎么学",
                "描述触发变化的事件",
            ],
            "min_turns": 2,
            "min_chars": 50,
        },
        {
            "key": "experience",
            "title": "体验与情绪",
            "goal": "让感受落在具体经历上",
            "prompt_hints": [
                "挑一段最难忘经历",
                "说清当时感受和原因",
            ],
            "min_turns": 2,
            "min_chars": 50,
        },
        {
            "key": "difficulty",
            "title": "困难与应对",
            "goal": "收集障碍、策略、效果",
            "prompt_hints": [
                "描述最近遇到的困难",
                "说你试过什么方法，有没有效果",
            ],
            "min_turns": 2,
            "min_chars": 50,
        },
        {
            "key": "impact",
            "title": "影响与反思",
            "goal": "覆盖学业/职业/关系/自我认同影响",
            "prompt_hints": [
                "讲一个积极影响",
                "讲一个让你矛盾的影响",
            ],
            "min_turns": 2,
            "min_chars": 50,
        },
        {
            "key": "wrapup",
            "title": "收尾补充",
            "goal": "补足遗漏并确认可生成总结",
            "prompt_hints": [
                "还有什么关键经历没提到",
                "是否有需要匿名化处理的细节",
            ],
            "min_turns": 1,
            "min_chars": 20,
        },
    ],
}


TEMPLATE_SYSTEM_PROMPT = """你是一名访谈设计助手。任务：把研究邀请文档转成可执行的分阶段访谈模板。
输出必须是 JSON：
- opening_script: string
- stages: array，长度固定6，顺序必须是 daily/evolution/experience/difficulty/impact/wrapup
- 每个 stage 包含 key/title/goal/prompt_hints(min 2)/min_turns/min_chars
要求：
1. 问题语言口语化，面向受访者友好。
2. 每个阶段都强调具体事实而不是抽象评价。
3. min_turns 取值 1~4，min_chars 取值 20~120。
4. 不要出现技术术语，不要输出额外说明。"""


TEMPLATE_SCHEMA: Dict[str, Any] = {
    "name": "interview_template",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "opening_script": {"type": "string"},
            "stages": {
                "type": "array",
                "minItems": 6,
                "maxItems": 6,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "key": {"type": "string", "enum": ACTIVE_STAGES},
                        "title": {"type": "string"},
                        "goal": {"type": "string"},
                        "prompt_hints": {
                            "type": "array",
                            "minItems": 2,
                            "items": {"type": "string"},
                        },
                        "min_turns": {"type": "integer", "minimum": 1, "maximum": 4},
                        "min_chars": {"type": "integer", "minimum": 20, "maximum": 120},
                    },
                    "required": ["key", "title", "goal", "prompt_hints", "min_turns", "min_chars"],
                },
            },
        },
        "required": ["opening_script", "stages"],
    },
    "strict": True,
}


QUESTION_SYSTEM_PROMPT = """你是“数字学习自传”访谈助手，目标是帮助受访者产出可写成自传的具体素材。
输出 JSON：
- questions: 1到2个追问问题
- stage_ready: boolean
- reason: string

约束：
1) 问题必须围绕当前阶段目标，不要跑题。
2) 问题要口语化、具体化，优先追问时间/场景/平台/行为/感受/结果。
3) 问题不能太短，避免只给关键词；应让受访者知道要回答什么细节。
4) 若当前信息不足，问题应指向“缺的那部分”而不是重复空泛提问。
5) stage_ready 只有在当前阶段信息基本达标时才给 true。
6) 不得输出 JSON 之外的任何文本。"""


QUESTION_SCHEMA: Dict[str, Any] = {
    "name": "next_questions",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "questions": {
                "type": "array",
                "minItems": 1,
                "maxItems": 2,
                "items": {"type": "string"},
            },
            "stage_ready": {"type": "boolean"},
            "reason": {"type": "string"},
        },
        "required": ["questions", "stage_ready", "reason"],
    },
    "strict": True,
}


SUMMARY_SYSTEM_PROMPT = """你是访谈写作助手。请基于受访者对话写“数字学习自传摘要”。
要求：
1. 第一人称，语言自然，不要学术腔。
2. 覆盖：日常场景、阶段变化、体验情绪、困难应对、影响反思。
3. 优先保留具体事实（时间、平台、事件、行为、感受），避免空泛概括。
4. 有矛盾和反思时要保留，不要写成流水账。
5. 文末给出“后续可补充点”3条。"""


def stage_map(template: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    stages: List[Dict[str, Any]] = template.get("stages", []) if isinstance(template, dict) else []
    out: Dict[str, Dict[str, Any]] = {}
    for stage in stages:
        key = stage.get("key")
        if isinstance(key, str) and key in ACTIVE_STAGES:
            out[key] = stage
    for fallback in DEFAULT_TEMPLATE["stages"]:
        out.setdefault(fallback["key"], fallback)
    return out
