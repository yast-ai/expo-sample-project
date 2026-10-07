from pathlib import Path
import tempfile,subprocess,os,shutil
root=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='public-pnpm-recovery-',dir='/private/tmp') as t:
 p=Path(t); (p/'bin').mkdir(); (p/'src').mkdir(); (p/'support').mkdir()
 shutil.copy2(root/'../../research/gradle-task-telemetry.init.gradle',p/'support/gradle-task-telemetry.init.gradle')
 cache=p/'cache/v1/pnpm'; (cache/'11.23.0').mkdir(parents=True); (cache/'11.23.0/broken').write_text('broken'); (cache/'10.12.3').mkdir();(cache/'10.12.3/keep').write_text('keep')
 stub=p/'bin/corepack'; stub.write_text('''#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == install ]]; then
 [[ "$2" == --global && "$3" == pnpm@11.23.0 ]]
 [[ ! -e "$COREPACK_HOME/v1/pnpm/11.23.0/broken" ]]
 [[ -e "$COREPACK_HOME/v1/pnpm/10.12.3/keep" ]]
 mkdir -p "$COREPACK_HOME/v1/pnpm/11.23.0"
 touch "$COREPACK_HOME/v1/pnpm/11.23.0/repaired"
 exit 0
fi
if [[ "$2" == --version ]]; then
 [[ -e "$COREPACK_HOME/v1/pnpm/11.23.0/repaired" ]] || exit 1
 echo 11.23.0
fi
''');stub.chmod(0o755)
 env=os.environ.copy();env.update(PATH=str(p/'bin')+':'+env['PATH'],WORKLOAD_ID='bluesky-social-app',EXPO_TOKEN='dummy',BENCHMARK_UPLOAD_COLD_URL='https://example.invalid/cold',BENCHMARK_UPLOAD_WARM_URL='https://example.invalid/warm',BENCHMARK_SUPPORT_DIR=str(p/'support'),BENCHMARK_SOURCE_DIR=str(p/'src'),BENCHMARK_OUTPUT_DIR=str(p/'out'),BENCHMARK_GRADLE_USER_HOME=str(p/'gradle'),BENCHMARK_NPM_CACHE=str(p/'npm'),BENCHMARK_BUN_CACHE=str(p/'bun'),BENCHMARK_COREPACK_HOME=str(p/'cache'),BENCHMARK_SKIP_CLONE='1',BENCHMARK_SKIP_OVERLAY='1',BENCHMARK_SKIP_BUILD='1')
 subprocess.run(['bash',str(root/'public-eas-lane.sh')],env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert (cache/'11.23.0/repaired').exists() and (cache/'10.12.3/keep').exists()
print('Observed corrupted-pnpm recovery regression passed; unrelated version preserved')
