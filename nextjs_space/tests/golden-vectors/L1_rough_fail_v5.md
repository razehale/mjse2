# L1_rough_fail_v5

- **CSV file:** `L1_rough_fail_v5.csv`
- **Lesson key:** `L1`
- **Profile:** Sloppy takeoff alignment, unstable speeds, no clean pattern discipline, hard touchdown.
- **Expected score band:** **1-2** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **false**
- **Notes:** Golden fail vector for L1 rough execution.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L1_rough_fail_v5.csv','utf8'); const r=evaluateFlight(csv,'L1','L1_rough_fail_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
