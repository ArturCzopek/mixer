[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$buildRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "backtest/.local/demo-build"))
$repositoryPrefix = $repositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $buildRoot.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The build scratch directory must stay inside the repository."
}

$demoParserCommit = "45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8"
$gameTrackingCommit = "ac1278dbbff39b7fe5030fba42a010e455c011f6"
$dockerImage = "rust:1-bookworm@sha256:114c7a4425406451c2866b6aafe69fe29b1b298832db1277d411ac73c82d04d6"
$demoParserPath = Join-Path $buildRoot "demoparser2"
$gameTrackingPath = Join-Path $buildRoot "GameTracking-CS2"
$outputPath = Join-Path $buildRoot "web-wasm"

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory)] [string] $FilePath,
        [Parameter(Mandatory)] [string[]] $Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath exited with code $LASTEXITCODE."
    }
}

function Get-GitValue {
    param(
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [string[]] $Arguments
    )

    $value = & git -C $Path @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect pinned source at $Path."
    }
    return ($value | Out-String).Trim()
}

function Assert-SafeScratchPath {
    $path = $buildRoot
    while ($path.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        if (Test-Path -LiteralPath $path) {
            $item = Get-Item -Force -LiteralPath $path
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Scratch path contains a link or junction: $path"
            }
        }
        $parent = [System.IO.Directory]::GetParent($path)
        if ($null -eq $parent) { break }
        $path = $parent.FullName
    }
}

function Ensure-PinnedCheckout {
    param(
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [string] $Url,
        [Parameter(Mandatory)] [string] $Commit,
        [string[]] $SparsePaths
    )

    if (Test-Path -LiteralPath $Path) {
        if (-not (Test-Path -LiteralPath (Join-Path $Path ".git"))) {
            throw "Refusing to reuse a non-Git source directory: $Path"
        }
        $origin = Get-GitValue -Path $Path -Arguments @("config", "--get", "remote.origin.url")
        $head = Get-GitValue -Path $Path -Arguments @("rev-parse", "HEAD")
        $status = Get-GitValue -Path $Path -Arguments @("status", "--porcelain")
        if ($origin -ne $Url -or $head -ne $Commit -or $status) {
            throw "Refusing to reset or overwrite a source checkout that is not clean at ${Commit}: $Path"
        }
        return
    }

    $cloneArguments = @("clone", "--filter=blob:none", "--no-checkout", "--depth=1")
    if ($SparsePaths.Count) { $cloneArguments += "--sparse" }
    $cloneArguments += @($Url, $Path)
    Invoke-CheckedNative -FilePath "git" -Arguments $cloneArguments
    Invoke-CheckedNative -FilePath "git" -Arguments @("-C", $Path, "fetch", "--depth=1", "origin", $Commit)
    if ($SparsePaths.Count) {
        $sparseArguments = @("-C", $Path, "sparse-checkout", "set") + $SparsePaths
        Invoke-CheckedNative -FilePath "git" -Arguments $sparseArguments
    }
    Invoke-CheckedNative -FilePath "git" -Arguments @("-C", $Path, "checkout", "--detach", $Commit)

    $head = Get-GitValue -Path $Path -Arguments @("rev-parse", "HEAD")
    if ($head -ne $Commit) { throw "Checkout did not resolve to the requested commit: $Path" }
}

Assert-SafeScratchPath
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
Assert-SafeScratchPath
Ensure-PinnedCheckout `
    -Path $demoParserPath `
    -Url "https://github.com/LaihoE/demoparser.git" `
    -Commit $demoParserCommit
Ensure-PinnedCheckout `
    -Path $gameTrackingPath `
    -Url "https://github.com/SteamDatabase/GameTracking-CS2.git" `
    -Commit $gameTrackingCommit `
    -SparsePaths @(
        "Protobufs",
        "game/csgo/pak01_dir/scripts/items",
        "game/csgo/pak01_dir/resource"
    )

foreach ($relativePath in @(
    "Protobufs/demo.proto",
    "game/csgo/pak01_dir/scripts/items/items_game.txt",
    "game/csgo/pak01_dir/resource/csgo_english.txt"
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $gameTrackingPath $relativePath) -PathType Leaf)) {
        throw "Required pinned GameTracking input is missing: $relativePath"
    }
}

$patchPath = Join-Path $repositoryRoot "lib/demo/upstream-profiling.patch"
if (-not (Test-Path -LiteralPath $patchPath)) {
    throw "Expected upstream compatibility patch is missing: $patchPath"
}
[System.IO.File]::WriteAllText(
    (Join-Path $buildRoot "upstream-profiling.patch"),
    [System.IO.File]::ReadAllText($patchPath).Replace("`r`n", "`n"),
    [System.Text.UTF8Encoding]::new($false)
)
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$containerScript = @'
#!/usr/bin/env bash
set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends protobuf-compiler=3.21.12-3+deb12u1
rustup target add wasm32-unknown-unknown

