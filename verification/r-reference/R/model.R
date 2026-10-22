# Tournament scenario engine. This file uses base R only.
# Routing comes from data/games.csv; no elimination or tie-break rules are added.

empty_scenario <- function() {
  list(schema_version = 1L, results = list(),
       game34 = list(status = "unresolved", opponent = "", advance = ""))
}

.scalar_string <- function(x, field, allow_empty = TRUE) {
  if (!is.character(x) || length(x) != 1L || is.na(x))
    stop(field, " must be one text value.", call. = FALSE)
  if (!allow_empty && !nzchar(x)) stop(field, " cannot be blank.", call. = FALSE)
  x
}

.named_fields <- function(x, fields, field) {
  if (!is.list(x) || is.data.frame(x) || is.null(names(x)) ||
      anyDuplicated(names(x)) || !setequal(names(x), fields))
    stop(field, " must contain exactly: ", paste(fields, collapse = ", "), ".", call. = FALSE)
  invisible(TRUE)
}

.whole <- function(x) {
  is.numeric(x) && length(x) == 1L && !is.na(x) && is.finite(x) && x == floor(x)
}

.score <- function(x, field) {
  if (is.null(x)) return(NA_real_) # JSON null is a blank score.
  if (!is.numeric(x) || length(x) != 1L || is.nan(x) ||
      (!is.na(x) && (!is.finite(x) || x < 0 || x != floor(x))))
    stop(field, " must be blank or a finite, nonnegative whole number.", call. = FALSE)
  as.numeric(x)
}

.scores <- function(a, b, winner_side = NULL) {
  a <- .score(a, "Score A")
  b <- .score(b, "Score B")
  if (is.na(a) != is.na(b))
    stop("Enter both scores, or leave both blank.", call. = FALSE)
  if (!is.null(winner_side) && !is.na(a) && a != b &&
      ((a > b && winner_side != "a") || (b > a && winner_side != "b")))
    stop("The chosen winner contradicts the unequal scores.", call. = FALSE)
  c(a = a, b = b)
}

.game_key <- function(data, game_no) {
  if (is.numeric(game_no) && .whole(game_no)) game_no <- as.character(game_no)
  game_no <- .scalar_string(game_no, "Game number", FALSE)
  if (!(game_no %in% as.character(data$games$game_no)))
    stop("Unknown game number: ", game_no, ".", call. = FALSE)
  game_no
}

.validate_data <- function(data) {
  if (!is.list(data) || !is.data.frame(data$games) || !is.data.frame(data$teams))
    stop("Tournament data must contain games and teams tables.", call. = FALSE)
  required <- c("game_no", "official_id", "date", "time", "arena", "a_type",
                "a_ref", "b_type", "b_ref", "stage")
  if (!all(required %in% names(data$games)) ||
      !all(c("team_id", "name", "label") %in% names(data$teams)))
    stop("Tournament data is missing required columns.", call. = FALSE)
  g <- data$games
  t <- data$teams
  if (!is.numeric(g$game_no) || anyNA(g$game_no) || any(!is.finite(g$game_no)) ||
      any(g$game_no < 1 | g$game_no != floor(g$game_no)) || anyDuplicated(g$game_no))
    stop("Game numbers must be unique positive whole numbers.", call. = FALSE)
  if (!is.character(t$team_id) || anyNA(t$team_id) || any(!nzchar(t$team_id)) ||
      anyDuplicated(t$team_id) || anyNA(t$name) || anyNA(t$label))
    stop("Team IDs must be nonempty and unique, with names and labels.", call. = FALSE)
  for (side in c("a", "b")) {
    ty <- g[[paste0(side, "_type")]]
    ref <- g[[paste0(side, "_ref")]]
    if (!is.character(ty) || !is.character(ref) || anyNA(ty) || anyNA(ref) ||
        any(!ty %in% c("seed", "winner", "loser", "unknown")))
      stop("Invalid routing types or references in tournament data.", call. = FALSE)
    if (any(ty == "seed" & !ref %in% t$team_id) ||
        any(ty %in% c("winner", "loser") & !ref %in% as.character(g$game_no)))
      stop("Tournament data refers to an unknown team or game.", call. = FALSE)
  }
  invisible(TRUE)
}

