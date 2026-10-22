# Source verification

Source: `CHALLENGE_M13_AAA___LITE_-_TR_2026.pdf`, one page, headed “CHALLENGE M13 AAA ÉLITE” and “M13 AAA Elite Mixte”. The supplied tournament dates are November 12–15, 2026. The printed weekday/date combinations agree with 2026. The page prints no scores or results.

SHA-256: `e4474a7264d95f3a1fb534f6c0e2c9f6add9e1948dad0900ec2a9f9a7ae6fe61`

An independent visual transcription of all 45 games was compared with `data/games.csv` and `data/teams.csv`. All 45 game numbers, official IDs, dates, start times, venue labels, ordered participant slots, and winner/loser references matched. The two identical team names remain separate opening slots. Display-stage labels such as “Crossover”, “Qualification”, and “Playoff” are app navigation labels; only the semifinal/final captions are explicitly printed on the source.

## Limits in the published page

- **Game #34-741037:** Friday November 13, 18:45, CL-MONGRAIN. Its first participant line is blank. Its second is “Gagnant #22-741025”. The box is labelled “Si Nécessaire”. The page supplies no condition for playing this game, no identity for its blank opponent, and no rule for advancing the winner of #22 when #34 is unnecessary. Game #38 explicitly takes the winner of #34. Any opponent, conditional activation, or direct advancement choice entered in the app is a scenario assumption, not a verified tournament rule.
- **SÉLECT DU NORD:** printed twice, against CANAM BEAUCE-APPALACHES in #9 and against ALBATROS in #11. The page does not distinguish two squads or explain whether this is a duplication error. Separate internal IDs preserve the published slots without asserting that one team can occupy both.
- The page supplies no game duration, overtime or shootout procedure, tie-breaking rules, home/away designation, or general elimination-format statement. Ordered participant slots are transcribed as printed; they do not establish home/away status. A side selected as winner is an explicit scenario result. Equal score values alone cannot establish the winner.
- Venue labels are retained verbatim. In particular, #27 and #31 say `COL-VIDEO-A`; #29 says `C-VIDEOTRON`. No physical address or venue equivalence is inferred.
- A team with no outgoing printed path after a loss has no further scheduled route in this document. The app should not treat that observation as a separately verified tournament regulation.

## Lions Lac St-Louis routes

The Lions start in **#6, Thursday November 12 at 11:45, J-G-TALBOT**, against FORESTIERS A-T. Their four printed structural branches are below. After each named branch choice, all remaining advances shown require wins.

1. Win #6, then win #15: **6 → 15 → 26 → 36 → 40 → 44 → 45**.
2. Win #6, then lose #15: **6 → 15 → 25 → 35 → 39 → 43 → 45**.
3. Lose #6, then lose #22: **6 → 22 → 33 → 41 → 43 → 45**.
4. Lose #6, then win #22: **6 → 22 → 34 (conditional, unresolved opponent) → 38 → 42 → 44 → 45**. This sequence is the printed dependency route through #34; it does not imply that #34 is required or that a bypass exists.

The final #45 is Sunday November 15 at 14:00, J-G-TALBOT. Both semifinals start Sunday at 09:00: #43 at J-G-TALBOT and #44 at CL-MONGRAIN.

## Complete schedule and routing audit

`Wn` = winner of game n. `Ln` = loser of game n. Left/right slots follow the document’s printed order. Dates and start times are transcribed as printed; the page specifies no time zone or match-end times.

