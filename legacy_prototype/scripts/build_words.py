import gzip
import json
import re
from pathlib import Path
from typing import List, Dict, Set, Optional

SOURCE = Path("/Users/albertopaz/WordOff/data/kaikki-english.jsonl.gz")
OUTPUT = Path("/Users/albertopaz/WordOff/data/words.js")
LIMIT = 50000
ALLOWED_POS = {"noun", "verb", "adj", "adverb"}
BAD_MARKERS = {
    "obsolete",
    "archaic",
    "dated",
    "slang",
    "vulgar",
    "derogatory",
    "offensive",
    "rare",
    "dialect",
    "dialectal",
    "historical",
    "misspelling",
}
SKIP_PREFIXES = (
    "alternative form of",
    "alternative spelling of",
    "misspelling of",
    "obsolete form of",
    "archaic form of",
    "acronym of",
    "initialism of",
    "abbreviation of",
    "form of",
)

word_re = re.compile(r"^[a-z]{3,12}$")


def clean_text(text: str) -> Optional[str]:
    if not text:
        return None
    text = text.strip().replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    return text or None


def has_bad_marker(sense: dict) -> bool:
    markers = []
    for key in ("tags", "labels", "categories"):
        markers.extend(sense.get(key, []) or [])
    for item in markers:
        if not item:
            continue
        lower = str(item).lower()
        if any(bad in lower for bad in BAD_MARKERS):
            return True
    return False


def pick_definition(senses: List[Dict]) -> Optional[str]:
    for sense in senses:
        if has_bad_marker(sense):
            continue
        glosses = sense.get("glosses") or sense.get("raw_glosses") or []
        if not glosses:
            continue
        definition = clean_text(glosses[0])
        if not definition:
            continue
        lower = definition.lower()
        if lower.startswith(SKIP_PREFIXES):
            continue
        if len(definition) > 180:
            continue
        return definition
    return None


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source: {SOURCE}")

    entries: List[Dict[str, str]] = []
    seen: Set[str] = set()

    with gzip.open(SOURCE, "rt", encoding="utf-8") as handle:
        for line in handle:
            if len(entries) >= LIMIT:
                break
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get("lang") != "English":
                continue

            pos = obj.get("pos")
            if pos not in ALLOWED_POS:
                continue

            word = obj.get("word") or ""
            word = word.strip().lower()
            if not word_re.match(word):
                continue
            if word in seen:
                continue

            definition = pick_definition(obj.get("senses") or [])
            if not definition:
                continue

            entries.append({"word": word, "definition": definition})
            seen.add(word)

    OUTPUT.write_text(
        "window.WORDS = " + json.dumps(entries, ensure_ascii=True, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} words to {OUTPUT}")


if __name__ == "__main__":
    main()