.parents <- function(data) {
  g <- data$games
  ans <- setNames(vector("list", nrow(g)), as.character(g$game_no))
  for (i in seq_len(nrow(g))) {
    ans[[as.character(g$game_no[i])]] <- unique(c(
      if (g$a_type[i] %in% c("winner", "loser")) g$a_ref[i] else character(),
      if (g$b_type[i] %in% c("winner", "loser")) g$b_ref[i] else character()))
  }
  ans
}

.topological_order <- function(data) {
  parents <- .parents(data)
  remaining <- names(parents)
  done <- character()
  while (length(remaining)) {
    ready <- remaining[vapply(parents[remaining], function(x) all(x %in% done), logical(1))]
    if (!length(ready)) stop("Tournament routing contains a dependency cycle.", call. = FALSE)
    ready <- ready[order(as.numeric(ready))]
    done <- c(done, ready)
    remaining <- setdiff(remaining, ready)
  }
  done
}

load_tournament <- function(path = ".") {
  read_table <- function(name) read.csv(file.path(path, "data", name),
    colClasses = "character", stringsAsFactors = FALSE, check.names = FALSE,
    na.strings = character(), fileEncoding = "UTF-8")
  g <- read_table("games.csv")
  t <- read_table("teams.csv")
  g$game_no <- suppressWarnings(as.numeric(g$game_no))
  data <- list(games = g, teams = t)
  .validate_data(data)
  .topological_order(data)
  data$games <- g[order(g$game_no), , drop = FALSE]
  rownames(data$games) <- NULL
  data
}

ancestors <- function(data, game_no) {
  key <- .game_key(data, game_no)
  parents <- .parents(data)
  seen <- character()
  pending <- parents[[key]]
  while (length(pending)) {
    next_key <- pending[1L]
    pending <- pending[-1L]
    if (!(next_key %in% seen)) {
      seen <- c(seen, next_key)
      pending <- c(pending, parents[[next_key]])
    }
  }
  sort(as.integer(seen))
}

descendants <- function(data, game_no) {
  key <- .game_key(data, game_no)
  parents <- .parents(data)
  seen <- character()
  pending <- key
  while (length(pending)) {
    current <- pending[1L]
    pending <- pending[-1L]
    children <- names(parents)[vapply(parents, function(x) current %in% x, logical(1))]
    children <- setdiff(children, c(seen, key))
    seen <- c(seen, children)
    pending <- c(pending, children)
  }
  sort(as.integer(unique(seen)))
}

