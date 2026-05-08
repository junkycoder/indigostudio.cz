#!/usr/bin/env bash
# audit-url.sh — analýza URL přes Google PageSpeed Insights API.
# Default: mobile + desktop strategie, kategorie performance/a11y/best-practices/seo.
# Volitelně lokální Lighthouse run (--local) přes npx.
#
# Použití:
#   ./scripts/audit-url.sh https://fakan.cz
#   ./scripts/audit-url.sh https://fakan.cz --strategy=mobile
#   ./scripts/audit-url.sh https://fakan.cz --local            # lokální Lighthouse přes npx
#   PSI_KEY=xxx ./scripts/audit-url.sh https://fakan.cz        # vyšší rate limit
#
# Výstup: souhrn skóre, oficiální metriky (CrUX field data), Lighthouse lab data,
# seznam chyb, top doporučení s odhadem úspory.

set -euo pipefail

URL=""
STRATEGY="both"      # mobile | desktop | both
MODE="psi"           # psi | local
JSON_OUT=""

usage() {
  cat <<EOF
Použití: $0 <URL> [--strategy=mobile|desktop|both] [--local] [--json=cesta]

Default: PageSpeed Insights API, obě strategie (mobile + desktop).

Volby:
  --strategy=  Mobile, desktop, nebo obě (default: both).
  --local      Spustí Lighthouse lokálně přes 'npx lighthouse' místo PSI API.
  --json=PATH  Uloží surový JSON do souboru (užitečné pro další zpracování).

Env:
  PSI_KEY      API key pro PageSpeed Insights (volitelné, zvedá rate limit).
EOF
}

# --- arg parsing -----------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --strategy=*) STRATEGY="${arg#*=}" ;;
    --local) MODE="local" ;;
    --json=*) JSON_OUT="${arg#*=}" ;;
    -*) echo "Neznámý přepínač: $arg" >&2; usage; exit 2 ;;
    *) URL="$arg" ;;
  esac
done

if [[ -z "$URL" ]]; then
  echo "Chybí URL." >&2
  usage; exit 2
fi

# --- ANSI barvy (jen do TTY) ----------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YEL=$'\033[33m'; C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YEL=""; C_CYAN=""
fi

# --- závislosti ------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || { echo "Chybí $1. Doinstaluj." >&2; exit 1; }; }
need curl
need jq

# --- helpery ---------------------------------------------------------------
score_color() {
  # vstup: 0–100 (nebo "n/a"), výstup: barevný řetězec se značkou
  local s="$1"
  if [[ "$s" == "n/a" || -z "$s" ]]; then printf '%s' "${C_DIM}n/a${C_RESET}"; return; fi
  if (( s >= 90 )); then printf '%s' "${C_GREEN}${s}${C_RESET}"
  elif (( s >= 50 )); then printf '%s' "${C_YEL}${s}${C_RESET}"
  else printf '%s' "${C_RED}${s}${C_RESET}"; fi
}

cwv_label() {
  case "$1" in
    FAST) printf '%s' "${C_GREEN}rychlý${C_RESET}" ;;
    AVERAGE) printf '%s' "${C_YEL}průměr${C_RESET}" ;;
    SLOW) printf '%s' "${C_RED}pomalý${C_RESET}" ;;
    *) printf '%s' "${C_DIM}neznámé${C_RESET}" ;;
  esac
}

print_header() {
  echo
  echo "${C_BOLD}══ $1 ══${C_RESET}"
}

# --- získání JSON ----------------------------------------------------------
fetch_psi() {
  local url="$1" strategy="$2"
  local endpoint="https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  local q="url=$(jq -rn --arg u "$url" '$u|@uri')&strategy=${strategy}"
  q+="&category=performance&category=accessibility&category=best-practices&category=seo"
  [[ -n "${PSI_KEY:-}" ]] && q+="&key=${PSI_KEY}"

  local body http delays=(0 3 8 20)
  for delay in "${delays[@]}"; do
    (( delay > 0 )) && sleep "$delay"
    body=$(mktemp); http=$(curl -sS --max-time 120 -w '%{http_code}' -o "$body" "${endpoint}?${q}" || echo "000")
    if [[ "$http" == "200" ]]; then cat "$body"; rm -f "$body"; return 0; fi
    if [[ "$http" == "429" || "$http" == "5"* || "$http" == "000" ]]; then
      echo "${C_DIM}» HTTP $http od PSI, opakuji za $((delay+3)) s...${C_RESET}" >&2
      rm -f "$body"; continue
    fi
    # 4xx jiné než 429 — neopakovat (např. 400 invalid URL)
    echo "PSI vrátilo HTTP $http:" >&2
    head -c 500 "$body" >&2; echo >&2
    rm -f "$body"; return 1
  done
  echo "PSI selhalo opakovaně. Zkus PSI_KEY=<klic> $0 ... (https://developers.google.com/speed/docs/insights/v5/get-started)." >&2
  return 1
}

