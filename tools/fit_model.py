#!/usr/bin/env python3
"""Fit the point-cost model in data/model.json to the official unit cards.

Battle Hulks ships no construction rules, so the cost of a unit is recovered by
least-squares regression against the ten published Mk.I point values. Every
coefficient is constrained to stay above a small positive floor: an unconstrained
fit reaches zero residuals but assigns negative costs to Armor and Hovering,
which prices the game backwards.

Specialty armor is not fitted. Rulebook section 9.0 sells ablative and reactive
armor at 5 points for 2, so that rate is pinned at 2.5 per point and subtracted
before fitting.

Usage:  python3 tools/fit_model.py [--write]
"""
import argparse
import json
import pathlib

import numpy as np
from scipy.optimize import lsq_linear

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECIALTY_ARMOR_PER_POINT = 2.5
ROCKET_SALVO_MULTIPLIER = 4  # rulebook 7.7: rockets fire in salvos of up to four
ROUND_TO = 5

FEATURES = ["atkS", "defG", "strv", "wB", "wE", "wR", "hover"]
FLOORS = {"atkS": 0.5, "defG": 1.0, "strv": 1.0, "wB": 0.05, "wE": 0.05, "wR": 0.25, "hover": 2.0}


def band_value(text):
    """Leading number of an attack value; '3/2' is AHM ground/air detonation."""
    head = str(text).split("/")[0]
    return int(head) if head.lstrip("-").isdigit() else 0


def features(unit):
    bands = energy = reach = 0
    for item in unit["equipment"]:
        if "atk" not in item:
            continue
        total = sum(band_value(b) for b in item["atk"])
        mult = ROCKET_SALVO_MULTIPLIER if item["weaponType"] == "Rocket" else 1
        bands += total * mult
        if item["damage"] == "energy":
            energy += total
        reach += item["range"]["max"]
    return {
        "atkS": sum(unit["atk"]),
        "defG": unit["def"][0],
        "strv": unit["structure"],
        "wB": bands,
        "wE": energy,
        "wR": reach,
        "hover": 1 if unit.get("abilities") else 0,
        "spec": sum(i.get("armorPoints", 0) for i in unit["equipment"]),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="update data/model.json")
    args = parser.parse_args()

    units = json.loads((ROOT / "data" / "units.json").read_text())["units"]
    rows = [features(u) for u in units]
    published = np.array([u["points"] for u in units], float)
    target = published - SPECIALTY_ARMOR_PER_POINT * np.array([r["spec"] for r in rows])

    design = np.array([[r[f] for f in FEATURES] for r in rows], float)
    floors = np.array([FLOORS[f] for f in FEATURES])
    solution = lsq_linear(design, target, bounds=(floors, np.inf))

    coefficients = dict(zip(FEATURES, solution.x))
    predicted = design @ solution.x + SPECIALTY_ARMOR_PER_POINT * np.array([r["spec"] for r in rows])
    rounded = np.round(predicted / ROUND_TO) * ROUND_TO

    for name, value in coefficients.items():
        print(f"  {name:6s} {value:7.4f}")
    print()
    for unit, card, raw, near in zip(units, published, predicted, rounded):
        flag = "ok" if near == card else "MISS"
        print(f"  {unit['name']:24s} card {card:5.0f}  model {raw:7.2f}  rounded {near:5.0f}  {flag}")
    matched = int((rounded == published).sum())
    print(f"\n  {matched}/{len(units)} exact after rounding, max residual {np.abs(published - predicted).max():.2f}")

    if args.write:
        path = ROOT / "data" / "model.json"
        payload = json.loads(path.read_text())
        payload["coefficients"] = {k: round(float(v), 4) for k, v in coefficients.items()}
        path.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"  wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