.structure_scenario <- function(data, object) {
  .named_fields(object, c("schema_version", "results", "game34"), "Scenario")
  if (!.whole(object$schema_version) || object$schema_version != 1)
    stop("Unsupported scenario schema_version; expected 1.", call. = FALSE)
  results <- object$results
  if (!is.list(results) || is.data.frame(results) ||
      (length(results) && (is.null(names(results)) || anyDuplicated(names(results)))))
    stop("Scenario results must be a list keyed by unique game numbers.", call. = FALSE)
  if (length(results) && any(!names(results) %in% as.character(data$games$game_no)))
    stop("Scenario contains an unknown game number.", call. = FALSE)
  for (key in names(results)) {
    pick <- results[[key]]
    .named_fields(pick, c("team_a", "team_b", "winner", "score_a", "score_b"),
                  paste("Result for game", key))
    for (field in c("team_a", "team_b", "winner")) {
      value <- .scalar_string(pick[[field]], paste("Game", key, field), FALSE)
      if (!value %in% data$teams$team_id)
        stop("Game ", key, " contains an unknown team ID.", call. = FALSE)
    }
    if (pick$team_a == pick$team_b)
      stop("Game ", key, " cannot contain the same team on both sides.", call. = FALSE)
    if (!pick$winner %in% c(pick$team_a, pick$team_b))
      stop("Game ", key, " winner is not one of its bound participants.", call. = FALSE)
    sc <- .scores(pick$score_a, pick$score_b,
                  if (pick$winner == pick$team_a) "a" else "b")
    # Assigning NULL with $<- removes a list field; preserve blank fields as NA.
    results[[key]] <- list(team_a = pick$team_a, team_b = pick$team_b,
      winner = pick$winner, score_a = unname(sc[1]), score_b = unname(sc[2]))
  }
  cfg <- object$game34
  .named_fields(cfg, c("status", "opponent", "advance"), "Game 34 configuration")
  status <- .scalar_string(cfg$status, "Game 34 status", FALSE)
  opponent <- .scalar_string(cfg$opponent, "Game 34 opponent")
  advance <- .scalar_string(cfg$advance, "Game 34 advancing team")
  if (!status %in% c("unresolved", "played", "not_needed"))
    stop("Game 34 status must be unresolved, played, or not_needed.", call. = FALSE)
  if (nzchar(opponent) && !opponent %in% data$teams$team_id)
    stop("Game 34 opponent is an unknown team ID.", call. = FALSE)
  if (nzchar(advance) && !advance %in% c(data$teams$team_id, "@winner22"))
    stop("Game 34 advancing team is an unknown team ID.", call. = FALSE)
  if (status == "unresolved" && (nzchar(opponent) || nzchar(advance)))
    stop("An unresolved game 34 cannot specify an opponent or advancing team.", call. = FALSE)
  if (status == "played" && nzchar(advance))
    stop("A played game 34 uses its selected result, not an advancing-team override.", call. = FALSE)
  list(schema_version = 1L, results = results,
       game34 = list(status = status, opponent = opponent, advance = advance))
}

.team_label <- function(data, id) {
  if (!length(id) || !nzchar(id)) return("")
  data$teams$label[match(id, data$teams$team_id)]
}

.source_label <- function(data, type, ref) {
  switch(type, seed = .team_label(data, ref), winner = paste0("Winner #", ref),
         loser = paste0("Loser #", ref), unknown = "Opponent unspecified in PDF")
}

