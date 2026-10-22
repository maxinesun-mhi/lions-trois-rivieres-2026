# Verified R reference

This is the original scenario model and source-transcribed CSV data from the R Shiny project. It is retained here solely to reproduce the independent JavaScript parity fixtures without depending on a sibling project or any machine-specific path.

`R/model.R` uses base R. The fixture generator additionally needs `jsonlite`, but does not need Shiny. From the repository root, run `Rscript tests/generate-parity.R` and then `node --test tests/*.test.mjs`.

The complete verification notes are in `dist/source-verification.md`. The original source PDF is omitted from this public release. The optional R reference is not part of the deployed Pages artifact.
