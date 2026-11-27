"""1 kg filament spool (axis along three.js Z). Material "Filament" is recoloured at runtime."""
from parts import spool

AO = dict(size=512, samples=32, distance=0.05)
PREVIEW = dict(angle=40, elev=18)


def build():
    return spool("spool")
