<#
.SYNOPSIS
    Binder アプリがこのバインダーを開いているかを判定する（Preflight.ps1 / Validate.ps1 から読み込む）。
.DESCRIPTION
    Binder はバインダーを開いている間、.git/ に次の 2 つを置く（アプリの fs/openmark.go）:
      binder-open.lock  OS のファイルロックを掛けたまま開いている。判定の正
      binder-open.json  誰が開いているか（pid / host / app / openedAt）。表示用
    ロックファイルを排他（FileShare None）で開けなければ、アプリが開いている。
    アプリが落ちると OS がロックを外すので、残ったファイルは「古い印」になる。

    State の値:
      live        このPCの Binder が開いている。編集してはならない
      other-host  印は残っているが別のPCのもの（同期フォルダ等）。ここからは判定できない
      stale       印は残っているがロックされていない（前回 Binder が正しく閉じなかった）。開いていない
      none        印が無い。印を出す Binder なら開いていない
      unknown     ロックファイルを確かめられなかった（権限等）
#>

$script:BinderOpenMarkerSince = [version]'0.17.3'  # この版より新しい Binder が印を出す

function Get-BinderOpenState([string]$Root) {
    $git      = Join-Path $Root '.git'
    $lockPath = Join-Path $git 'binder-open.lock'
    $infoPath = Join-Path $git 'binder-open.json'

    $info = $null
    if (Test-Path $infoPath) {
        try { $info = Get-Content $infoPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    }

    $detail = ''
    if ($info) { $detail = "pid=$($info.pid) host=$($info.host) app=$($info.app) 開いた時刻=$($info.openedAt)" }

    if (-not (Test-Path $lockPath)) {
        return [pscustomobject]@{ State = 'none'; Detail = $detail }
    }

    $state = 'stale'
    try {
        $fs = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $fs.Close()
    } catch [System.IO.IOException] {
        $state = 'live'
    } catch {
        $state = 'unknown'
        $detail = "$detail ($($_.Exception.Message))".Trim()
    }

    if ($state -eq 'stale' -and $info -and $info.host) {
        $names = @([Environment]::MachineName, [System.Net.Dns]::GetHostName())
        if (-not ($names | Where-Object { $_ -ieq $info.host })) { $state = 'other-host' }
    }

    return [pscustomobject]@{ State = $state; Detail = $detail }
}

# 印が無いとき、それを「閉じている」と信じてよいか。
# binder.json の version は最後にこのバインダーを開いた Binder の版。印を出す版なら信じてよい
function Test-BinderOpenMarkerTrusted($BinderVersion) {
    try { return ([version]"$BinderVersion" -gt $script:BinderOpenMarkerSince) } catch { return $false }
}
