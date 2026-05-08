# scripts/

Pomocné skripty pro vývoj a audit. Nejsou součástí runtime.

## audit-url.sh

Analýza URL přes Google PageSpeed Insights API (default) nebo lokální Lighthouse (`--local`).

**Použití:**

```bash
./scripts/audit-url.sh https://fakan.cz
./scripts/audit-url.sh https://fakan.cz --strategy=mobile
./scripts/audit-url.sh https://fakan.cz --local
PSI_KEY=xxx ./scripts/audit-url.sh https://fakan.cz   # vyšší rate limit
```

**Vznik:** side-effect smoke testu TASK-16 v iteraci `landing-v2`. Užitečný pro průběžný audit, takže commitnut do repa jako sdílený tooling.
