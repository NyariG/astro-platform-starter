"""A szolgáltatás gyökerét a sys.path-ra teszi, hogy az app/converter importálható legyen."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
