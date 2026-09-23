# Tiedown

Wind, uplift and foundation screening for small structures. v1 covers **sheds** and **fences**
(foundation, uplift, overturning, sliding, anchorage, post embedment), a **component rating check**
(doors, panels, roof products against Florida Product Approval / Miami-Dade NOA pressures), and a
**printable calculation package**.

Default jurisdiction is Broward County (HVHZ). Miami-Dade and other Florida counties are selectable.

No build step, no dependencies. Node 18+.

## Run locally

    npm start            # http://localhost:3000, no PIN
    APP_PIN=long-pin npm start
    npm test             # 21 regression tests

## Deploy (PIN-gated)

The PIN is checked by `server.js`, so files are not sent without a valid session cookie.
A PIN in front-end JavaScript on a static site would not be access control; anyone could read it
in the page source.

On Render: New > Web Service, point at this repo (`render.yaml` is included), then set the
`APP_PIN` environment variable. Use 8+ characters. `APP_SECRET` is generated automatically.

- Session cookie: HttpOnly, SameSite=Lax, HMAC signed, 30 days.
- 5 wrong PINs from one IP locks that IP for 15 minutes.
- Pages carry noindex headers; `/robots.txt` disallows all.
- `/logout` clears the session. `/healthz` is open (health check only).
- Link your app library to the deployed service URL. It is a normal web page behind the PIN.

Limits: this is a single shared PIN, appropriate for a personal in-development tool, not a user system.

## Privacy

All project data stays in the browser (localStorage plus files you save). Nothing is sent to the
server. Report header fields (project, owner, address, preparer) are optional and blank by default.
"Clear identifying data" blanks them. The built-in sample project is fictional.

## Code basis and status

| Item | Status |
|---|---|
| FBC 7th (2020) | ASCE 7-16 pack matches |
| FBC 8th (2023, enforced now) | Runs on ASCE 7-16 pack; **screening only** until the adopted ASCE 7 edition is confirmed |
| FBC 9th (effective 31 Dec 2026) | Runs on ASCE 7-16 pack; **screening only** |
| ASCE 7-22 pack | Not loaded. The engine is pack-driven; add a second pack in `codedata.js` |
| Broward Vult (RC I/II/III = 156/170/180) | From secondary sources. Confirm with the reviewer |
| Miami-Dade Vult (165/175/185) | From secondary sources. Confirm |

Coefficient sets are tagged in code and in the report:

- **Reference-matched** (reproduced against a sealed ASCE 7-16 calc): Exposure C Kz/qh, wall MWFRS Cp,
  flat-roof suction h/L ≤ 0.5, wall C&C zones 4/5, gable roof C&C 7-20 degrees.
- **Unverified, check against your copy of the standard:** Exposure B/D constants and GCpi 0.18,
  flat-roof suction at h/L ≥ 1, sloped-roof envelope floor (0.7), fence Cf table (s/h = 1), presumptive
  soil hints.

The report is stamped "SCREENING REPORT - NOT A SEALED CALCULATION" whenever the edition pack does not
match or unverified data is used. Custom GCp curves (Shed page) let you enter roof coefficients for
roof types the built-in table does not cover.

## Method summary

- qh = 0.00256 Kz Kzt Kd Ke V², ASD = 0.6 × ultimate. Combinations D+L, D+0.6W, 0.6D+0.6W.
- MWFRS: wall Cp 0.8 / -0.7 / leeward by L/B; roof suction integrated strip by strip with GCpi;
  minimum 16 / 8 psf cases.
- C&C: log-area GCp curves per zone, 9.6 psf ASD minimum.
- Shed: uplift vs 0.6D, overturning about the leeward toe, sliding (friction + passive), bearing,
  anchor tension/shear, roof-framing connection uplift, required foundation weight.
- Fence: solid-wall Cf with porosity reduction (only for openness ≥ 0.7), IBC 1807.3.2.1 non-constrained
  pole embedment solved by bisection, post bending check, spacing options.

## Not in v1

Pergolas, arbors, attached roofs, ASCE 7-22 coefficients, mono/flat roof built-ins, oblique-wind fence end-post factor.

## Disclaimer

A calculation aid. Results must be reviewed by the responsible design professional and confirmed
against the adopted code editions and the plans examiner.
