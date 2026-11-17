from __future__ import annotations

import math
from datetime import date, datetime

import numpy as np
import pandas as pd


def jsonable(o):
    """Convert numpy / pandas values to JSON-safe Python values (NaN and inf become null)."""
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        f = float(o)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(o, (pd.Timestamp, datetime, date)):
        return o.isoformat()[:10] if isinstance(o, (pd.Timestamp, date)) and not isinstance(o, datetime) else o.isoformat()
    if o is pd.NaT:
        return None
    return o
