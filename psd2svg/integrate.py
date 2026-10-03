"""
Integrates the freshly re-converted (complete, hidden-layers-fixed) SVG as
the new baumscheibe-template.svg, carrying over the 5 elements that were
manually added to the production template after conversion (they aren't
PSD layers at all, so a fresh psd2svg run can't produce them):
  - commonName / latinName: real <text> placeholders already present in the
    fresh conversion (from the PSD's own "COMMON NAME"/"Botanical name"
    type layers) at the exact same x/y/font — just missing inkscape:label,
    added here by exact content+position match.
  - heightM / widthM / climateZone: not PSD layers at all (manually added
    in Inkscape after the original conversion) — copied verbatim from the
    current production template.
"""
from lxml import etree

INK_NS = "http://www.inkscape.org/namespaces/inkscape"
SVG_NS = "http://www.w3.org/2000/svg"
NSMAP = {"svg": SVG_NS, "inkscape": INK_NS}
# Without this, lxml serializes freshly-set inkscape:label attributes (below)
# under an auto-generated "ns0:" prefix instead of reusing the document's own
# "inkscape:" binding — register_namespace only affects the process that
# calls it, and add_inkscape_labels.py's registration doesn't carry over
# since it runs as a separate script invocation.
etree.register_namespace("inkscape", INK_NS)

import sys

VERSION = sys.argv[1] if len(sys.argv) > 1 else "2.5"

parser = etree.XMLParser(huge_tree=True)

new_tree = etree.parse(f"baumscheibe{VERSION}_labeled.svg", parser)
new_root = new_tree.getroot()

old_tree = etree.parse("../pwa/public/baumscheibe-template.svg", parser)
old_root = old_tree.getroot()

# 1) Label the existing commonName/latinName placeholder text by exact
#    content + position match (verified identical to the old template's
#    elements before this script runs).
LABEL_TARGETS = {
    "COMMON NAME": ("commonName", "657.31", "680.25"),
    "Botanical name": ("latinName", "819.26", "522.75"),
}
labeled = set()
for el in new_root.iter(f"{{{SVG_NS}}}text"):
    text = (el.text or "").strip()
    if text in LABEL_TARGETS:
        label, x, y = LABEL_TARGETS[text]
        if el.get("x") == x and el.get("y") == y:
            el.set(f"{{{INK_NS}}}label", label)
            labeled.add(label)
assert labeled == {"commonName", "latinName"}, f"Expected to label both, got {labeled}"

# 2) Copy heightM/widthM/climateZone <text> elements verbatim from the old
#    template (not PSD layers, so a fresh conversion never produces them).
copied = []
for name in ("heightM", "widthM", "climateZone"):
    matches = [el for el in old_root.iter() if el.get(f"{{{INK_NS}}}label") == name]
    assert len(matches) == 1, f"{name}: expected exactly 1 in old template, found {len(matches)}"
    # deepcopy so we don't mutate the old tree while iterating it
    import copy
    new_root.append(copy.deepcopy(matches[0]))
    copied.append(name)

print(f"Labeled: {sorted(labeled)}")
print(f"Copied from old template: {copied}")

new_tree.write(
    f"baumscheibe{VERSION}_integrated.svg",
    xml_declaration=True,
    encoding="UTF-8",
    standalone=False,
)
print(f"Wrote baumscheibe{VERSION}_integrated.svg")
