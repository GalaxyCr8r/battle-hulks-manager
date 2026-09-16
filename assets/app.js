/* Battle Hulks unit manager: roster, point-cost model, and unit builder. */
(function () {
  "use strict";

  var UNITS = window.BH_UNITS || [];
  var MODEL = window.BH_MODEL || {};
  var C = MODEL.coefficients || {};
  var BAND_CLASS = ["g", "y", "r"];
  var BAND_NAME = ["Green", "Yellow", "Red"];

  var WEAPONS = {
    "AHM":           { damage: "kinetic", ammo: false, salvo: false, split: true },
    "Cannon":        { damage: "kinetic", ammo: true,  salvo: false, split: false },
    "Chain Gun":     { damage: "kinetic", ammo: true,  salvo: false, split: false },
    "Missile":       { damage: "kinetic", ammo: false, salvo: false, split: false },
    "Rocket":        { damage: "kinetic", ammo: false, salvo: true,  split: false },
    "Rotary Cannon": { damage: "kinetic", ammo: false, salvo: false, split: false },
    "Laser Cannon":  { damage: "energy",  ammo: false, salvo: false, split: false },
    "Plasma Gun":    { damage: "energy",  ammo: false, salvo: false, split: false },
    "Plasma Cannon": { damage: "energy",  ammo: false, salvo: false, split: false }
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- cost model ----------
     Ported from the least-squares fit in tools/fit_model.py. A weapon's
     attack value may read "3/2" (AHM ground/air detonation); the ground
     figure is the one that drives cost. */

  function bandValue(s) {
    var head = String(s).split("/")[0];
    var n = parseInt(head, 10);
    return isNaN(n) ? 0 : n;
  }

  function weaponFeatures(equipment) {
    var out = { bands: 0, energy: 0, range: 0 };
    (equipment || []).forEach(function (e) {
      if (!e.atk) return;
      var sum = e.atk.reduce(function (a, b) { return a + bandValue(b); }, 0);
      var mult = e.weaponType === "Rocket" ? (MODEL.rocketSalvoMultiplier || 4) : 1;
      out.bands += sum * mult;
      if (e.damage === "energy") out.energy += sum;
      out.range += (e.range && e.range.max) || 0;
    });
    return out;
  }

  function costBreakdown(u) {
    var w = weaponFeatures(u.equipment);
    var spec = (u.equipment || []).reduce(function (a, e) { return a + (e.armorPoints || 0); }, 0);
    var atkS = (u.atk || []).reduce(function (a, b) { return a + (+b || 0); }, 0);
    var rows = [
      { label: "Attack (sum of bands)", detail: atkS, cost: atkS * C.atkS },
      { label: "Defense (green)", detail: (u.def || [])[0] || 0, cost: ((u.def || [])[0] || 0) * C.defG },
      { label: "Structure", detail: u.structure || 0, cost: (u.structure || 0) * C.strv },
      { label: "Weapon dice", detail: w.bands, cost: w.bands * C.wB },
      { label: "Energy premium", detail: w.energy, cost: w.energy * C.wE },
      { label: "Weapon range", detail: w.range + '"', cost: w.range * C.wR },
      { label: "Hovering", detail: (u.abilities || []).length ? "yes" : "no", cost: ((u.abilities || []).length ? 1 : 0) * C.hover },
      { label: "Specialty armor", detail: spec + " pts", cost: spec * (MODEL.specialtyArmorPerPoint || 2.5) }
    ];
    var raw = rows.reduce(function (a, r) { return a + r.cost; }, 0);
    var step = MODEL.roundTo || 5;
    return { rows: rows, raw: raw, points: Math.round(raw / step) * step };
  }

  /* ---------- roster ---------- */

  function bandStrip(label, values) {
    return el("div", { class: "statline" }, [el("span", { class: "label", text: label })].concat(
      values.map(function (v, i) { return el("span", { class: "band " + BAND_CLASS[i], text: String(v) }); })
    ));
  }

  function chip(label, value) {
    return el("span", { class: "chip", html: label + " <b>" + value + "</b>" });
  }

  function weaponLabel(e) {
    var bits = [];
    if (e.range) {
      bits.push(e.range.min ? e.range.min + "-" + e.range.max + '"' : e.range.max + '"');
    }
    if (e.ammo) bits.push(e.ammo);
    if (e.count) bits.push("x" + e.count);
    return bits.join(" · ");
  }

  function unitCard(u) {
    var head = el("header", {}, [
      el("div", {}, [
        el("h4", { text: u.name }),
        el("span", { class: "size", text: u.size + " " + (u.unitType === "tank" ? "tank" : "hulk") })
      ]),
      el("span", { class: "pts", text: u.points + " pts" })
    ]);

    var body = el("div", { class: "unit-body" }, [
      bandStrip("DEF", u.def),
      bandStrip("ATK", u.atk),
      bandStrip("MOV", u.mov),
      el("div", { class: "chips" }, [
        chip("FUEL", u.fuel),
        chip("HEAT", "H" + u.maxHeat),
        chip("ARM", u.armor),
        chip("STR", u.structure)
      ])
    ]);

    var equip = el("div", { class: "equip" });
    (u.equipment || []).forEach(function (e) {
      var name = el("div", { class: "equip-name" }, [
        document.createTextNode(e.name),
        el("small", { text: weaponLabel(e) || (e.armorPoints ? e.armorPoints + " pts" : "") })
      ]);
      var row = el("div", { class: "equip-row" }, [name]);
      if (e.atk) {
        e.atk.forEach(function (v, i) {
          row.appendChild(el("span", { class: "band " + BAND_CLASS[i], text: v }));
        });
      }
      equip.appendChild(row);
    });
    (u.abilities || []).forEach(function (a) {
      equip.appendChild(el("div", { class: "ability", html: "<b>" + a.name + ":</b> " + a.text }));
    });
    body.appendChild(equip);

    return el("article", { class: "unit-card" }, [head, body]);
  }

  function renderRoster() {
    var host = document.getElementById("roster");
    host.innerHTML = "";
    UNITS.forEach(function (u) { host.appendChild(unitCard(u)); });
  }

  /* ---------- model validation table ---------- */

  function renderModel() {
    var coefHost = document.getElementById("coefficients");
    var labels = {
      atkS: "Per point of Attack (summed across all three bands)",
      defG: "Per point of green-band Defense",
      strv: "Per point of Structure",
      wB: "Per attack die across a weapon's bands (rockets count x4 for salvo fire)",
      wE: "Extra per attack die on energy weapons",
      wR: 'Per inch of maximum range, totalled across weapons',
      hover: "Hovering (ignores difficult terrain)"
    };
    var rows = Object.keys(C).map(function (k) {
      return el("tr", {}, [
        el("td", { text: k }),
        el("td", { class: "num", text: C[k].toFixed(3) }),
        el("td", { text: labels[k] || "" })
      ]);
    });
    rows.push(el("tr", {}, [
      el("td", { text: "specialty armor" }),
      el("td", { class: "num", text: (MODEL.specialtyArmorPerPoint || 2.5).toFixed(3) }),
      el("td", { text: "Per point of ablative/reactive armor — fixed from rulebook 9.0 (5 pts buys 2)" })
    ]));
    coefHost.innerHTML = "";
    rows.forEach(function (r) { coefHost.appendChild(r); });

    var valHost = document.getElementById("validation");
    valHost.innerHTML = "";
    var worst = 0;
    UNITS.forEach(function (u) {
      var b = costBreakdown(u);
      var diff = b.points - u.points;
      var resid = b.raw - u.points;
      worst = Math.max(worst, Math.abs(resid));
      valHost.appendChild(el("tr", {}, [
        el("td", { text: u.name }),
        el("td", { class: "num", text: String(u.points) }),
        el("td", { class: "num", text: b.raw.toFixed(2) }),
        el("td", { class: "num", text: String(b.points) }),
        el("td", { class: "num " + (diff === 0 ? "pos" : "neg"), text: diff === 0 ? "exact" : (diff > 0 ? "+" : "") + diff })
      ]));
    });
    document.getElementById("worst-resid").textContent = worst.toFixed(2);
  }

  /* ---------- builder ---------- */

  var draft = {
    name: "New Hulk Mk.I",
    unitType: "hulk",
    size: "Medium",
    def: [3, 2, 1],
    atk: [4, 3, 2],
    mov: [6, 5, 4],
    fuel: 8,
    maxHeat: 3,
    armor: 6,
    structure: 6,
    abilities: [],
    equipment: []
  };

  function newWeapon() {
    return { name: "Chain Guns", weaponType: "Chain Gun", damage: "kinetic", range: { min: 0, max: 12 }, atk: ["3", "3", "2"] };
  }

  function bindNumber(input, get, set) {
    input.value = get();
    input.addEventListener("input", function () {
      var v = parseInt(input.value, 10);
      set(isNaN(v) ? 0 : v);
      refreshCost();
    });
  }

  function bandFieldset(legendText, key) {
    var inputs = draft[key].map(function (v, i) {
      var inp = el("input", { type: "number", min: "0", max: "20", class: BAND_CLASS[i], "aria-label": legendText + " " + BAND_NAME[i] });
      bindNumber(inp, function () { return draft[key][i]; }, function (n) { draft[key][i] = n; });
      return inp;
    });
    return el("div", { class: "field" }, [
      el("label", { text: legendText + " (green / yellow / red)" }),
      el("div", { class: "band-inputs" }, inputs)
    ]);
  }

  function weaponRow(w, index) {
    var spec = WEAPONS[w.weaponType] || WEAPONS["Cannon"];

    var typeSel = el("select", {});
    Object.keys(WEAPONS).forEach(function (t) {
      typeSel.appendChild(el("option", { value: t, text: t, selected: t === w.weaponType ? "selected" : null }));
    });
    typeSel.value = w.weaponType;
    typeSel.addEventListener("change", function () {
      w.weaponType = typeSel.value;
      w.damage = WEAPONS[w.weaponType].damage;
      if (!WEAPONS[w.weaponType].ammo) delete w.ammo;
      if (!WEAPONS[w.weaponType].salvo) delete w.count;
      if (w.name === "" || w.name === undefined) w.name = w.weaponType;
      renderWeapons();
      refreshCost();
    });

    var nameInp = el("input", { type: "text", value: w.name || w.weaponType });
    nameInp.addEventListener("input", function () { w.name = nameInp.value; });

    var minInp = el("input", { type: "number", min: "0", max: "40", value: w.range.min });
    bindNumber(minInp, function () { return w.range.min; }, function (n) { w.range.min = n; });
    var maxInp = el("input", { type: "number", min: "1", max: "40", value: w.range.max });
    bindNumber(maxInp, function () { return w.range.max; }, function (n) { w.range.max = n; });

    var atkInputs = w.atk.map(function (v, i) {
      var inp = el("input", { type: "text", value: v, class: BAND_CLASS[i], "aria-label": "Attack " + BAND_NAME[i] });
      inp.addEventListener("input", function () { w.atk[i] = inp.value; refreshCost(); });
      return inp;
    });

    var fields = [
      el("div", { class: "field" }, [el("label", { text: "Display name" }), nameInp]),
      el("div", { class: "grid3" }, [
        el("div", {}, [el("label", { text: "Weapon type" }), typeSel]),
        el("div", {}, [el("label", { text: "Min range" }), minInp]),
        el("div", {}, [el("label", { text: "Max range" }), maxInp])
      ]),
      el("div", { class: "field" }, [
        el("label", { text: "Attack dice (green / yellow / red)" }),
        el("div", { class: "band-inputs" }, atkInputs)
      ])
    ];

    if (spec.ammo) {
      var ammoSel = el("select", {});
      ["", "Armor Piercing", "Explosive"].forEach(function (a) {
        ammoSel.appendChild(el("option", { value: a, text: a || "(standard)" }));
      });
      ammoSel.value = w.ammo || "";
      ammoSel.addEventListener("change", function () {
        if (ammoSel.value) w.ammo = ammoSel.value; else delete w.ammo;
      });
      fields.push(el("div", { class: "field" }, [el("label", { text: "Ammunition" }), ammoSel]));
    }

    if (spec.salvo) {
      var cntInp = el("input", { type: "number", min: "1", max: "64", value: w.count || 16 });
      if (!w.count) w.count = 16;
      bindNumber(cntInp, function () { return w.count; }, function (n) { w.count = n; });
      fields.push(el("div", { class: "field" }, [el("label", { text: "Rockets carried" }), cntInp]));
    }

    var remove = el("button", { class: "remove", type: "button", title: "Remove weapon", text: "Remove" });
    remove.addEventListener("click", function () {
      draft.equipment.splice(index, 1);
      renderWeapons();
      refreshCost();
    });

    var head = el("div", { class: "weapon-head" }, [
      el("strong", { text: "Weapon " + (index + 1) }),
      remove
    ]);

    return el("div", { class: "weapon-row" }, [head].concat(fields));
  }

  function renderWeapons() {
    var host = document.getElementById("weapons");
    host.innerHTML = "";
    draft.equipment.filter(function (e) { return e.atk; }).forEach(function (w, i) {
      host.appendChild(weaponRow(w, draft.equipment.indexOf(w)));
    });
    if (!draft.equipment.some(function (e) { return e.atk; })) {
      host.appendChild(el("p", { class: "lede", text: "No weapons yet — add one to price this unit." }));
    }
  }

  function specialtyArmorPoints(kind) {
    var found = draft.equipment.filter(function (e) { return e.weaponType === kind; })[0];
    return found ? found.armorPoints : 0;
  }

  function setSpecialtyArmor(kind, damage, points) {
    draft.equipment = draft.equipment.filter(function (e) { return e.weaponType !== kind; });
    if (points > 0) {
      draft.equipment.push({ name: kind + " " + points + "pts", weaponType: kind, damage: damage, armorPoints: points });
    }
  }

  function refreshCost() {
    var b = costBreakdown(draft);
    document.getElementById("total-points").childNodes[0].nodeValue = String(b.points);
    document.getElementById("raw-points").textContent = "model output " + b.raw.toFixed(2) + ", rounded to nearest " + (MODEL.roundTo || 5);
    var host = document.getElementById("breakdown");
    host.innerHTML = "";
    b.rows.forEach(function (r) {
      host.appendChild(el("tr", {}, [
        el("td", { text: r.label }),
        el("td", { class: "num", text: String(r.detail) }),
        el("td", { class: "num", text: r.cost.toFixed(1) })
      ]));
    });
  }

  function buildForm() {
    var host = document.getElementById("builder-form");
    host.innerHTML = "";

    var nameInp = el("input", { type: "text", value: draft.name });
    nameInp.addEventListener("input", function () { draft.name = nameInp.value; });

    var typeSel = el("select", {});
    [["hulk", "Hulk"], ["tank", "Tank"]].forEach(function (p) {
      typeSel.appendChild(el("option", { value: p[0], text: p[1] }));
    });
    typeSel.value = draft.unitType;
    typeSel.addEventListener("change", function () { draft.unitType = typeSel.value; });

    var sizeSel = el("select", {});
    ["Light", "Medium", "Heavy"].forEach(function (s) {
      sizeSel.appendChild(el("option", { value: s, text: s }));
    });
    sizeSel.value = draft.size;
    sizeSel.addEventListener("change", function () { draft.size = sizeSel.value; });

    var identity = el("fieldset", {}, [
      el("legend", { text: "Identity" }),
      el("div", { class: "grid3" }, [
        el("div", {}, [el("label", { text: "Unit name" }), nameInp]),
        el("div", {}, [el("label", { text: "Class" }), typeSel]),
        el("div", {}, [el("label", { text: "Size" }), sizeSel])
      ])
    ]);

    var fuelInp = el("input", { type: "number", min: "0", max: "20" });
    bindNumber(fuelInp, function () { return draft.fuel; }, function (n) { draft.fuel = n; });
    var heatInp = el("input", { type: "number", min: "1", max: "10" });
    bindNumber(heatInp, function () { return draft.maxHeat; }, function (n) { draft.maxHeat = n; });
    var armInp = el("input", { type: "number", min: "0", max: "20" });
    bindNumber(armInp, function () { return draft.armor; }, function (n) { draft.armor = n; });
    var strInp = el("input", { type: "number", min: "1", max: "20" });
    bindNumber(strInp, function () { return draft.structure; }, function (n) { draft.structure = n; });

    var stats = el("fieldset", {}, [
      el("legend", { text: "Chassis" }),
      el("div", { class: "grid3" }, [
        bandFieldset("DEF", "def"),
        bandFieldset("ATK", "atk"),
        bandFieldset("MOV", "mov")
      ]),
      el("div", { class: "grid4" }, [
        el("div", {}, [el("label", { text: "Fuel" }), fuelInp]),
        el("div", {}, [el("label", { text: "Max heat" }), heatInp]),
        el("div", {}, [el("label", { text: "Armor" }), armInp]),
        el("div", {}, [el("label", { text: "Structure" }), strInp])
      ])
    ]);

    var addBtn = el("button", { class: "action", type: "button", text: "Add weapon" });
    addBtn.addEventListener("click", function () {
      draft.equipment.push(newWeapon());
      renderWeapons();
      refreshCost();
    });

    var weapons = el("fieldset", {}, [
      el("legend", { text: "Equipment" }),
      el("div", { id: "weapons" }),
      addBtn
    ]);

    var ablInp = el("input", { type: "number", min: "0", max: "6", value: specialtyArmorPoints("Ablative Armor") });
    ablInp.addEventListener("input", function () {
      setSpecialtyArmor("Ablative Armor", "energy", parseInt(ablInp.value, 10) || 0);
      refreshCost();
    });
    var reaInp = el("input", { type: "number", min: "0", max: "6", value: specialtyArmorPoints("Reactive Armor") });
    reaInp.addEventListener("input", function () {
      setSpecialtyArmor("Reactive Armor", "kinetic", parseInt(reaInp.value, 10) || 0);
      refreshCost();
    });
    var hoverBox = el("input", { type: "checkbox" });
    hoverBox.checked = draft.abilities.length > 0;
    hoverBox.addEventListener("change", function () {
      draft.abilities = hoverBox.checked
        ? [{ name: "Hovering", text: "This unit ignores difficult terrain." }]
        : [];
      refreshCost();
    });

    var upgrades = el("fieldset", {}, [
      el("legend", { text: "Upgrades & abilities" }),
      el("div", { class: "grid3" }, [
        el("div", {}, [el("label", { text: "Ablative armor (pts)" }), ablInp]),
        el("div", {}, [el("label", { text: "Reactive armor (pts)" }), reaInp]),
        el("div", {}, [el("label", { text: "Hovering" }), hoverBox])
      ])
    ]);

    host.appendChild(identity);
    host.appendChild(stats);
    host.appendChild(weapons);
    host.appendChild(upgrades);
    renderWeapons();
  }

  function exportJSON() {
    var b = costBreakdown(draft);
    var out = JSON.parse(JSON.stringify(draft));
    out.points = b.points;
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: draft.name.replace(/[^\w.-]+/g, "_") + ".json" });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function loadUnit(u) {
    draft = JSON.parse(JSON.stringify(u));
    delete draft.id;
    delete draft.points;
    if (!draft.abilities) draft.abilities = [];
    buildForm();
    refreshCost();
  }

  /* ---------- tabs ---------- */

  function initTabs() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("nav button"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          var on = b === btn;
          b.setAttribute("aria-selected", on ? "true" : "false");
          document.getElementById(b.dataset.tab).hidden = !on;
        });
      });
    });
  }

  function initLoader() {
    var sel = document.getElementById("load-unit");
    sel.appendChild(el("option", { value: "", text: "Start from scratch" }));
    UNITS.forEach(function (u, i) {
      sel.appendChild(el("option", { value: String(i), text: u.name + " (" + u.points + " pts)" }));
    });
    sel.addEventListener("change", function () {
      if (sel.value === "") return;
      loadUnit(UNITS[parseInt(sel.value, 10)]);
    });
    document.getElementById("export").addEventListener("click", exportJSON);
  }

  renderRoster();
  renderModel();
  buildForm();
  refreshCost();
  initTabs();
  initLoader();
})();