| Game | Official ID | Date | Time | Venue | First printed slot | Second printed slot |
|---:|---:|---|---|---|---|---|
| 1 | 741004 | Thu Nov 12 | 08:15 | CL-MONGRAIN | ROCKET JR LAVAL | SEIGNEURS DES MILLE-ILES |
| 2 | 741005 | Thu Nov 12 | 08:45 | J-G-TALBOT | NOIR ET OR DE MORTAGNE | CASCADES ÉLITE |
| 3 | 741006 | Thu Nov 12 | 09:45 | CL-MONGRAIN | AS QUÉBEC | COLLEGE FRANCAIS |
| 4 | 741007 | Thu Nov 12 | 10:15 | J-G-TALBOT | VERT & NOIR DE L'ÉCOLE | MONTRÉAL ÉLITE |
| 5 | 741008 | Thu Nov 12 | 11:15 | CL-MONGRAIN | PIONNIERS LANAUDIÈRE | BLIZZARD SSF |
| 6 | 741009 | Thu Nov 12 | 11:45 | J-G-TALBOT | LIONS LAC ST-LOUIS | FORESTIERS A-T |
| 7 | 741010 | Thu Nov 12 | 12:45 | CL-MONGRAIN | CORSAIRES POINTE-LÉVY | DYNAMIQUES CCL |
| 8 | 741011 | Thu Nov 12 | 13:15 | J-G-TALBOT | CONQUÉRANTS | HARFANGS SHERBROOKE |
| 9 | 741012 | Thu Nov 12 | 14:15 | CL-MONGRAIN | CANAM BEAUCE-APPALACHES | SÉLECT DU NORD |
| 10 | 741013 | Thu Nov 12 | 14:45 | J-G-TALBOT | GRENADIERS LAC ST-LOUIS | ESPOIR SAGUENAY LAC |
| 11 | 741014 | Thu Nov 12 | 15:45 | CL-MONGRAIN | ALBATROS | SÉLECT DU NORD |
| 12 | 741015 | Fri Nov 13 | 08:15 | CL-MONGRAIN | L1 | W11 |
| 13 | 741016 | Fri Nov 13 | 08:45 | J-G-TALBOT | L2 | W10 |
| 14 | 741017 | Thu Nov 12 | 16:15 | J-G-TALBOT | L3 | W5 |
| 15 | 741018 | Thu Nov 12 | 19:30 | CL-MONGRAIN | L4 | W6 |
| 16 | 741019 | Fri Nov 13 | 09:45 | CL-MONGRAIN | L10 | W7 |
| 17 | 741020 | Fri Nov 13 | 10:15 | J-G-TALBOT | L9 | W8 |
| 18 | 741021 | Fri Nov 13 | 13:15 | J-G-TALBOT | L7 | W2 |
| 19 | 741022 | Fri Nov 13 | 12:45 | CL-MONGRAIN | L8 | W1 |
| 20 | 741023 | Fri Nov 13 | 11:45 | J-G-TALBOT | L11 | W3 |
| 21 | 741024 | Thu Nov 12 | 17:45 | J-G-TALBOT | L5 | W4 |
| 22 | 741025 | Thu Nov 12 | 17:30 | CL-MONGRAIN | L6 | ESTACADES MAURICIE |
| 23 | 741026 | Sat Nov 14 | 08:45 | CL-MONGRAIN | L13 | W12 |
| 24 | 741027 | Fri Nov 13 | 15:45 | CL-MONGRAIN | L12 | W13 |
| 25 | 741028 | Fri Nov 13 | 14:15 | CL-MONGRAIN | L15 | W14 |
| 26 | 741029 | Fri Nov 13 | 14:45 | J-G-TALBOT | L14 | W15 |
| 27 | 741030 | Fri Nov 13 | 16:15 | COL-VIDEO-A | L17 | W16 |
| 28 | 741031 | Sat Nov 14 | 10:15 | CL-MONGRAIN | L16 | W17 |
| 29 | 741032 | Fri Nov 13 | 19:15 | C-VIDEOTRON | L19 | W18 |
| 30 | 741033 | Sat Nov 14 | 12:00 | CL-MONGRAIN | L18 | W19 |
| 31 | 741034 | Fri Nov 13 | 17:45 | COL-VIDEO-A | L20 | W21 |
| 32 | 741035 | Fri Nov 13 | 17:15 | CL-MONGRAIN | L21 | W20 |
| 33 | 741036 | Fri Nov 13 | 11:15 | CL-MONGRAIN | L22 | W9 |
| 34 | 741037 | Fri Nov 13 | 18:45 | CL-MONGRAIN | Blank in PDF | W22; “Si Nécessaire” |
| 35 | 741038 | Sat Nov 14 | 08:15 | J-G-TALBOT | W25 | W27 |
| 36 | 741039 | Sat Nov 14 | 09:45 | J-G-TALBOT | W24 | W26 |
| 37 | 741040 | Sat Nov 14 | 13:30 | CL-MONGRAIN | W29 | W31 |
| 38 | 741041 | Sat Nov 14 | 11:30 | J-G-TALBOT | W32 | W34 |
| 39 | 741042 | Sat Nov 14 | 13:00 | J-G-TALBOT | W23 | W35 |
| 40 | 741043 | Sat Nov 14 | 15:15 | CL-MONGRAIN | W36 | W28 |
| 41 | 741044 | Sat Nov 14 | 18:30 | CL-MONGRAIN | W37 | W33 |
| 42 | 741045 | Sat Nov 14 | 17:00 | CL-MONGRAIN | W30 | W38 |
| 43 | 741046 | Sun Nov 15 | 09:00 | J-G-TALBOT | W39 | W41 |
| 44 | 741047 | Sun Nov 15 | 09:00 | CL-MONGRAIN | W40 | W42 |
| 45 | 741048 | Sun Nov 15 | 14:00 | J-G-TALBOT | W43 | W44 |
