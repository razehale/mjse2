# L2_clean_energy_gtgl_v5

- **CSV file:** `L2_clean_energy_gtgl_v5.csv`
- **Lesson key:** `L2`
- **Profile:** Three completed cycles with valid GTGL sequence (GA1→TNG→GA2→LAND), stable speeds, flap/trim compliance.
- **Expected score band:** **4-5** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **true**
- **Notes:** Golden high-performance vector for L2 energy management + GTGL gating.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L2_clean_energy_gtgl_v5.csv','utf8'); const r=evaluateFlight(csv,'L2','L2_clean_energy_gtgl_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
