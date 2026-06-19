# L3_stall_recovery_success_v5

- **CSV file:** `L3_stall_recovery_success_v5.csv`
- **Lesson key:** `L3`
- **Profile:** Detectable stall warning event followed by IAS recovery and continued controlled flight.
- **Expected score band:** **3-4** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **true**
- **Notes:** Regression vector for successful stall recovery behavior.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L3_stall_recovery_success_v5.csv','utf8'); const r=evaluateFlight(csv,'L3','L3_stall_recovery_success_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