bindgen_archive=/tmp/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl.tar.gz
curl --fail --location --retry 3 \
  --output "$bindgen_archive" \
  https://github.com/rustwasm/wasm-bindgen/releases/download/0.2.100/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl.tar.gz
printf '%s  %s\n' \
  63d6a38deb65bd7023c02bdf382ab66b0d2c0241c8582fd3413b5a808b8aeb5b \
  "$bindgen_archive" | sha256sum --check --status
mkdir -p /tmp/wasm-bindgen
tar -xzf "$bindgen_archive" -C /tmp/wasm-bindgen

work=/tmp/demo-wasm-build
mkdir -p "$work"
cp -a /build/demoparser2 "$work/demoparser2"
cp -a /build/GameTracking-CS2 "$work/demoparser2/src/csgoproto/GameTracking-CS2"
cd "$work/demoparser2"
git -c core.autocrlf=false checkout-index --force --all
git apply --check /build/upstream-profiling.patch
git apply /build/upstream-profiling.patch

python3 - <<'PY'
from pathlib import Path

build_rs = Path("src/csgoproto/build.rs")
source = build_rs.read_text()
old_import = "use std::{io::Result, process::Command};"
new_import = "use std::{io::Result, path::Path, process::Command};"
old_clone = '''    Command::new("git")
        .args([
            "clone",
            "https://github.com/SteamDatabase/GameTracking-CS2.git",
            "--depth=1",
        ])
        .status()?;'''
new_clone = '''    if !Path::new("GameTracking-CS2").exists() {
        let status = Command::new("git")
            .args([
                "clone",
                "https://github.com/SteamDatabase/GameTracking-CS2.git",
                "--depth=1",
            ])
            .status()?;
        if !status.success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Failed to clone GameTracking-CS2",
            ));
        }
    }'''
if old_import not in source or old_clone not in source:
    raise SystemExit("Unexpected upstream csgoproto build.rs; refusing to patch it")
build_rs.write_text(source.replace(old_import, new_import, 1).replace(old_clone, new_clone, 1))

parser_build = Path("src/parser/build.rs")
source = parser_build.read_text()
old_command = '.args(["run", if profile == "release" { "--release" } else { "" }])'
new_command = '.args(["run", "--locked", if profile == "release" { "--release" } else { "" }])'
if old_command not in source:
    raise SystemExit("Unexpected upstream parser build.rs; refusing to change its Cargo invocation")
parser_build.write_text(source.replace(old_command, new_command, 1))

wasm_lib = Path("src/wasm/src/lib.rs")
source = wasm_lib.read_text()
if "init_panic_hook" in source:
    raise SystemExit("Unexpected upstream panic hook; refusing to append a duplicate")
source += '''
\n#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        web_sys::console::error_1(&JsValue::from_str(&info.to_string()))
    }));
}
'''
wasm_lib.write_text(source)
PY

cd "$work/demoparser2/src/wasm"
cargo build --locked --release --target wasm32-unknown-unknown
"/tmp/wasm-bindgen/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl/wasm-bindgen" \
  --target web \
  --out-dir /build/web-wasm \
  --out-name demoparser2 \
  target/wasm32-unknown-unknown/release/demoparser2.wasm
'@
$containerScriptPath = Join-Path $buildRoot "build-wasm.sh"
[System.IO.File]::WriteAllText(
    $containerScriptPath,
    $containerScript,
    [System.Text.UTF8Encoding]::new($false)
)

$mount = "type=bind,source=$buildRoot,target=/build"
Invoke-CheckedNative -FilePath "docker" -Arguments @(
    "run", "--rm", "--platform", "linux/amd64", "--mount", $mount,
    "--workdir", "/build", $dockerImage, "bash", "/build/build-wasm.sh"
)

$runtimeFiles = @("demoparser2.js", "demoparser2_bg.wasm")
foreach ($name in $runtimeFiles) {
    $path = Join-Path $outputPath $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Expected generated runtime file is missing: $path"
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
    Write-Host "$hash  $path"
}

Write-Host "Generated WebAssembly bindings: $outputPath"
