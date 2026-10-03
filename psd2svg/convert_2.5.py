from psd2svg import SVGDocument
from psd_tools import PSDImage

# baumscheibe2.5.psd (2026-10-03): identical layer tree to 2.4 except the
# DA (dynamic accumulator) icon — f_dynacc is now hidden and a new visible
# layer "DAnew" replaces it at the same spot — and the unused "plantlist"
# badge group is hidden. Visibility is final in the PSD, so a plain
# conversion (hidden layers skipped) is correct, same as convert_2.4.py.
psdimage = PSDImage.open("/root/pdk/temp/baumscheibe2.5.psd")
document = SVGDocument.from_psd(psdimage, enable_title=True)
document.save("baumscheibe2.5.svg", image_format="png")
