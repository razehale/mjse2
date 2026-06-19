# L3_steep_turn_alt_bust_v5

- **CSV file:** `L3_steep_turn_alt_bust_v5.csv`
- **Lesson key:** `L3`
- **Profile:** Steep turn detected with large altitude deviation and poor coordination, leading to fail-level performance.
- **Expected score band:** **2-3** (1-5 integer scale persisted by API)
- **Expected passed flag (`result.passed`):** **false**
- **Notes:** Regression vector for altitude-control bust in steep turns.

## Recommended check

```bash
cd /home/ubuntu/swarm_shared_files/mjse2/nextjs_space
npx tsx -e "import fs from 'fs'; import { evaluateFlight } from './lib/s2s-engine/index'; const csv=fs.readFileSync('./tests/golden-vectors/L3_steep_turn_alt_bust_v5.csv','utf8'); const r=evaluateFlight(csv,'L3','L3_steep_turn_alt_bust_v5.csv',{ machadoQuizPct: 90 }).result; console.log(r.overallScore, r.overallGrade, r.passed);"
```