# Walk once in dependency order. Every saved result is bound to its two entrants;
# clearing it immediately ensures descendants never consume stale decisions.
.walk_scenario <- function(data, scenario, strict_bindings = FALSE) {
  g <- data$games
  ids <- as.character(g$game_no)
  order <- .topological_order(data)
  outcomes <- setNames(vector("list", nrow(g)), ids)
  candidates <- setNames(vector("list", nrow(g)), ids)
  rows <- setNames(vector("list", nrow(g)), ids)
  invalidated <- integer()
  game34_reset <- FALSE
  resolve <- function(type, ref) {
    if (type == "seed") return(list(id = ref, candidates = ref))
    if (type == "unknown") return(list(id = "", candidates = character()))
    o <- outcomes[[ref]]
    list(id = o[[type]], candidates = o[[paste0(type, "_candidates")]])
  }
  for (key in order) {
    i <- match(key, ids)
    a <- resolve(g$a_type[i], g$a_ref[i])
    b <- resolve(g$b_type[i], g$b_ref[i])
    conditional <- key == "34"
    cfg <- scenario$game34
    conditional_note <- ""
    if (conditional) {
      if (cfg$status == "played") {
        a <- list(id = cfg$opponent,
                  candidates = if (nzchar(cfg$opponent)) cfg$opponent else character())
        if (nzchar(a$id) && nzchar(b$id) && a$id == b$id) {
          if (strict_bindings)
            stop("Game 34 cannot contain the same team as opponent and winner #22.", call. = FALSE)
          scenario$game34 <- empty_scenario()$game34
          cfg <- scenario$game34
          a <- list(id = "", candidates = character())
          game34_reset <- TRUE
        }
      } else if (cfg$status == "not_needed") {
        a <- list(id = cfg$opponent,
                  candidates = if (nzchar(cfg$opponent)) cfg$opponent else character())
      }
    }
    duplicate_pair <- nzchar(a$id) && nzchar(b$id) && a$id == b$id &&
      (!conditional || cfg$status == "played")
    if (strict_bindings && duplicate_pair)
      stop("Game ", key, " has the same team on both sides; correct the manual conditional entry.",
           call. = FALSE)
    known_pair <- nzchar(a$id) && nzchar(b$id) && a$id != b$id
    pick <- scenario$results[[key]]
    allowed_result <- !conditional || cfg$status == "played"
    valid_pick <- !is.null(pick) && known_pair && allowed_result &&
      identical(pick$team_a, a$id) && identical(pick$team_b, b$id)
    if (!is.null(pick) && !valid_pick) {
      if (strict_bindings)
        stop("Game ", key, " result does not match its currently resolved participants or state.",
             call. = FALSE)
      scenario$results[[key]] <- NULL
      invalidated <- c(invalidated, as.integer(key))
      pick <- NULL
    }
    winner <- loser <- ""
    score_a <- score_b <- NA_real_
    wc <- unique(c(a$candidates, b$candidates))
    lc <- wc
    status <- if (duplicate_pair) "Invalid pairing: same team on both sides" else
      if (known_pair) "Ready" else "Unresolved matchup"
    if (duplicate_pair) wc <- lc <- character()
    if (valid_pick) {
      winner <- pick$winner
      loser <- if (winner == a$id) b$id else a$id
      wc <- winner
      lc <- loser
      score_a <- pick$score_a
      score_b <- pick$score_b
      status <- "Final"
    }
    if (conditional) {
      if (cfg$status == "unresolved") {
        status <- "Conditional: unresolved"
        # The PDF does not identify side A or the condition. W22 is a possible
        # participant only; no winner or loser is inferred.
        wc <- b$candidates
        lc <- character()
        conditional_note <- "PDF condition and side A are unspecified; confirm game 34 manually."
      } else if (cfg$status == "not_needed") {
        winner <- if (cfg$advance == "@winner22") b$id else cfg$advance
        wc <- if (cfg$advance == "@winner22") b$candidates else
          if (nzchar(cfg$advance)) cfg$advance else character()
        loser <- ""
        lc <- character()
        status <- if (nzchar(winner)) "Conditional: manually advanced" else
          if (cfg$advance == "@winner22") "Conditional: awaiting winner #22" else
            "Conditional: advancing team required"
        conditional_note <- "No game or loser is inferred. Advancement is an explicit manual confirmation."
      } else {
        status <- if (valid_pick) "Conditional: final" else
          if (!nzchar(cfg$opponent)) "Conditional: opponent required" else
            if (!nzchar(b$id)) "Conditional: awaiting winner #22" else "Conditional: ready"
        conditional_note <- "Side A is manually specified; side B is winner #22."
      }
    }
    outcomes[[key]] <- list(winner = winner, loser = loser,
      winner_candidates = unique(wc), loser_candidates = unique(lc))
    candidates[[key]] <- list(a = unique(a$candidates), b = unique(b$candidates),
                             winner = unique(wc), loser = unique(lc))
    rows[[key]] <- data.frame(team_a = a$id, team_b = b$id,
      name_a = if (nzchar(a$id)) .team_label(data, a$id) else
        .source_label(data, g$a_type[i], g$a_ref[i]),
      name_b = if (nzchar(b$id)) .team_label(data, b$id) else
        .source_label(data, g$b_type[i], g$b_ref[i]),
      winner = winner, loser = loser, winner_name = .team_label(data, winner),
      loser_name = .team_label(data, loser), status = status,
      score_a = score_a, score_b = score_b, is_conditional = conditional,
      conditional_note = conditional_note, stringsAsFactors = FALSE)
  }
  df <- cbind(g, do.call(rbind, rows[ids]))
  rownames(df) <- NULL
  attr(df, "candidates") <- candidates
  attr(df, "invalidated") <- sort(unique(invalidated))
  attr(df, "game34_reset") <- game34_reset
  attr(scenario, "invalidated") <- sort(unique(invalidated))
  attr(scenario, "game34_reset") <- game34_reset
  list(scenario = scenario, games = df)
}

