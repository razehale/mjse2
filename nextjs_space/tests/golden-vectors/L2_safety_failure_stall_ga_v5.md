# L2_safety_failure_stall_ga_v5

- **CSV file:** `L2_safety_failure_stall_ga_v5.csv`
- **Lesson key:** `L2`
- **Profile:** Go-around initiated from approach but with stall warning / IAS decay and unsafe flap snap, no GTGL completion.
- **Expected score band:** **1** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **false**
- **Notes:** Safety sentinel vector. Must remain failing and low-scored.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L2_safety_failure_stall_ga_v5.csv','utf8'); const r=evaluateFlight(csv,'L2','L2_safety_failure_stall_ga_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
