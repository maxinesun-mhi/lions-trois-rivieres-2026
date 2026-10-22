# Lions M13 · Trois-Rivières 2026

A browser-based scenario planner for the Challenge M13 AAA Élite tournament, November 12–15, 2026. It includes all 45 source games, editable results, winner/loser propagation, the Lions' possible routes, schedule tables, a visual bracket, and JPEG/PDF bracket downloads.

This version runs on **GitHub Pages**. Visitors need only a browser; no R installation or server is required. The complete routing audit is included in the planner. The original source PDF is omitted from this public release for privacy.

## Put it online with GitHub Pages

1. Sign in to GitHub and create a **public repository**, for example `lions-trois-rivieres-2026`. A public repository supports the usual free GitHub Pages setup. The published website and repository files will be publicly accessible.
2. Extract the supplied ZIP and upload the **contents** of `lions-github` into the repository's root on its `main` branch. The root must contain `README.md`, `package.json`, `dist/`, `tests/`, `verification/` and **`.github/workflows/pages.yml`**. Do not add an extra enclosing `lions-github` folder.
3. Open the repository's **Settings → Pages** and choose **GitHub Actions** under **Build and deployment → Source**.
4. Open **Actions → Publish tournament planner → Run workflow** and select `main`. Later updates pushed to `main` publish automatically after the checks pass.
5. When the workflow finishes, use the website link in **Settings → Pages** or the deployment summary. For the example repository, the address normally looks like `https://YOUR-USERNAME.github.io/lions-trois-rivieres-2026/`.

**Hidden workflow folder:** `.github` starts with a dot and may be hidden in your file browser. Confirm that `.github/workflows/pages.yml` appears on GitHub after uploading. If your uploader skips it, choose **Add file → Create new file**, enter `.github/workflows/pages.yml` as the filename, and paste the contents of the supplied workflow file. On a Mac, press **Command–Shift–.** in Finder to show hidden files.

If the repository uses a default branch other than `main`, rename the branch to `main` or update the workflow's `branches` setting. Organization policies or an unavailable Pages setting may require the repository owner to enable Actions or Pages.

## Use the planner

Choose a game, select its winner, optionally enter both scores, and apply the result. The Lions path, schedule and bracket update together. Changing an earlier matchup clears incompatible later results. Tied scores still require an explicitly selected winner; the PDF does not specify tie-breaking rules.

Game **#34** remains an explicit scenario choice. Its opponent, activation condition and skipped-game advancement are not supplied by the tournament PDF. The app does not invent those rules.

Each visitor has an independent scenario saved in their own browser when storage is available. Results are not shared or synchronized through GitHub.

To save the filled bracket, open **Visual bracket**, choose the view, then select **Save JPEG** or **Save PDF**. The download contains the whole selected bracket, including parts outside the scroll area, with current teams, winners and scores. The PDF uses one page that preserves the bracket's proportions; zoom in for the full tournament view. The app provides no JSON/CSV/SVG downloads, file restore, or global reset controls. Individual game results can still be changed or cleared in the editor.

The planner does not receive live tournament scores.

## Local preview

Serve the `dist/` directory with a static web server. For example, if Python 3 is installed, run this from the repository folder:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`. Opening `index.html` directly as a file is not supported because the planner loads its bundled schedule as a web resource.

## Checks and source provenance

With Node.js installed, run from the repository folder:

```sh
node --test tests/*.test.mjs
```

There are no JavaScript package dependencies to install. The workflow runs the same checks before publishing. The engine suite contains 84 checks. The independent R parity fixtures cover all 45 games in eight states, including the Lions' championship branches, conditional #34 choices and clearing stale downstream results. A separate comparison preserves the complete ordered schedule, routing slots and team identities.

`dist/source-verification.md` records the complete source audit and its limits. The original one-page tournament PDF is not included in this release. The two printed SÉLECT DU NORD entries retain separate source-slot identities, pending clarification from the organizer.

The compact verified R engine and its CSV inputs are included under `verification/r-reference/` for reproducibility; they are not needed to run or publish the website. To regenerate the committed reference fixtures, install R and its `jsonlite` package, then run:

```sh
Rscript tests/generate-parity.R
node --test tests/*.test.mjs
```

The browser app is in `dist/`. Tests and the optional R reference are outside the published website directory. Only `dist/` is deployed to Pages, although all files in a public repository remain publicly readable.
