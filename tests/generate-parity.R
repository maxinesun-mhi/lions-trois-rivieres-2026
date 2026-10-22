# Regenerate independent online-engine expectations with the verified R engine.
# Run: Rscript tests/generate-parity.R (from this repository directory).
args <- commandArgs(trailingOnly = FALSE)
script <- sub("^--file=", "", args[grepl("^--file=", args)])
if (length(script)) setwd(dirname(dirname(normalizePath(script[1L]))))
stopifnot(requireNamespace("jsonlite", quietly = TRUE))
shiny_path <- normalizePath(file.path("verification", "r-reference"))
source(file.path(shiny_path, "R", "model.R"), encoding = "UTF-8")
tournament <- load_tournament(shiny_path)

snapshot <- function(name, operations, scenario) {
  ev <- evaluate_tournament(tournament, scenario)
  candidates <- lapply(attr(ev, "candidates"), function(x)
    lapply(x, function(values) I(unname(values))))
  list(name = name, operations = operations, scenario = scenario,
       rows = ev, candidates = candidates)
}
empty <- empty_scenario()
cases <- list(snapshot("empty_source_default", list(), empty))

build_branch <- function(name, route, losses = integer(), played34 = FALSE) {
  scenario <- empty_scenario()
  config <- list(kind = "game34", status = if (played34) "played" else "not_needed",
                 opponent = if (played34) "rocket" else "",
                 advance = if (played34) "" else "@winner22")
  scenario <- set_game34(tournament, scenario, config$status,
                         config$opponent, config$advance)
  operations <- list(config)
  visited <- integer()
  for (key in .topological_order(tournament)) {
    n <- as.integer(key)
    if (n == 34L && !played34) next
    row <- evaluate_tournament(tournament, scenario)
    row <- row[row$game_no == n, , drop = FALSE]
    stopifnot(nzchar(row$team_a), nzchar(row$team_b), row$team_a != row$team_b)
    side <- "a"
    if (n %in% route) {
      stopifnot("lions" %in% c(row$team_a, row$team_b))
      lion_side <- if (row$team_a == "lions") "a" else "b"
      side <- if (n %in% losses) if (lion_side == "a") "b" else "a" else lion_side
      visited <- c(visited, n)
    }
    # Include blank scores and explicit tied winners as well as ordinary scores.
    scores <- if (n %% 3L == 0L) c(NA_real_, NA_real_) else
      if (n %% 5L == 0L) c(2, 2) else if (side == "a") c(3, 1) else c(1, 3)
    scenario <- apply_result(tournament, scenario, n, side, scores[1L], scores[2L])
    operations[[length(operations) + 1L]] <- list(kind = "result", game = n,
      side = side, score_a = scores[1L], score_b = scores[2L])
  }
  ev <- evaluate_tournament(tournament, scenario)
  stopifnot(ev$winner[ev$game_no == 45L] == "lions", setequal(visited, route))
  snapshot(name, operations, scenario)
}

cases[[length(cases) + 1L]] <- build_branch("lions_win6_win15",
  c(6L, 15L, 26L, 36L, 40L, 44L, 45L))
cases[[length(cases) + 1L]] <- build_branch("lions_win6_lose15",
  c(6L, 15L, 25L, 35L, 39L, 43L, 45L), losses = 15L)
cases[[length(cases) + 1L]] <- build_branch("lions_lose6_lose22",
  c(6L, 22L, 33L, 41L, 43L, 45L), losses = c(6L, 22L))
cases[[length(cases) + 1L]] <- build_branch("lions_lose6_win22_play34",
  c(6L, 22L, 34L, 38L, 42L, 44L, 45L), losses = 6L, played34 = TRUE)
cases[[length(cases) + 1L]] <- build_branch("lions_lose6_win22_manual_advance",
  c(6L, 22L, 38L, 42L, 44L, 45L), losses = 6L)

# Flip the opening result after a fully populated bracket, then clear it. This
# detects stale downstream outcomes as well as ordinary forward propagation.
full <- cases[[2L]]
flip_operation <- list(kind = "result", game = 6L, side = "b", score_a = 1, score_b = 3)
flipped <- apply_result(tournament, full$scenario, 6L, "b", 1, 3)
stopifnot(is.null(flipped$results[["15"]]), is.null(flipped$results[["45"]]))
cases[[length(cases) + 1L]] <- snapshot("upstream_flip_clears_stale_results",
  c(full$operations, list(flip_operation)), flipped)
cleared <- clear_result(tournament, flipped, 6L)
cases[[length(cases) + 1L]] <- snapshot("clear_upstream_result",
  c(full$operations, list(flip_operation, list(kind = "clear", game = 6L))), cleared)

payload <- list(generator = "Verified Shiny R/model.R", schema_version = 1L,
  tournament = tournament, cases = cases)
jsonlite::write_json(payload, "tests/r-parity-fixtures.json", pretty = TRUE,
  auto_unbox = TRUE, dataframe = "rows", na = "null", null = "null")
cat("Wrote", length(cases), "R-reference cases; each contains all 45 rows and candidate sets.\n")