validate_scenario <- function(data, object) {
  .validate_data(data)
  scenario <- .structure_scenario(data, object)
  .walk_scenario(data, scenario, strict_bindings = TRUE)$scenario
}

normalize_scenario <- function(data, scenario) {
  .validate_data(data)
  scenario <- .structure_scenario(data, scenario)
  .walk_scenario(data, scenario)$scenario
}

evaluate_tournament <- function(data, scenario = empty_scenario()) {
  .validate_data(data)
  scenario <- .structure_scenario(data, scenario)
  .walk_scenario(data, scenario)$games
}

.merge_invalidation <- function(scenario, old_invalidated = integer(), old_reset = FALSE) {
  attr(scenario, "invalidated") <- sort(unique(c(old_invalidated, attr(scenario, "invalidated"))))
  attr(scenario, "game34_reset") <- isTRUE(old_reset) || isTRUE(attr(scenario, "game34_reset"))
  scenario
}

apply_result <- function(data, scenario, game_no, winner_side = c("a", "b"),
                         score_a = NA_real_, score_b = NA_real_) {
  key <- .game_key(data, game_no)
  winner_side <- match.arg(winner_side, c("a", "b"))
  sc <- .scores(score_a, score_b, winner_side)
  scenario <- normalize_scenario(data, scenario)
  prior_invalidated <- attr(scenario, "invalidated")
  prior_reset <- attr(scenario, "game34_reset")
  ev <- evaluate_tournament(data, scenario)
  row <- ev[ev$game_no == as.integer(key), , drop = FALSE]
  if (key == "34" && scenario$game34$status != "played")
    stop("Set conditional game 34 to played before entering a result.", call. = FALSE)
  if (!nzchar(row$team_a) || !nzchar(row$team_b) || row$team_a == row$team_b)
    stop("Both distinct participants must be resolved before selecting a winner.", call. = FALSE)
  scenario$results[[key]] <- list(team_a = row$team_a, team_b = row$team_b,
    winner = if (winner_side == "a") row$team_a else row$team_b,
    score_a = unname(sc[1]), score_b = unname(sc[2]))
  .merge_invalidation(normalize_scenario(data, scenario), prior_invalidated, prior_reset)
}

clear_result <- function(data, scenario, game_no) {
  key <- .game_key(data, game_no)
  scenario <- normalize_scenario(data, scenario)
  prior_invalidated <- attr(scenario, "invalidated")
  prior_reset <- attr(scenario, "game34_reset")
  scenario$results[[key]] <- NULL
  .merge_invalidation(normalize_scenario(data, scenario), prior_invalidated, prior_reset)
}

set_game34 <- function(data, scenario, status, opponent = "", advance = "") {
  scenario <- normalize_scenario(data, scenario)
  prior_invalidated <- attr(scenario, "invalidated")
  prior_reset <- attr(scenario, "game34_reset")
  # Structure validation also accepts pending played/not-needed configurations.
  candidate <- scenario
  candidate$game34 <- list(status = status, opponent = opponent, advance = advance)
  candidate <- .structure_scenario(data, candidate)
  if (status == "played" && nzchar(opponent)) {
    ev <- evaluate_tournament(data, scenario)
    winner22 <- ev$winner[ev$game_no == 22L]
    if (length(winner22) && nzchar(winner22) && opponent == winner22)
      stop("Game 34 opponent cannot also be winner #22.", call. = FALSE)
  }
  # Changing conditional state may invalidate the game 34 result and descendants.
  .merge_invalidation(normalize_scenario(data, candidate), prior_invalidated, prior_reset)
}
