<#
.SYNOPSIS
    バインダーを編集してよい状態かを検査する。
.DESCRIPTION
    binder-organize スキルの最初に必ず実行する。
    エラーが 1 件でもあれば exit 1。その場合は編集を開始してはならない。
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Preflight.ps1 -Path .
#>
param(
    [string]$Path = '.'
)

$ErrorActionPreference = 'Stop'
# 日本語出力が文字化けしないよう UTF-8 で書き出す
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$errors = New-Object System.Collections.ArrayList

function Add-Err([string]$m) { [void]$errors.Add($m); Write-Output "ERROR: $m" }
function Add-Ok ([string]$m) { Write-Output "OK   : $m" }

$root = (Resolve-Path $Path).Path
Write-Output "=== Preflight: $root ==="

# --- バインダーであることの確認 ---
$metaPath = Join-Path $root 'binder.json'
if (Test-Path $metaPath) {
    try {
        $meta = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $v = $meta.version
        $n = $meta.name
        Add-Ok "binder.json あり (version=$v, name=$n)"
    } catch {
        Add-Err "binder.json を JSON として読めない: $($_.Exception.Message)"
    }
} else {
    Add-Err "binder.json が無い。ここはバインダーではない（Binder アプリのソースリポジトリではないか確認すること）"
}

# --- git リポジトリであることの確認 ---
$gitPath = Join-Path $root '.git'
if (Test-Path $gitPath) {
    Add-Ok ".git あり"
} else {
    Add-Err ".git が無い。バインダーは git リポジトリである必要がある"
}

# --- Binder アプリが動作中でないことの確認 ---
$lockPath = Join-Path $root '.git\index.lock'
if (Test-Path $lockPath) {
    Add-Err ".git/index.lock がある。Binder アプリが動作中の可能性。アプリを閉じてから再実行すること"
} else {
    Add-Ok ".git/index.lock なし"
}

# --- ワークツリーがクリーンであることの確認 ---
if (Test-Path $gitPath) {
    Push-Location $root
    try {
        $st = & git status --porcelain 2>&1
        if ($LASTEXITCODE -ne 0) {
            Add-Err "git status が失敗した: $st"
        } elseif ([string]::IsNullOrWhiteSpace(($st | Out-String))) {
            Add-Ok "ワークツリーはクリーン"
        } else {
            Add-Err "未コミットの変更がある。先に Binder アプリで記録するか git commit すること:"
            $st | ForEach-Object { Write-Output "       $_" }
        }
    } finally {
        Pop-Location
    }
}

# --- CSV のヘッダ行を提示（この回の作業前提として固定する） ---
$dbDir = Join-Path $root 'db'
if (Test-Path $dbDir) {
    Write-Output ""
    Write-Output "--- db/*.csv のヘッダ（列順・列有無はここを正とする） ---"
    Get-ChildItem -Path $dbDir -Filter '*.csv' | Sort-Object Name | ForEach-Object {
        $head = Get-Content $_.FullName -TotalCount 1 -Encoding UTF8
        $rows = (Get-Content $_.FullName -Encoding UTF8 | Measure-Object -Line).Lines - 1
        Write-Output "$($_.Name) [$rows rows]"
        Write-Output "  $head"
    }
} else {
    Add-Err "db/ ディレクトリが無い"
}

# --- marked プラグイン（レンダリングに効くのはバインダー内のものだけ） ---
$binderPlug = Join-Path $root 'plugins\marked'
$appPlug    = Join-Path $env:USERPROFILE '.binder\plugins\marked'

$active  = @()
$library = @()
if (Test-Path $binderPlug) {
    $active = @(Get-ChildItem $binderPlug -Filter '*.js' -File | ForEach-Object { $_.BaseName })
}
if (Test-Path $appPlug) {
    $library = @(Get-ChildItem $appPlug -Filter '*.js' -File | ForEach-Object { $_.BaseName })
}

Write-Output ""
Write-Output "--- marked プラグイン ---"
if ($active.Count -gt 0) {
    Write-Output "有効 (plugins/marked/)         : $($active -join ', ')"
} else {
    Write-Output "有効 (plugins/marked/)         : なし"
}
if ($library.Count -gt 0) {
    Write-Output "ライブラリ (~/.binder/plugins/): $($library -join ', ')"
}
if ($active -contains 'containers') {
    Write-Output "CONTAINERS=active     ::: warning 形式のマーカーが使える"
} elseif ($library -contains 'containers') {
    Write-Output "CONTAINERS=available  未有効。ユーザに確認して有効化できる（ライブラリからコピー）"
} else {
    Write-Output "CONTAINERS=none       引用ブロック形式のマーカーへフォールバックする"
}

Write-Output ""
if ($errors.Count -gt 0) {
    Write-Output "=== NG: $($errors.Count) 件のエラー。編集を開始してはならない ==="
    exit 1
}

Write-Output "=== OK: 編集可能 ==="
Write-Output ""
Write-Output "注意: Binder アプリでこのバインダーを開いていないかユーザに必ず確認すること。"
Write-Output "      go-git はインデックスを直接書き込むため、同時編集で .git/index が壊れる。"
exit 0