run_local() {
  local url="$1" strategy="$2"
  local form="mobile"
  [[ "$strategy" == "desktop" ]] && form="desktop"
  npx --yes lighthouse "$url" \
    --quiet --output=json --output-path=stdout \
    --chrome-flags="--headless=new --no-sandbox" \
    --form-factor="$form" \
    --only-categories=performance,accessibility,best-practices,seo 2>/dev/null
}

# --- analýza jednoho běhu --------------------------------------------------
analyze() {
  local strategy="$1" json="$2"

  print_header "Strategie: ${strategy}"

  # Skóre kategorií
  local perf a11y bp seo
  perf=$(jq -r '(.lighthouseResult.categories.performance.score // 0) * 100 | floor' <<<"$json")
  a11y=$(jq -r '(.lighthouseResult.categories.accessibility.score // 0) * 100 | floor' <<<"$json")
  bp=$(jq -r '(.lighthouseResult.categories["best-practices"].score // 0) * 100 | floor' <<<"$json")
  seo=$(jq -r '(.lighthouseResult.categories.seo.score // 0) * 100 | floor' <<<"$json")

  echo "${C_BOLD}Lighthouse skóre${C_RESET} (lab data):"
  printf "  Performance      %s / 100\n" "$(score_color "$perf")"
  printf "  Accessibility    %s / 100\n" "$(score_color "$a11y")"
  printf "  Best Practices   %s / 100\n" "$(score_color "$bp")"
  printf "  SEO              %s / 100\n" "$(score_color "$seo")"

  # Core Web Vitals — CrUX (real-user) data, pokud dostupná
  local has_crux
  has_crux=$(jq -r '(.loadingExperience.metrics // {}) | length > 0' <<<"$json")
  if [[ "$has_crux" == "true" ]]; then
    echo
    echo "${C_BOLD}Core Web Vitals${C_RESET} (CrUX, reální uživatelé, p75 za posledních 28 dní):"
    jq -r '
      .loadingExperience.metrics // {} |
      to_entries[] |
      [.key, (.value.percentile|tostring), .value.category] | @tsv
    ' <<<"$json" | while IFS=$'\t' read -r metric pct cat; do
      local human unit
      case "$metric" in
        LARGEST_CONTENTFUL_PAINT_MS) human="LCP   "; unit=" ms" ;;
        FIRST_CONTENTFUL_PAINT_MS)   human="FCP   "; unit=" ms" ;;
        CUMULATIVE_LAYOUT_SHIFT_SCORE) human="CLS   "; unit=" (×100)" ;;
        INTERACTION_TO_NEXT_PAINT)   human="INP   "; unit=" ms" ;;
        EXPERIMENTAL_TIME_TO_FIRST_BYTE) human="TTFB  "; unit=" ms" ;;
        FIRST_INPUT_DELAY_MS)        human="FID   "; unit=" ms" ;;
        *) human="$metric"; unit="" ;;
      esac
      printf "  %s p75=%s%s  %s\n" "$human" "$pct" "$unit" "$(cwv_label "$cat")"
    done
    local origin_fallback
    origin_fallback=$(jq -r '.loadingExperience.origin_fallback // false' <<<"$json")
    [[ "$origin_fallback" == "true" ]] && \
      echo "  ${C_DIM}(málo dat pro URL — zobrazena agregace celého originu)${C_RESET}"
  else
    echo
    echo "${C_DIM}Core Web Vitals: žádná real-user data v CrUX (málo provozu nebo nově nasazené).${C_RESET}"
  fi

  # Lab metriky z Lighthouse
  echo
  echo "${C_BOLD}Lab metriky${C_RESET} (Lighthouse simulace 4G/Moto G):"
  jq -r '
    .lighthouseResult.audits |
    [
      ["LCP   ", ."largest-contentful-paint".displayValue // "n/a"],
      ["FCP   ", ."first-contentful-paint".displayValue // "n/a"],
      ["CLS   ", ."cumulative-layout-shift".displayValue // "n/a"],
      ["TBT   ", ."total-blocking-time".displayValue // "n/a"],
      ["SI    ", ."speed-index".displayValue // "n/a"],
      ["TTI   ", ."interactive".displayValue // "n/a"],
      ["TTFB  ", ."server-response-time".displayValue // "n/a"]
    ][] | "  \(.[0]) \(.[1])"
  ' <<<"$json"

  # Chyby — failed binary audity (score == 0 a binární vyhodnocení).
  # Vynecháváme metriky (numeric) a doporučení s úsporou (metricSavings) — ty patří jinam.
  echo
  echo "${C_BOLD}${C_RED}Kritické chyby${C_RESET} (failed binary audity):"
  local errors
  errors=$(jq -r --arg dim "$C_DIM" --arg rst "$C_RESET" '
    .lighthouseResult.audits |
    to_entries |
    map(select(
      .value.scoreDisplayMode == "binary" and
      .value.score == 0
    )) |
    sort_by(.value.weight // 0) | reverse |
    .[] |
    "  - \(.value.title)" +
    (if .value.displayValue then "  \($dim)(\(.value.displayValue))\($rst)" else "" end)
  ' <<<"$json")
  if [[ -z "$errors" ]]; then
    echo "  ${C_GREEN}Žádné kritické chyby.${C_RESET}"
  else
    echo "$errors"
  fi

  # Console errors (vlastní audit)
  local console_errs
  console_errs=$(jq -r '
    .lighthouseResult.audits."errors-in-console".details.items // [] |
    map("  - [\(.source // "?")] \(.description // .text // .url // "?" | .[0:200])") | .[]
  ' <<<"$json")
  if [[ -n "$console_errs" ]]; then
    echo
    echo "${C_BOLD}${C_RED}Chyby v konzoli${C_RESET}:"
    echo "$console_errs"
  fi

  # Doporučení — audity s odhadovanou úsporou (Lighthouse 12: scoreDisplayMode == "metricSavings"
  # nebo legacy details.type == "opportunity").
  echo
  echo "${C_BOLD}${C_YEL}Doporučení${C_RESET} (s odhadovanou úsporou):"
  local opps
  opps=$(jq -r --arg dim "$C_DIM" --arg rst "$C_RESET" '
    .lighthouseResult.audits |
    to_entries |
    map(select(
      (.value.score // 1) < 1 and (
        .value.scoreDisplayMode == "metricSavings"
        or .value.details.type == "opportunity"
      )
    )) |
    map(. + {
      _tbt:  (.value.metricSavings.TBT  // 0),
      _lcp:  (.value.metricSavings.LCP  // 0),
      _fcp:  (.value.metricSavings.FCP  // 0),
      _cls:  (.value.metricSavings.CLS  // 0),
      _inp:  (.value.metricSavings.INP  // 0),
      _ms:   (.value.details.overallSavingsMs // 0),
      _b:    (.value.details.overallSavingsBytes // 0)
    }) |
    map(. + { _rank: (._tbt + ._lcp + ._fcp + ._inp + ._ms + (._b/100)) }) |
    sort_by(._rank) | reverse |
    .[] |
    ( [
        (if ._tbt > 0 then "TBT -\(._tbt|floor) ms" else empty end),
        (if ._lcp > 0 then "LCP -\(._lcp|floor) ms" else empty end),
        (if ._fcp > 0 then "FCP -\(._fcp|floor) ms" else empty end),
        (if ._inp > 0 then "INP -\(._inp|floor) ms" else empty end),
        (if ._ms  > 0 then "-\(._ms|floor) ms" else empty end),
        (if ._b   > 0 then "-\((._b/1024)|floor) kB" else empty end)
      ] | join(", ") ) as $sav |
    "  - \(.value.title)" +
    (if .value.displayValue then " \($dim)(\(.value.displayValue))\($rst)" else "" end) +
    (if $sav != "" then "\n      \($dim)úspora: \($sav)\($rst)" else "" end)
  ' <<<"$json")
  if [[ -z "$opps" ]]; then
    echo "  ${C_GREEN}Nic zásadního. Drobnosti najdeš v plné Lighthouse zprávě.${C_RESET}"
  else
    echo "$opps"
  fi

  # Diagnostika — informativní audity s nějakým displayValue (jinak je to šum).
  echo
  echo "${C_BOLD}${C_CYAN}Diagnostika${C_RESET} (k zamyšlení):"
  local diag
  diag=$(jq -r --arg dim "$C_DIM" --arg rst "$C_RESET" '
    .lighthouseResult.audits |
    to_entries |
    map(select(
      .value.scoreDisplayMode == "informative" and
      .value.displayValue != null and .value.displayValue != ""
    )) |
    sort_by(.value.weight // 0) | reverse |
    .[0:10] | .[] |
    "  - \(.value.title)  \($dim)\(.value.displayValue)\($rst)"
  ' <<<"$json")
  [[ -z "$diag" ]] && diag="  ${C_DIM}—${C_RESET}"
  echo "$diag"
}

# --- summary -----------------------------------------------------------------
print_summary() {
  local mobile_json="$1" desktop_json="$2"
  print_header "Souhrn"
  for pair in "mobile:$mobile_json" "desktop:$desktop_json"; do
    local label="${pair%%:*}" json="${pair#*:}"
    [[ -z "$json" ]] && continue
    local p a b s
    p=$(jq -r '(.lighthouseResult.categories.performance.score // 0) * 100 | floor' <<<"$json")
    a=$(jq -r '(.lighthouseResult.categories.accessibility.score // 0) * 100 | floor' <<<"$json")
    b=$(jq -r '(.lighthouseResult.categories["best-practices"].score // 0) * 100 | floor' <<<"$json")
    s=$(jq -r '(.lighthouseResult.categories.seo.score // 0) * 100 | floor' <<<"$json")
    printf "%-9s perf=%s  a11y=%s  best=%s  seo=%s\n" \
      "$label" "$(score_color "$p")" "$(score_color "$a")" "$(score_color "$b")" "$(score_color "$s")"
  done

  # Verdikt podle fakan.cz standardů (PRD sekce 6)
  echo
  echo "${C_BOLD}Verdikt vůči fakan.cz standardům${C_RESET}:"
  local target='LCP < 1500 ms, CLS < 0,05, INP < 200 ms, JS < 30 kB gzip, A11y = 100, Perf >= 90.'
  echo "  Cíl: $target"
  for pair in "mobile:$mobile_json" "desktop:$desktop_json"; do
    local label="${pair%%:*}" json="${pair#*:}"
    [[ -z "$json" ]] && continue
    local p a
    p=$(jq -r '(.lighthouseResult.categories.performance.score // 0) * 100 | floor' <<<"$json")
    a=$(jq -r '(.lighthouseResult.categories.accessibility.score // 0) * 100 | floor' <<<"$json")
    local verdict=()
    (( p >= 90 )) || verdict+=("perf=${p} (cíl ≥ 90)")
    (( a >= 100 )) || verdict+=("a11y=${a} (cíl 100)")
    if [[ ${#verdict[@]} -eq 0 ]]; then
      printf "  %-9s ${C_GREEN}OK${C_RESET}\n" "$label"
    else
      printf "  %-9s ${C_RED}FAIL${C_RESET}: %s\n" "$label" "$(IFS='; '; echo "${verdict[*]}")"
    fi
  done
}

# --- main --------------------------------------------------------------------
echo "${C_BOLD}Audit URL:${C_RESET} $URL"
echo "${C_DIM}Datum: $(date '+%Y-%m-%d %H:%M:%S')   Mód: $MODE   Strategie: $STRATEGY${C_RESET}"

declare -a STRATS
case "$STRATEGY" in
  mobile) STRATS=(mobile) ;;
  desktop) STRATS=(desktop) ;;
  both) STRATS=(mobile desktop) ;;
  *) echo "Neplatná strategie: $STRATEGY" >&2; exit 2 ;;
esac

MOBILE_JSON=""; DESKTOP_JSON=""
for s in "${STRATS[@]}"; do
  echo
  echo "${C_DIM}» Stahuji výsledek pro $s ...${C_RESET}"
  if [[ "$MODE" == "local" ]]; then
    raw=$(run_local "$URL" "$s")
    # lokální Lighthouse vrací jen .lighthouseResult — zabalíme to pro stejný parser
    json=$(jq -n --argjson lh "$raw" '{lighthouseResult: $lh, loadingExperience: {metrics: {}}}')
  else
    json=$(fetch_psi "$URL" "$s") || { echo "PSI selhalo pro $s" >&2; exit 1; }
  fi

  if [[ "$s" == "mobile" ]]; then MOBILE_JSON="$json"; else DESKTOP_JSON="$json"; fi

  if [[ -n "$JSON_OUT" ]]; then
    out="${JSON_OUT%.json}.${s}.json"
    printf '%s' "$json" > "$out"
    echo "${C_DIM}» JSON uložen do $out${C_RESET}"
  fi

  analyze "$s" "$json"
done

[[ ${#STRATS[@]} -eq 2 ]] && print_summary "$MOBILE_JSON" "$DESKTOP_JSON"

echo
echo "${C_DIM}Hotovo. Plný Lighthouse report otevřeš v https://pagespeed.web.dev/?url=$(jq -rn --arg u "$URL" '$u|@uri')${C_RESET}"
