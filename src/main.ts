import * as core from '@actions/core'
/*import {execFileSync} from 'child_process'*/
import {spawnSync} from 'child_process'
import {writeFileSync} from 'fs'

function run(): void {
  try {
    const interpreter: string = core.getInput('interpreter')
    const packages: string = core.getInput('packages')
    const flakes: string = core.getInput('flakes')
    const flakesFromDevshell: boolean = core.getBooleanInput(
      'flakes-from-devshell'
    )
    const script: string = core.getInput('script')
    const workingDirectory: string = core.getInput('working-directory')

    const nixWrapperPath = workingDirectory
      ? `./wrapper.sh`
      : `${__dirname}/wrapper.sh`
    const scriptPath = workingDirectory
      ? `./script.sh`
      : `${__dirname}/script.sh`

    const wrappedScript = `
set -uxo pipefail

${script}
   `
    writeFileSync(`${workingDirectory}/${scriptPath}`, wrappedScript, {
      mode: 0o755
    })

    const wrappedPackages = packages
      .split(',')
      .map(pkg => `nixpkgs.${pkg.trim()}`)
      .join(' ')

    const flakeWrappedPackages = flakesFromDevshell
      ? flakes
      : flakes.split(',').join(' ') ||
        packages
          .split(',')
          .map(pkg => `nixpkgs#${pkg.trim()}`)
          .join(' ')

    const nixCommand = flakesFromDevshell ? 'develop' : 'shell'

    const nixWrapper = `
set -uxo pipefail

verlte() {
    [  "$1" = "$(echo -e "$1\n$2" | sort -V | head -n1)" ]
}

verlt() {
    [ "$1" = "$2" ] && return 1 || verlte $1 $2
}

nix_version=$(nix --version | awk '{ print $3 }')

if verlt $nix_version 2.4
then
  # before nix 2.4: nix run
  nix run ${wrappedPackages} -c ${interpreter} ${scriptPath}
else
  # nix 2.4 and later: nix shell
  nix --experimental-features 'nix-command flakes' ${nixCommand} ${flakeWrappedPackages} -c ${interpreter} ${scriptPath}
fi
      `
    writeFileSync(`${workingDirectory}/${nixWrapperPath}`, nixWrapper, {
      mode: 0o755
    })
    const result = spawnSync(nixWrapperPath, {
      cwd: workingDirectory || undefined,
      stdio: 'inherit',
      shell: 'bash'
    })
    if (result.status === null && result.error) {
      core.info(result.error.toString())
    }
    core.info(result.stdout.toString())
  } catch (error) {
    core.error('error')
  }
}

run()
