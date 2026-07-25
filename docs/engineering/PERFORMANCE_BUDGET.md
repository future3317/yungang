# Performance budget

Targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, first-screen JS gzip <= 220KB where practical, and no runtime remote font dependency. Non-critical detail scenes should be lazy-loaded in the next asset pass. Current production build is the evidence source; run Lighthouse before making a public performance claim.
