# L1_perfect_pass_v5

- **CSV file:** `L1_perfect_pass_v5.csv`
- **Lesson key:** `L1`
- **Profile:** Clean taxi/takeoff, stable downwind/base/final, smooth landing.
- **Expected score band:** **4-5** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **true**
- **Notes:** Golden pass vector for L1 regression.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L1_perfect_pass_v5.csv','utf8'); const r=evaluateFlight(csv,'L1','L1_perfect_pass_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
