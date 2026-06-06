"""Hybrid site assistant with comparison actions and document-aware answers."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    from .calculator import OBJECT_BONUSES, OSMClient, analyze_property
except (ImportError, ModuleNotFoundError):
    from calculator import OBJECT_BONUSES, OSMClient, analyze_property

SITE_CONTEXT = """\
Ты цифровой помощник сайта ИСУР.

Разделы сайта:
- Главная: /index.html
- О нас: /about.html
- Цифровой помощник: /services.html
- Аналитика: /analytics.html
- Сравнение объектов: /diffs.html
- Контакты: /contact.html

Что умеет сайт:
- Показывать карту и аналитику городской инфраструктуры.
- Сравнивать дома по рейтингу, качеству инфраструктуры, социальной среде и транспорту.
- Проводить инвестиционную аналитику недвижимости через инвестиционный калькулятор: прогноз цены, ROI, влияние района, метро, инфраструктуры и характеристик объекта.
- Хранить выбранные дома для сравнения в браузере.
- Показывать справочную информацию о возможностях сайта.

Правила ответа:
- Отвечай по-русски, естественно и по делу.
- Не используй markdown-жирность через **. Для структуры используй короткие заголовки и строки со знаком "-".
- Не отправляй пользователя вручную на страницы сайта, если можно ответить прямо в чате.
- Пиши компактно: сначала вывод, потом данные, потом что нужно уточнить.
- Если пользователь просит сравнить дома, опирайся на рейтинги и характеристики домов.
- Если есть релевантный контекст из документов, используй его как дополнительное объяснение и явно не выдумывай факты.
- Если документы дают только общий контекст, а не сведения по конкретному адресу, честно скажи об этом.
- Если пользователь спрашивает об инвестиционной привлекательности или доходности недвижимости, рассчитай прогнозную цену, ROI и влияние метро / района, если хватает данных.
- Не упоминай внутренние структуры, JSON, localStorage, prompt, chunk и служебные детали.
"""

STREET_PATTERN = re.compile(
    r"(?:(?:ул\.?|улица|пр-кт|проспект|ш\.?|шоссе|пер\.?|переулок|наб\.?|набережная|"
    r"б-р|бульвар|пл\.?|площадь|пр-д|проезд)\s+[^^,;\d\n][^,;\n]*|"
    r"[^,;\n]*\S\s+(?:ул\.?|улица|пр-кт|проспект|ш\.?|шоссе|пер\.?|переулок|наб\.?|"
    r"набережная|б-р|бульвар|пл\.?|площадь|пр-д|проезд))\s*,?\s*\d+[а-яa-z0-9/\-]*"
    r"(?:\s*(?:стр|стр\.|строение|строен|корпус|корп\.|к|литер|литер\.|с)\s*\d+)?",
    re.IGNORECASE,
)
COMPARE_INTENT_PATTERN = re.compile(
    r"(сравн|добав(?:ь|ить|им)|подбери|подобери|дом|дома|домов|адрес|объект)",
    re.IGNORECASE,
)
ANALYSIS_INTENT_PATTERN = re.compile(
    r"(анализ|аналитик|аналитику|проанализ|оцени|оценк|сравни|сопостав)",
    re.IGNORECASE,
)
REMOVE_INTENT_PATTERN = re.compile(
    r"(удал|убер|исключ|сними|вычерк|убрать|убери|сбрось)",
    re.IGNORECASE,
)
CLEAR_COMPARE_PATTERN = re.compile(
    r"(очисти.*сравнен|сбрось.*сравнен|удали.*все.*сравнен|очисти.*объект|очисти.*список)",
    re.IGNORECASE,
)
SITE_QA_PATTERN = re.compile(
    r"(сайт|страниц|раздел|чат|помощник|сервис|аналитик|контакт|главн|о нас|возможност)",
    re.IGNORECASE,
)
INVESTMENT_INTENT_PATTERN = re.compile(
    r"(инвест\w*|roi|рентаб|прибыль|окупаемость|доход|привлекательн|калькулятор)",
    re.IGNORECASE,
)
INVESTMENT_EXPLAIN_PATTERN = re.compile(
    r"(что\s+такое|как\s+работает|объясни|расскажи|что\s+умеет|зачем|для\s+чего).{0,80}"
    r"(инвест\w*|roi|калькулятор|доходн|привлекательн)",
    re.IGNORECASE,
)
PRICE_PATTERN = re.compile(
    r"цена(?:\s*[:=]|\s+)?\s*([\d\s.,]+)\s*(млн|тыс|тыс\.|руб|р|₽)?",
    re.IGNORECASE,
)
AREA_PATTERN = re.compile(
    r"площад[аь]\s*(?:[:=]|\s+)?\s*([\d\s.,]+)\s*(м2|кв\.?м|квм|м²)?",
    re.IGNORECASE,
)
METRO_TIME_PATTERN = re.compile(
    r"(?:до метро|метро)\s*(?:в|на)?\s*(\d+)\s*(?:мин|минут)",
    re.IGNORECASE,
)
YEARS_PATTERN = re.compile(
    r"(через\s*(\d+)\s*(?:лет|года|г\.)|срок.*?(\d+)\s*(?:лет|года|г\.)|(\d+)\s*(?:лет|года|г\.))",
    re.IGNORECASE,
)
DISTRICT_PATTERN = re.compile(
    r"(ЦАО|ЗАО|САО|СВАО|ВАО|ЮВАО|ЮАО|ЮЗАО|СЗАО|Новая Москва)",
    re.IGNORECASE,
)


@dataclass
class SiteAction:
    type: str
    label: str
    url: str


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(text: str) -> str:
    value = text.lower().strip().replace("ё", "е")
    value = value.replace("улица", "ул").replace("проспект", "пр-кт")
    value = re.sub(r"\s+", " ", value)
    return value


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[0-9a-zа-я]+", _normalize_text(text))


def _truncate(text: str, limit: int = 700) -> str:
    value = re.sub(r"\s+", " ", text).strip()
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def _parse_number(source: str) -> Optional[float]:
    if not source:
        return None
    cleaned = source.replace(" ", "").replace(",", ".").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_price(question: str) -> Optional[float]:
    match = PRICE_PATTERN.search(question)
    if not match:
        return None
    value = _parse_number(match.group(1))
    if value is None:
        return None
    unit = (match.group(2) or "").lower()
    if "млн" in unit:
        return value * 1_000_000
    if "тыс" in unit:
        return value * 1_000
    return value


def _parse_area(question: str) -> Optional[float]:
    match = AREA_PATTERN.search(question)
    if not match:
        return None
    return _parse_number(match.group(1))


def _parse_years(question: str) -> Optional[int]:
    match = YEARS_PATTERN.search(question)
    if not match:
        return None
    for group in match.groups():
        if group and group.isdigit():
            return int(group)
    return None


def _parse_metro_time(question: str) -> Optional[int]:
    match = METRO_TIME_PATTERN.search(question)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _parse_district(question: str) -> Optional[str]:
    match = DISTRICT_PATTERN.search(question)
    if not match:
        return None
    return match.group(1).strip()


def _parse_features(question: str) -> list[str]:
    text = question.lower()
    features: list[str] = []
    for feature in OBJECT_BONUSES.keys():
        if feature in text:
            features.append(feature)
    if "рядом метро" in text and "рядом метро" not in features:
        features.append("рядом метро")
    return features


def _parse_investment_fields(question: str) -> dict[str, Any]:
    return {
        "price": _parse_price(question),
        "area": _parse_area(question),
        "district": _parse_district(question),
        "features": _parse_features(question),
        "T_current": _parse_metro_time(question),
        "T_future": None,
        "t": _parse_years(question) or 5,
    }


def _format_rub(value: Any) -> str:
    if not isinstance(value, (int, float)):
        return "Н/Д"
    return f"{value:,.0f}".replace(",", " ") + " руб."


def _format_percent(value: Any) -> str:
    if not isinstance(value, (int, float)):
        return "Н/Д"
    return f"{value:.1f}%"


def _is_address_candidate(text: str) -> bool:
    if not text or len(text.strip()) < 6:
        return False
    text_lower = text.lower()
    if re.search(r"\b(цена|площадь|м2|м²|руб|р\.|₽|млн|тыс)\b", text_lower):
        return False
    return bool(
        re.search(
            r"\b(ул|улица|пр|проспект|ш|шоссе|пер|переулок|наб|набережная|б-р|бульвар|пл|площадь|проезд)\b",
            text_lower,
        )
    )


def _segment_question_by_addresses(question: str, addresses: list[str]) -> dict[str, str]:
    if not addresses:
        return {"": question}

    lowered = question.lower()
    positions: list[tuple[int, str]] = []
    for address in addresses:
        if not address:
            continue
        match = re.search(re.escape(address), question, re.IGNORECASE)
        if match:
            positions.append((match.start(), address))
            continue
        fallback_index = lowered.find(address.lower())
        positions.append((fallback_index if fallback_index >= 0 else len(question), address))

    positions.sort(key=lambda item: item[0])
    segments: dict[str, str] = {}
    for idx, (start, address) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(question)
        segments[address] = question[start:end].strip(" ;,.\n")
    return segments


def _clean_llm_answer(text: str) -> str:
    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        line = re.sub(r"^#{1,6}\s*", "", line)
        if re.fullmatch(r"-{3,}", line):
            continue
        if line.startswith("+ "):
            line = "- " + line[2:]
        line = line.replace("**", "")
        line = re.sub(r"[✅❌🚫⭐🌟📍🏠👥✈️🚗]+", "", line).strip()
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


class SiteAgent:
    """Assistant that combines site knowledge, document search and comparison actions."""

    def __init__(self, llm_api_key: Optional[str] = None):
        self._project_root = Path(__file__).resolve().parent.parent
        self._buildings_path = self._project_root / "backend" / "buildings.json"
        self._history_path = self._project_root / "llm" / "chat_history.json"
        self._buildings_cache: Optional[list[dict[str, Any]]] = None
        self._history: dict[str, list[tuple[str, str]]] = self._load_history_from_disk()
        self.llm = self._init_llm(llm_api_key)
        self.rag = self._init_rag(llm_api_key)

    def _init_llm(self, llm_api_key: Optional[str]):
        try:
            try:
                from llm_call import giga_chat_call
            except ModuleNotFoundError:
                from .llm_call import giga_chat_call
            return giga_chat_call("GigaChat", llm_api_key)
        except Exception:
            return None

    def _init_rag(self, llm_api_key: Optional[str]):
        try:
            try:
                from rag_system import RAGSystem, config
            except ModuleNotFoundError:
                from .rag_system import RAGSystem, config
            return RAGSystem(config, llm_api_key)
        except Exception:
            return None

    def _load_buildings(self) -> list[dict[str, Any]]:
        if self._buildings_cache is not None:
            return self._buildings_cache

        if not self._buildings_path.exists():
            self._buildings_cache = []
            return self._buildings_cache

        with self._buildings_path.open("r", encoding="utf-8") as file:
            raw = json.load(file)

        rows = raw.get("buildings", [])
        buildings: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, list) or len(row) < 13:
                continue
            address = str(row[1] or "").strip()
            if not address:
                continue
            buildings.append(
                {
                    "id": str(row[0]),
                    "address": address,
                    "district": row[2],
                    "build_year": row[3],
                    "floors": row[4],
                    "is_emergency": bool(row[5]) if row[5] is not None else None,
                    "lat": _safe_float(row[11]),
                    "lon": _safe_float(row[12]),
                    "socialScore": _safe_float(row[15] if len(row) > 15 else None),
                    "qualityScore": _safe_float(row[16] if len(row) > 16 else None),
                    "transportScore": _safe_float(row[17] if len(row) > 17 else None),
                    "totalScore": _safe_float(row[18] if len(row) > 18 else None),
                }
            )

        self._buildings_cache = buildings
        return buildings

    def _extract_addresses(self, question: str) -> list[str]:
        addresses: list[str] = []

        for match in STREET_PATTERN.findall(question):
            value = match.strip(" .,\n\t")
            value = re.sub(r"^(?:и\s+)+", "", value, flags=re.IGNORECASE).strip(" .,\n\t")
            if value and _is_address_candidate(value):
                addresses.append(value)

        quoted = re.findall(r"[\"“”'«»]([^\"“”'«»]{5,})[\"“”'«»]", question)
        for part in quoted:
            if any(ch.isdigit() for ch in part):
                candidate = part.strip()
                if _is_address_candidate(candidate):
                    addresses.append(candidate)

        marker_match = re.search(r"(?:адрес[а-я]*\s*:)(.+)$", question, re.IGNORECASE)
        if marker_match:
            tail = marker_match.group(1)
            for chunk in re.split(r"[;\n]|(?:\sи\s)", tail):
                candidate = chunk.strip(" .,\t")
                if len(candidate) > 6 and any(ch.isdigit() for ch in candidate) and _is_address_candidate(candidate):
                    addresses.append(candidate)

        unique: list[str] = []
        seen: set[str] = set()
        for address in addresses:
            key = _normalize_text(address)
            if key and key not in seen:
                seen.add(key)
                unique.append(address)
        return unique[:5]

    def _find_building_by_address(self, address: str) -> Optional[dict[str, Any]]:
        address_key = _normalize_text(address)
        if not address_key:
            return None

        best: Optional[dict[str, Any]] = None
        best_score = 0.0
        for item in self._load_buildings():
            score = self._score_match(address_key, item.get("address", ""))
            if score > best_score:
                best_score = score
                best = item

        if best_score >= 80.0:
            return best
        return None

    def _estimate_metro_time(self, transport_score: Optional[float]) -> Optional[int]:
        if transport_score is None:
            return None
        if transport_score >= 8.0:
            return 8
        if transport_score >= 5.0:
            return 12
        if transport_score >= 3.0:
            return 16
        return 22

    def _build_investment_requests(
        self,
        question: str,
        addresses: list[str],
        comparison_state: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        base = _parse_investment_fields(question)
        if addresses:
            source_addresses = addresses
        elif comparison_state:
            source_addresses = [item.get("address", "").strip() for item in comparison_state if item.get("address")]
            if not source_addresses:
                source_addresses = [""]
        else:
            source_addresses = [""]

        segments = _segment_question_by_addresses(question, source_addresses)
        requests: list[dict[str, Any]] = []
        for address in source_addresses:
            segment_text = segments.get(address, question) or question
            parsed = _parse_investment_fields(segment_text)
            request = {
                "address": address or "",
                "price": parsed["price"] if parsed["price"] is not None else base["price"],
                "area": parsed["area"] if parsed["area"] is not None else base["area"],
                "district": parsed["district"] if parsed["district"] is not None else base["district"],
                "features": parsed["features"] or base["features"],
                "T_current": parsed["T_current"] if parsed["T_current"] is not None else base["T_current"],
                "T_future": parsed["T_future"],
                "t": parsed["t"] if parsed["t"] is not None else base["t"],
            }

            if request["address"]:
                building = self._find_building_by_address(request["address"])
                if building is not None:
                    request["building"] = building
                    request["address"] = building.get("address") or request["address"]
                    building_district = _parse_district(str(building.get("district") or ""))
                    if not request["district"] and building_district:
                        request["district"] = building_district
                    if request["T_current"] is None:
                        if building.get("transportScore") is not None:
                            request["T_current"] = self._estimate_metro_time(building.get("transportScore"))
                        elif building.get("lat") and building.get("lon"):
                            osm = OSMClient()
                            metro_info = osm.find_nearest_metro(building["lat"], building["lon"])
                            if metro_info and metro_info.get("walking_time") is not None:
                                request["T_current"] = metro_info["walking_time"]
            requests.append(request)

        return requests

    def _investment_missing_fields(self, request: dict[str, Any]) -> list[str]:
        missing: list[str] = []
        if request.get("price") is None:
            missing.append("цена")
        if request.get("area") is None:
            missing.append("площадь")
        if not request.get("address") and not request.get("district"):
            missing.append("адрес или район")
        return missing

    def _investment_answer(self, template: str, result: dict[str, Any], missing: list[str]) -> str:
        lines: list[str] = [template.strip()]
        if missing:
            lines.append("Для точного прогноза не хватает: " + ", ".join(missing) + ".")
            lines.append("Уточните цену, площадь или район, чтобы получить более точную инвестиционную оценку.")
            return "\n".join(lines)

        lines.append(f"Инвестиционная привлекательность для {result['address']}:")
        lines.append(f"- Текущая цена: {_format_rub(result['current_price'])}")
        lines.append(f"- Прогнозная цена через {result['t_years']} лет: {_format_rub(result['future_price'])}")
        lines.append(f"- ROI: {_format_percent(result['ROI'])}")
        lines.append(f"- Общий рост: {_format_percent(result['total_growth'])}")
        lines.append(f"- Район: {result['params']['district']} (балл {result['params']['district_score']})")
        if result["transport"]["walking_time"] is not None:
            lines.append(f"- Время до метро: {result['transport']['walking_time']} мин")
        lines.append("Можно уточнить прогноз, добавив больше характеристик объекта или данные о ближайшем метро.")
        return "\n".join(lines)

    def _investment_answer_multi(self, template: str, results: list[dict[str, Any]]) -> str:
        lines: list[str] = ["Итог"]
        if results:
            leader = max(results, key=lambda item: item.get("ROI", -999999))
            lines.append(
                f"По расчёту сильнее выглядит {leader['address']}: ROI {_format_percent(leader.get('ROI'))}."
            )
        lines.append("")
        lines.append("Расчёт")
        for summary in results:
            lines.append(
                f"- {summary['address']}: текущая цена {_format_rub(summary['current_price'])}, "
                f"прогноз через {summary['t_years']} лет {_format_rub(summary['future_price'])}, "
                f"ROI {_format_percent(summary['ROI'])}"
            )
        lines.append("")
        lines.append("Что уточнит прогноз")
        lines.append("- район, класс объекта, этаж, планировка, видовые характеристики и реальные данные по метро.")
        return "\n".join(lines)

    def _investment_calculator_help(self, comparison_state: list[dict[str, Any]]) -> str:
        lines = [
            "Инвестиционный калькулятор ИСУР оценивает, насколько объект недвижимости может быть интересен для вложений.",
            "Он считает прогнозную цену, ROI, общий рост стоимости и учитывает район, транспортную доступность, инфраструктурные события и особенности объекта: например вид на парк, близость метро, этаж или планировку.",
            "Для точного расчёта нужны минимум: адрес или район, текущая цена и площадь. Дополнительно можно указать срок прогноза, время до метро и характеристики объекта.",
        ]
        if comparison_state:
            lines.append(
                "Сейчас можно запустить расчёт по домам из сравнения: укажите для каждого цену и площадь, например «Покровка, 42 строение 6 — цена 15 млн, площадь 80 м2»."
            )
        else:
            lines.append(
                "Пример запроса: «рассчитай инвестиционную привлекательность для ул. Покровка, 42 строение 6, цена 15 млн, площадь 80 м2, район ЦАО, через 5 лет»."
            )
        return "\n".join(lines)

    def _investment_qualitative_answer(
        self,
        requests: list[dict[str, Any]],
        missing_items: list[dict[str, Any]],
        comparison_state: list[dict[str, Any]],
    ) -> str:
        lines = [
            "Инвест-аналитика",
            "Могу оценить объекты, но для точного ROI и прогноза цены не хватает числовых данных.",
        ]

        snapshot_items = comparison_state or [
            request["building"] for request in requests if isinstance(request.get("building"), dict)
        ]
        if snapshot_items:
            lines.append("")
            lines.append("Предварительная оценка по данным ИСУР:")
            ranked = self._rank_buildings(snapshot_items)
            for item in ranked[:5]:
                score = item.get("totalScore")
                transport = item.get("transportScore")
                quality = item.get("qualityScore")
                social = item.get("socialScore")
                parts = [f"- {item.get('address')}"]
                if isinstance(score, (int, float)):
                    parts.append(f"общий рейтинг {score:.2f}")
                if isinstance(transport, (int, float)):
                    parts.append(f"транспорт {transport:.2f}")
                if isinstance(quality, (int, float)):
                    parts.append(f"инфраструктура {quality:.2f}")
                if isinstance(social, (int, float)):
                    parts.append(f"социальная среда {social:.2f}")
                lines.append(", ".join(parts) + ".")
            if ranked:
                leader = ranked[0]
                lines.append(
                    f"По имеющимся городским метрикам сильнее выглядит {leader.get('address')}: это хороший кандидат для дальнейшего инвестиционного расчёта."
                )
        elif any(item.get("address") for item in requests):
            lines.append("Адрес я понял, поэтому осталось добавить цену и площадь для расчёта.")

        if missing_items:
            lines.append("")
            lines.append("Чтобы посчитать ROI и прогнозную цену, укажите недостающие параметры:")
            for item in missing_items:
                lines.append(f"- {item['address']}: {', '.join(item['missing'])}")
        else:
            lines.append("Чтобы выдать числовую аналитику, укажите цену, площадь и район или адрес.")

        lines.append("")
        lines.append(
            'Формат: "ул. Покровка, 42 строение 6 — цена 15 млн, площадь 80 м2; Рождественский б-р, 17 — цена 12 млн, площадь 70 м2".'
        )
        return "\n".join(lines)

    def _has_pending_investment_context(self, session_id: str, question: str) -> bool:
        turns = self._history.get(session_id, [])
        if not turns:
            return False
        recent_assistant = " ".join(text for role, text in turns[-6:] if role == "assistant").lower()
        if not re.search(r"(инвест|roi|прогноз.*цен|площад|цена)", recent_assistant):
            return False
        return _parse_price(question) is not None or _parse_area(question) is not None

    def _investment_missing_prompt(
        self,
        question: str,
        session_id: str,
        requests: list[dict[str, Any]],
        missing_items: list[dict[str, Any]],
        comparison_state: list[dict[str, Any]],
    ) -> str:
        request_lines = []
        for request in requests:
            building = request.get("building") or {}
            request_lines.append(
                json.dumps(
                    {
                        "address": request.get("address"),
                        "price": request.get("price"),
                        "area": request.get("area"),
                        "district": request.get("district"),
                        "years": request.get("t"),
                        "transport_minutes": request.get("T_current"),
                        "building_scores": {
                            "total": building.get("totalScore"),
                            "social": building.get("socialScore"),
                            "quality": building.get("qualityScore"),
                            "transport": building.get("transportScore"),
                        }
                        if building
                        else None,
                    },
                    ensure_ascii=False,
                )
            )
        missing_lines = [f"- {item['address']}: {', '.join(item['missing'])}" for item in missing_items]
        return (
            f"{SITE_CONTEXT}\n\n"
            "Сейчас режим инвестиционного калькулятора.\n"
            "Правила ответа:\n"
            "- Не отправляй пользователя на страницы сайта.\n"
            "- Скажи, что калькулятор понял объекты, но не может посчитать ROI без недостающих данных.\n"
            "- Дай короткую предварительную оценку по рейтингам, если они есть.\n"
            "- Попроси внести недостающие данные в удобном формате.\n"
            "- Не используй **, таблицы и длинные вступления. Максимум один уместный смайлик или вообще без них.\n"
            "- Не придумывай цену, площадь и район.\n\n"
            f"История диалога:\n{self._history_text(session_id)}\n\n"
            f"Запрос пользователя: {question}\n\n"
            "Распознанные объекты и данные:\n"
            + "\n".join(request_lines)
            + "\n\n"
            "Недостающие поля:\n"
            + "\n".join(missing_lines)
            + "\n\n"
            f"Текущее сравнение:\n{self._comparison_state_text(comparison_state)}\n\n"
            "Сформируй ответ с заголовками: Инвест-аналитика, Что уже видно, Что нужно для расчёта."
        )

    def _investment_result_prompt(
        self,
        question: str,
        session_id: str,
        analyses: list[dict[str, Any]],
        comparison_state: list[dict[str, Any]],
    ) -> str:
        rows = []
        for result in analyses:
            rows.append(
                json.dumps(
                    {
                        "address": result.get("address"),
                        "current_price": round(result.get("current_price", 0)),
                        "future_price": round(result.get("future_price", 0)),
                        "price_per_sqm": round(result.get("price_per_sqm", 0)),
                        "future_price_per_sqm": round(result.get("future_price_per_sqm", 0)),
                        "roi_percent": round(result.get("ROI", 0), 1),
                        "total_growth_percent": round(result.get("total_growth", 0), 1),
                        "years": result.get("t_years"),
                        "district": result.get("params", {}).get("district"),
                        "district_score": result.get("params", {}).get("district_score"),
                        "metro_time": result.get("transport", {}).get("walking_time"),
                        "growth_breakdown": {
                            key: round(value, 1)
                            for key, value in result.get("breakdown", {}).items()
                        },
                    },
                    ensure_ascii=False,
                )
            )
        return (
            f"{SITE_CONTEXT}\n\n"
            "Сейчас режим инвестиционного калькулятора.\n"
            "Калькулятор уже посчитал значения. Твоя задача — объяснить результат пользователю красиво и коротко.\n"
            "Правила ответа:\n"
            "- Не отправляй пользователя на страницы сайта.\n"
            "- Не используй ** и не добавляй много эмодзи.\n"
            "- Не называй расчёт точной рыночной оценкой; это предварительный прогноз.\n"
            "- Сначала дай вывод: какой объект выглядит сильнее, если объектов несколько.\n"
            "- Затем перечисли ключевые цифры: текущая цена, прогнозная цена, ROI, рост, срок.\n"
            "- Заверши одной строкой, какие параметры могут уточнить расчёт.\n\n"
            f"История диалога:\n{self._history_text(session_id)}\n\n"
            f"Запрос пользователя: {question}\n\n"
            "Результаты калькулятора:\n"
            + "\n".join(rows)
            + "\n\n"
            f"Текущее сравнение:\n{self._comparison_state_text(comparison_state)}\n\n"
            "Сформируй ответ с заголовками: Итог, Расчёт, Что влияет на прогноз."
        )

    def _score_match(self, query_address: str, building_address: str) -> float:
        q = _normalize_text(query_address)
        b = _normalize_text(building_address)

        if q == b:
            return 200.0
        if q in b or b in q:
            return 120.0

        q_tokens = set(_tokenize(q))
        b_tokens = set(_tokenize(b))
        if not q_tokens or not b_tokens:
            return 0.0

        common = q_tokens & b_tokens
        union = q_tokens | b_tokens
        overlap = len(common) / max(1, len(union))

        digit_bonus = 0.0
        q_digits = set(re.findall(r"\d+", q))
        b_digits = set(re.findall(r"\d+", b))
        if q_digits and b_digits and q_digits == b_digits:
            digit_bonus = 0.35
        elif q_digits & b_digits:
            digit_bonus = 0.15

        return (overlap + digit_bonus) * 100

    def _match_addresses(self, addresses: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        buildings = self._load_buildings()
        matched: list[dict[str, Any]] = []
        missed: list[str] = []
        used_ids: set[str] = set()

        for address in addresses:
            scored = sorted(
                (
                    (self._score_match(address, item["address"]), item)
                    for item in buildings
                    if item["id"] not in used_ids
                ),
                key=lambda x: x[0],
                reverse=True,
            )
            if not scored or scored[0][0] < 45:
                missed.append(address)
                continue

            best = scored[0][1]
            used_ids.add(best["id"])
            matched.append(best)

        return matched, missed

    def _normalize_comparison_state(self, items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []

        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in items[:5]:
            if not isinstance(item, dict):
                continue
            address = str(item.get("address") or "").strip()
            if not address:
                continue
            key = _normalize_text(address)
            if key in seen:
                continue
            seen.add(key)
            normalized.append(
                {
                    "id": str(item.get("id") or f"chat_{key}"),
                    "address": address,
                    "lat": _safe_float(item.get("lat")),
                    "lon": _safe_float(item.get("lon")),
                    "socialScore": _safe_float(item.get("socialScore")),
                    "qualityScore": _safe_float(item.get("qualityScore")),
                    "transportScore": _safe_float(item.get("transportScore")),
                    "totalScore": _safe_float(item.get("totalScore")),
                    "floors": _safe_int(item.get("floors")),
                    "build_year": _safe_int(item.get("build_year")),
                    "is_emergency": item.get("is_emergency"),
                    "addedAt": item.get("addedAt"),
                }
            )
        return normalized

    def _match_current_comparison(
        self, addresses: list[str], comparison_state: list[dict[str, Any]]
    ) -> tuple[list[dict[str, Any]], list[str]]:
        matched: list[dict[str, Any]] = []
        missed: list[str] = []
        used_ids: set[str] = set()

        for address in addresses:
            scored = sorted(
                (
                    (self._score_match(address, item["address"]), item)
                    for item in comparison_state
                    if item["id"] not in used_ids
                ),
                key=lambda x: x[0],
                reverse=True,
            )
            if not scored or scored[0][0] < 45:
                missed.append(address)
                continue
            best = scored[0][1]
            used_ids.add(best["id"])
            matched.append(best)

        return matched, missed

    def _to_compare_payload(self, building: dict[str, Any]) -> dict[str, Any]:
        emergency = building.get("is_emergency")
        if emergency is None:
            emergency_text: Optional[str] = None
        elif isinstance(emergency, str):
            emergency_text = emergency
        else:
            emergency_text = "Да" if emergency else "Нет"

        identifier = str(building.get("id") or "")
        if not identifier.startswith("llm_"):
            identifier = f"llm_{identifier}"

        return {
            "id": identifier,
            "address": building.get("address"),
            "lat": building.get("lat"),
            "lon": building.get("lon"),
            "socialScore": building.get("socialScore"),
            "qualityScore": building.get("qualityScore"),
            "transportScore": building.get("transportScore"),
            "totalScore": building.get("totalScore"),
            "floors": _safe_int(building.get("floors")),
            "build_year": _safe_int(building.get("build_year")),
            "is_emergency": emergency_text,
            "addedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _format_building_line(self, building: dict[str, Any], idx: int | None = None) -> str:
        prefix = f"{idx}. " if idx is not None else "- "
        total = building.get("totalScore")
        social = building.get("socialScore")
        quality = building.get("qualityScore")
        transport = building.get("transportScore")
        parts = [
            f"{prefix}{building.get('address')}",
            f"общий рейтинг {total:.2f}" if isinstance(total, (int, float)) else "общий рейтинг Н/Д",
            f"социальный {social:.2f}" if isinstance(social, (int, float)) else "социальный Н/Д",
            f"качество {quality:.2f}" if isinstance(quality, (int, float)) else "качество Н/Д",
            f"транспорт {transport:.2f}" if isinstance(transport, (int, float)) else "транспорт Н/Д",
        ]
        if building.get("build_year"):
            parts.append(f"год постройки {building['build_year']}")
        if building.get("floors"):
            parts.append(f"этажность {building['floors']}")
        if building.get("is_emergency") not in (None, ""):
            parts.append(f"аварийность {building['is_emergency']}")
        return ", ".join(parts)

    def _rank_buildings(self, buildings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            buildings,
            key=lambda item: item.get("totalScore") if item.get("totalScore") is not None else -1,
            reverse=True,
        )

    def _comparison_brief(self, buildings: list[dict[str, Any]], missed: list[str]) -> str:
        ranked = self._rank_buildings(buildings)
        lines = [f"Собрал {len(buildings)} объект(а) для сравнения."]
        for idx, item in enumerate(ranked, 1):
            score = item.get("totalScore")
            score_text = f"{score:.2f}" if isinstance(score, (int, float)) else "Н/Д"
            lines.append(f"{idx}. {item['address']} — общий рейтинг {score_text}.")
        if len(ranked) >= 2:
            winner = ranked[0]
            lines.append(f"По числовому рейтингу сейчас лидирует {winner['address']}.")
        if missed:
            lines.append("Не удалось точно сопоставить: " + "; ".join(missed) + ".")
        return "\n".join(lines)

    def _comparison_analysis_answer(
        self,
        buildings: list[dict[str, Any]],
        missed: list[str],
        added_count: int = 0,
    ) -> str:
        ranked = self._rank_buildings(buildings)
        if not ranked:
            return (
                "Не смог найти дома для сравнения. "
                "Уточните адреса в формате: «ул. Примерная, 10; ул. Вторая, 25»."
            )

        lines: list[str] = []
        if added_count:
            lines.append(f"Добавил в сравнение {added_count} объект(а) и сразу провёл анализ.")
        else:
            lines.append(f"Провёл анализ {len(ranked)} объект(а) из сравнения.")

        if len(ranked) >= 2:
            leader = ranked[0]
            last = ranked[-1]
            leader_score = leader.get("totalScore")
            last_score = last.get("totalScore")
            if isinstance(leader_score, (int, float)) and isinstance(last_score, (int, float)):
                diff = leader_score - last_score
                lines.append(
                    f"Вывод: сильнее выглядит {leader['address']} — общий рейтинг {leader_score:.2f}, "
                    f"это на {diff:.2f} выше, чем у {last['address']}."
                )
            else:
                lines.append(f"Вывод: по доступным данным сильнее выглядит {leader['address']}.")
        else:
            item = ranked[0]
            score = item.get("totalScore")
            score_text = f"{score:.2f}" if isinstance(score, (int, float)) else "Н/Д"
            lines.append(f"Вывод: {item['address']} добавлен, общий рейтинг — {score_text}.")

        lines.append("")
        lines.append("По объектам:")
        for item in ranked:
            total = item.get("totalScore")
            social = item.get("socialScore")
            quality = item.get("qualityScore")
            transport = item.get("transportScore")
            parts = [f"- {item['address']}"]
            if isinstance(total, (int, float)):
                parts.append(f"общий рейтинг {total:.2f}")
            if isinstance(social, (int, float)):
                parts.append(f"социальная среда {social:.2f}")
            if isinstance(quality, (int, float)):
                parts.append(f"инфраструктура {quality:.2f}")
            if isinstance(transport, (int, float)):
                parts.append(f"транспорт {transport:.2f}")
            if item.get("build_year"):
                parts.append(f"год постройки {item['build_year']}")
            if item.get("floors"):
                parts.append(f"{item['floors']} этажей")
            lines.append(", ".join(parts) + ".")

        if len(ranked) >= 2:
            top = ranked[0]
            runner = ranked[1]
            social_delta = self._metric_delta(top, runner, "socialScore")
            quality_delta = self._metric_delta(top, runner, "qualityScore")
            transport_delta = self._metric_delta(top, runner, "transportScore")
            details = []
            if social_delta:
                details.append(f"социальная среда: {social_delta}")
            if quality_delta:
                details.append(f"инфраструктура: {quality_delta}")
            if transport_delta:
                details.append(f"транспорт: {transport_delta}")
            if details:
                lines.append("")
                lines.append("Ключевые различия:")
                for detail in details:
                    lines.append(f"- {detail}")

        if missed:
            lines.append("")
            lines.append("Не удалось точно сопоставить: " + "; ".join(missed) + ".")

        lines.append("")
        lines.append(
            "Практически: если важнее комфорт повседневной жизни, смотрите на лидера по общему и социальному рейтингу; "
            "если цель инвестиционная, нужны цена, площадь и срок прогноза."
        )
        return "\n".join(lines)

    def _metric_delta(self, left: dict[str, Any], right: dict[str, Any], key: str) -> Optional[str]:
        left_value = left.get(key)
        right_value = right.get(key)
        if not isinstance(left_value, (int, float)) or not isinstance(right_value, (int, float)):
            return None
        if abs(left_value - right_value) < 0.01:
            return f"одинаково ({left_value:.2f})"
        better = left.get("address") if left_value > right_value else right.get("address")
        return f"лучше у {better} ({max(left_value, right_value):.2f} против {min(left_value, right_value):.2f})"

    def _removal_brief(
        self,
        removed: list[dict[str, Any]],
        missed: list[str],
        cleared: bool = False,
    ) -> str:
        if cleared:
            return "Очистил список сравнения. Можно собрать новый набор домов и сразу обсудить его."
        lines = [f"Убрал из сравнения {len(removed)} объект(а)."]
        for item in removed:
            lines.append(f"- {item['address']}")
        if missed:
            lines.append("Не нашёл в текущем сравнении: " + "; ".join(missed) + ".")
        return "\n".join(lines)

    def _comparison_state_text(self, comparison_state: list[dict[str, Any]]) -> str:
        if not comparison_state:
            return "Сейчас список сравнения пуст."
        lines = ["Сейчас в сравнении:"]
        for idx, item in enumerate(self._rank_buildings(comparison_state), 1):
            lines.append(self._format_building_line(item, idx))
        return "\n".join(lines)

    def _history_text(self, session_id: str, limit: int = 8) -> str:
        turns = self._history.get(session_id, [])
        if not turns:
            return "(история пока пустая)"
        return "\n".join(f"{role}: {text}" for role, text in turns[-limit:])

    def _load_history_from_disk(self) -> dict[str, list[tuple[str, str]]]:
        if not self._history_path.exists():
            return {}
        try:
            with self._history_path.open("r", encoding="utf-8") as file:
                raw = json.load(file)
            if not isinstance(raw, dict):
                return {}
            parsed: dict[str, list[tuple[str, str]]] = {}
            for session_id, items in raw.items():
                if not isinstance(items, list):
                    continue
                turns: list[tuple[str, str]] = []
                for item in items:
                    if (
                        isinstance(item, list)
                        and len(item) == 2
                        and isinstance(item[0], str)
                        and isinstance(item[1], str)
                    ):
                        turns.append((item[0], item[1]))
                if turns:
                    parsed[str(session_id)] = turns[-60:]
            return parsed
        except Exception:
            return {}

    def _save_history_to_disk(self) -> None:
        try:
            self._history_path.parent.mkdir(parents=True, exist_ok=True)
            serializable = {
                sid: [[role, text] for role, text in turns[-60:]]
                for sid, turns in list(self._history.items())[-500:]
            }
            with self._history_path.open("w", encoding="utf-8") as file:
                json.dump(serializable, file, ensure_ascii=False)
        except Exception:
            return

    def _append_history(self, session_id: str, question: str, answer: str) -> None:
        history = self._history.setdefault(session_id, [])
        history.append(("user", question))
        history.append(("assistant", answer))
        if len(history) > 60:
            self._history[session_id] = history[-60:]
        self._save_history_to_disk()

    def _search_documents(self, question: str, top_n: int) -> list[tuple[str, float]]:
        if self.rag is None:
            return []
        try:
            return self.rag.query(question, top_n)
        except Exception:
            return []

    def _documents_context_text(
        self,
        question: str,
        top_n: int,
        fallback_query: Optional[str] = None,
    ) -> tuple[str, int]:
        chunks = self._search_documents(question, top_n)
        if not chunks and fallback_query:
            chunks = self._search_documents(fallback_query, top_n)
        if not chunks:
            return "Релевантного документного контекста не найдено.", 0

        lines = []
        for idx, (chunk, score) in enumerate(chunks[:top_n], 1):
            lines.append(f"[Документ {idx}, score={score:.2f}] {_truncate(chunk)}")
        return "\n".join(lines), len(chunks[:top_n])

    def _comparison_prompt(
        self,
        question: str,
        session_id: str,
        comparison_state: list[dict[str, Any]],
        compared_buildings: list[dict[str, Any]],
        documents_context: str,
        action_note: str,
    ) -> str:
        return (
            f"{SITE_CONTEXT}\n\n"
            "Дополнительные правила для этого ответа:\n"
            "- Сначала дай прямой вывод простым человеческим языком.\n"
            "- Для сравнения домов опирайся на общий рейтинг, социальный рейтинг, качество инфраструктуры и транспорт.\n"
            "- Если документы не про конкретные адреса, обозначь это одной фразой, но всё равно используй их как общий контекст.\n"
            "- Если действие уже выполнено, скажи об этом в прошедшем времени.\n"
            "- Не делай вид, что документы содержат то, чего в них нет.\n\n"
            "- Если речь идет о недвижимости, предложи дополнительно рассчитать инвестиционную привлекательность.\n\n"
            "- Избегай сухих заголовков и канцелярита. Лучше 1-2 внятных абзаца или короткий компактный список.\n\n"
            f"История диалога:\n{self._history_text(session_id)}\n\n"
            f"Текущее сравнение до ответа:\n{self._comparison_state_text(comparison_state)}\n\n"
            f"Дома, о которых нужно говорить:\n"
            + "\n".join(self._format_building_line(item, idx + 1) for idx, item in enumerate(self._rank_buildings(compared_buildings)))
            + "\n\n"
            f"Комментарий к действию: {action_note}\n\n"
            f"Контекст из документов:\n{documents_context}\n\n"
            f"Запрос пользователя: {question}\n\n"
            "Сформируй ответ так, чтобы в нём были: итог по сравнению, сильные и слабые стороны домов, "
            "и короткая практическая рекомендация, что открыть дальше на сайте."
        )

    def _document_prompt(
        self,
        question: str,
        session_id: str,
        comparison_state: list[dict[str, Any]],
        documents_context: str,
    ) -> str:
        comparison_hint = self._comparison_state_text(comparison_state)
        return (
            f"{SITE_CONTEXT}\n\n"
            "Сейчас основной режим ответа: анализ материалов и помощь по сайту.\n"
            "- Если в документах есть ответ, опирайся прежде всего на них.\n"
            "- Если документов не хватает, не выдумывай факты и честно обозначь ограничение.\n"
            "- Если вопрос связан со сравнением текущих домов, можешь кратко связать ответ с их рейтингами.\n\n"
            "- Пиши естественно, без формальных шапок и служебной разметки.\n\n"
            f"История диалога:\n{self._history_text(session_id)}\n\n"
            f"Текущее сравнение:\n{comparison_hint}\n\n"
            f"Контекст из документов:\n{documents_context}\n\n"
            f"Запрос пользователя: {question}\n\n"
            "Ответь естественно и без канцелярита."
        )

    def _site_prompt(
        self,
        question: str,
        session_id: str,
        comparison_state: list[dict[str, Any]],
        documents_context: str,
    ) -> str:
        return (
            f"{SITE_CONTEXT}\n\n"
            f"История диалога:\n{self._history_text(session_id)}\n\n"
            f"Текущее сравнение:\n{self._comparison_state_text(comparison_state)}\n\n"
            f"Контекст из документов:\n{documents_context}\n\n"
            f"Вопрос пользователя: {question}\n\n"
            "Ответь как помощник по сайту: что можно сделать, где это находится и что произойдет дальше."
        )

    def _invoke_llm(self, prompt: str) -> Optional[str]:
        if self.llm is None:
            return None
        try:
            response = self.llm.invoke(prompt)
            return _clean_llm_answer(str(response.content))
        except Exception:
            return None

    def _fallback_document_answer(self, question: str, comparison_state: list[dict[str, Any]], top_n: int) -> str:
        chunks = self._search_documents(question, top_n)
        if chunks:
            lines = ["Нашёл опору в загруженных материалах:"]
            for idx, (chunk, _score) in enumerate(chunks[:3], 1):
                lines.append(f"{idx}. {_truncate(chunk, 260)}")
            if comparison_state:
                lines.append("Если хотите, могу отдельно связать это с домами, которые уже лежат в сравнении.")
            return "\n".join(lines)

        if comparison_state:
            return (
                "В документах по этому вопросу ничего явно не нашёл. "
                "Могу продолжить по текущим домам в сравнении или помочь по разделам сайта."
            )

        return (
            "В загруженных материалах по этому запросу ничего не нашёл. "
            "Могу помочь по функциям сайта или сравнить дома, если дадите адреса."
        )

    def _choose_buildings_for_analysis(
        self,
        comparison_state: list[dict[str, Any]],
        new_buildings: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if new_buildings:
            return new_buildings
        return comparison_state

    def process(
        self,
        question: str,
        session_id: str = "default",
        top_n: int = 5,
        comparison_state: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        q = question.strip()
        if not q:
            return {
                "answer": "Введите запрос.",
                "actions": [],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "empty"},
            }

        comparison_state = self._normalize_comparison_state(comparison_state)
        normalized_q = _normalize_text(q)
        addresses = self._extract_addresses(q)
        compare_intent = bool(COMPARE_INTENT_PATTERN.search(q))
        analysis_intent = bool(ANALYSIS_INTENT_PATTERN.search(q))
        remove_intent = bool(REMOVE_INTENT_PATTERN.search(q))
        clear_intent = bool(CLEAR_COMPARE_PATTERN.search(normalized_q))
        investment_intent = bool(INVESTMENT_INTENT_PATTERN.search(q)) or self._has_pending_investment_context(session_id, q)
        investment_explain_intent = bool(INVESTMENT_EXPLAIN_PATTERN.search(q))
        document_fallback_query = None
        if compare_intent or analysis_intent or remove_intent or comparison_state:
            document_fallback_query = (
                "городская среда благоустройство инфраструктура транспортная доступность "
                "социальная среда жилые дома"
            )
        doc_context, doc_count = self._documents_context_text(q, top_n, document_fallback_query)
        actions: list[SiteAction] = []

        if clear_intent and comparison_state:
            answer = self._removal_brief([], [], cleared=True)
            llm_answer = self._invoke_llm(
                self._site_prompt(
                    f"{q}\n\nДействие уже выполнено: список сравнения очищен.",
                    session_id,
                    comparison_state,
                    doc_context,
                )
            )
            final_answer = llm_answer or answer
            self._append_history(session_id, q, final_answer)
            return {
                "answer": final_answer,
                "actions": [SiteAction(type="link", label="Открыть сравнение", url="/diffs.html").__dict__],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": True,
                "meta": {"mode": "comparison_clear", "doc_chunks_used": doc_count},
            }

        if remove_intent and ("сравнен" in normalized_q or addresses or comparison_state):
            removed: list[dict[str, Any]] = []
            missed: list[str] = []
            clear_all = "все" in normalized_q or "всё" in normalized_q or clear_intent

            if clear_all and comparison_state:
                removed = comparison_state
            elif addresses:
                removed, missed = self._match_current_comparison(addresses, comparison_state)
            elif "последн" in normalized_q and comparison_state:
                removed = [comparison_state[-1]]
            elif "перв" in normalized_q and comparison_state:
                removed = [comparison_state[0]]

            if removed:
                answer = self._removal_brief(removed, missed, cleared=clear_all)
                llm_answer = self._invoke_llm(
                    self._site_prompt(
                        f"{q}\n\nДействие уже выполнено: удалены объекты из сравнения.\n{answer}",
                        session_id,
                        comparison_state,
                        doc_context,
                    )
                )
                final_answer = llm_answer or answer
                self._append_history(session_id, q, final_answer)
                return {
                    "answer": final_answer,
                    "actions": [SiteAction(type="link", label="Открыть сравнение", url="/diffs.html").__dict__],
                    "buildings_to_add": [],
                    "buildings_to_remove": [self._to_compare_payload(item) for item in removed],
                    "clear_comparison": clear_all,
                    "meta": {
                        "mode": "comparison_remove",
                        "removed_count": len(removed),
                        "missed_count": len(missed),
                        "doc_chunks_used": doc_count,
                    },
                }

            answer = (
                "Не смог понять, что именно убрать из текущего сравнения. "
                "Напишите адрес дома, либо скажите «очистить сравнение»."
            )
            self._append_history(session_id, q, answer)
            return {
                "answer": answer,
                "actions": [SiteAction(type="link", label="Открыть сравнение", url="/diffs.html").__dict__]
                if comparison_state
                else [],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "comparison_remove_not_found", "doc_chunks_used": doc_count},
            }

        if investment_explain_intent:
            final_answer = self._investment_calculator_help(comparison_state)
            self._append_history(session_id, q, final_answer)
            return {
                "answer": final_answer,
                "actions": [SiteAction(type="link", label="Открыть аналитику", url="/analytics.html").__dict__],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "investment_calculator_help", "doc_chunks_used": doc_count},
            }

        if investment_intent:
            investment_requests = self._build_investment_requests(q, addresses, comparison_state)
            missing_items: list[dict[str, Any]] = []

            for item in investment_requests:
                missing_fields = self._investment_missing_fields(item)
                if missing_fields:
                    missing_items.append(
                        {
                            "address": item.get("address") or item.get("district") or "объект",
                            "missing": missing_fields,
                        }
                    )

            if len(investment_requests) > 1 and missing_items:
                fallback_answer = self._investment_qualitative_answer(
                    investment_requests,
                    missing_items,
                    comparison_state,
                )
                llm_answer = self._invoke_llm(
                    self._investment_missing_prompt(
                        q,
                        session_id,
                        investment_requests,
                        missing_items,
                        comparison_state,
                    )
                )
                final_answer = llm_answer or fallback_answer
                self._append_history(session_id, q, final_answer)
                return {
                    "answer": final_answer,
                    "actions": [],
                    "buildings_to_add": [],
                    "buildings_to_remove": [],
                    "clear_comparison": False,
                    "meta": {
                        "mode": "investment_prompt_multiple",
                        "missing_objects": missing_items,
                        "doc_chunks_used": doc_count,
                    },
                }

            if len(investment_requests) > 1:
                analyses = [
                    analyze_property(
                        address=request["address"] or "адрес не указан",
                        price=request["price"],
                        area=request["area"] or 1.0,
                        district=request["district"] or "ЗАО",
                        features=request["features"],
                        T_current=request["T_current"],
                        T_future=request["T_future"],
                        t=request["t"],
                    )
                    for request in investment_requests
                ]
                fallback_answer = self._investment_answer_multi(
                    "Провёл предварительный расчёт инвестиционной привлекательности.",
                    analyses,
                )
                llm_answer = self._invoke_llm(
                    self._investment_result_prompt(q, session_id, analyses, comparison_state)
                )
                final_answer = llm_answer or fallback_answer
                self._append_history(session_id, q, final_answer)
                return {
                    "answer": final_answer,
                    "actions": [],
                    "buildings_to_add": [],
                    "buildings_to_remove": [],
                    "clear_comparison": False,
                    "meta": {"mode": "investment_analysis_multiple", "doc_chunks_used": doc_count},
                }

            investment_request = investment_requests[0]
            missing = self._investment_missing_fields(investment_request)
            if missing:
                missing_items = [
                    {
                        "address": investment_request.get("address")
                        or investment_request.get("district")
                        or "объект",
                        "missing": missing,
                    }
                ]
                if comparison_state or investment_request.get("address"):
                    fallback_answer = self._investment_qualitative_answer(
                        investment_requests,
                        missing_items,
                        comparison_state,
                    )
                    llm_answer = self._invoke_llm(
                        self._investment_missing_prompt(
                            q,
                            session_id,
                            investment_requests,
                            missing_items,
                            comparison_state,
                        )
                    )
                    final_answer = llm_answer or fallback_answer
                else:
                    final_answer = self._investment_answer(
                        "Для расчёта инвестиционной привлекательности нужно ещё данных.",
                        {},
                        missing,
                    )
                self._append_history(session_id, q, final_answer)
                return {
                    "answer": final_answer,
                    "actions": [],
                    "buildings_to_add": [],
                    "buildings_to_remove": [],
                    "clear_comparison": False,
                    "meta": {"mode": "investment_prompt", "missing": missing, "doc_chunks_used": doc_count},
                }

            analysis = analyze_property(
                address=investment_request["address"] or "адрес не указан",
                price=investment_request["price"],
                area=investment_request["area"] or 1.0,
                district=investment_request["district"] or "ЗАО",
                features=investment_request["features"],
                T_current=investment_request["T_current"],
                T_future=investment_request["T_future"],
                t=investment_request["t"],
            )
            fallback_answer = self._investment_answer(
                "Провёл предварительный расчёт инвестиционной привлекательности.",
                analysis,
                [],
            )
            llm_answer = self._invoke_llm(
                self._investment_result_prompt(q, session_id, [analysis], comparison_state)
            )
            final_answer = llm_answer or fallback_answer
            if comparison_state:
                final_answer += "\n\nЕсли нужно, могу сравнить инвестиционную привлекательность этого объекта с другими домами в сравнении."
            self._append_history(session_id, q, final_answer)
            return {
                "answer": final_answer,
                "actions": [],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "investment_analysis", "doc_chunks_used": doc_count},
            }

        if compare_intent and addresses:
            matched, missed = self._match_addresses(addresses)
            if matched:
                buildings_payload = [self._to_compare_payload(item) for item in matched]
                action_note = self._comparison_brief(matched, missed)
                fallback_answer = (
                    self._comparison_analysis_answer(matched, missed, added_count=len(matched))
                    if analysis_intent
                    else action_note
                )
                if analysis_intent:
                    final_answer = fallback_answer
                else:
                    llm_answer = self._invoke_llm(
                        self._comparison_prompt(
                            q,
                            session_id,
                            comparison_state,
                            matched,
                            doc_context,
                            action_note + "\nДействие уже выполнено: эти дома подготовлены к добавлению в сравнение.",
                        )
                    )
                    final_answer = llm_answer or fallback_answer
                if "инвестицион" not in final_answer.lower():
                    final_answer = final_answer.rstrip() + (
                        "\n\nЕсли хотите, могу дополнительно рассчитать инвестиционную привлекательность одного из этих домов."
                    )
                actions.append(SiteAction(type="link", label="Открыть сравнение", url="/diffs.html"))
                self._append_history(session_id, q, final_answer)
                return {
                    "answer": final_answer,
                    "actions": [action.__dict__ for action in actions],
                    "buildings_to_add": buildings_payload,
                    "buildings_to_remove": [],
                    "clear_comparison": False,
                    "meta": {
                        "mode": "comparison_add",
                        "analysis_requested": analysis_intent,
                        "matched_count": len(matched),
                        "missed_count": len(missed),
                        "doc_chunks_used": doc_count,
                    },
                }

            answer = (
                "Не смог найти дома по указанным адресам. "
                "Уточните адреса в формате: «ул. Примерная, 10; ул. Вторая, 25»."
            )
            self._append_history(session_id, q, answer)
            return {
                "answer": answer,
                "actions": [],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "comparison_not_found", "doc_chunks_used": doc_count},
            }

        if (compare_intent or analysis_intent) and comparison_state:
            analysis_buildings = self._choose_buildings_for_analysis(comparison_state, [])
            brief = self._comparison_brief(analysis_buildings, [])
            fallback_answer = (
                self._comparison_analysis_answer(analysis_buildings, [])
                if analysis_intent
                else brief
            )
            if analysis_intent:
                final_answer = fallback_answer
            else:
                llm_answer = self._invoke_llm(
                    self._comparison_prompt(
                        q,
                        session_id,
                        comparison_state,
                        analysis_buildings,
                        doc_context,
                        "Используй текущий список сравнения без добавления новых домов.",
                    )
                )
                final_answer = llm_answer or fallback_answer
            if "инвестицион" not in final_answer.lower():
                final_answer = final_answer.rstrip() + (
                    "\n\nЕсли хотите, могу дополнительно рассчитать инвестиционную привлекательность одного из этих домов."
                )
            actions.append(SiteAction(type="link", label="Открыть сравнение", url="/diffs.html"))
            self._append_history(session_id, q, final_answer)
            return {
                "answer": final_answer,
                "actions": [action.__dict__ for action in actions],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {
                    "mode": "comparison_existing",
                    "analysis_requested": analysis_intent,
                    "compared_count": len(analysis_buildings),
                    "doc_chunks_used": doc_count,
                },
            }

        if SITE_QA_PATTERN.search(q):
            llm_answer = self._invoke_llm(self._site_prompt(q, session_id, comparison_state, doc_context))
            final_answer = llm_answer or self._fallback_document_answer(q, comparison_state, top_n)
            if "сравнен" in normalized_q or comparison_state:
                actions.append(SiteAction(type="link", label="Перейти к сравнению", url="/diffs.html"))
            self._append_history(session_id, q, final_answer)
            return {
                "answer": final_answer,
                "actions": [action.__dict__ for action in actions],
                "buildings_to_add": [],
                "buildings_to_remove": [],
                "clear_comparison": False,
                "meta": {"mode": "site_qa", "doc_chunks_used": doc_count},
            }

        llm_answer = self._invoke_llm(
            self._document_prompt(q, session_id, comparison_state, doc_context)
        )
        final_answer = llm_answer or self._fallback_document_answer(q, comparison_state, top_n)
        self._append_history(session_id, q, final_answer)
        return {
            "answer": final_answer,
            "actions": [],
            "buildings_to_add": [],
            "buildings_to_remove": [],
            "clear_comparison": False,
            "meta": {"mode": "document_qa", "doc_chunks_used": doc_count},
        }
