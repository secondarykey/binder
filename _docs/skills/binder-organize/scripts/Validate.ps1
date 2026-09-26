<#
.SYNOPSIS
    バインダーの整合性（structures <-> 実体テーブル <-> 実体ファイル）を検証する。
.DESCRIPTION
    binder-organize スキルで編集した後に必ず実行する。
    ERROR が 1 件でもあれば exit 1。その場合はコミットしてはならない。
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Validate.ps1 -Path .
#>
param(
    [string]$Path = '.'
)

$ErrorActionPreference = 'Stop'
# 日本語出力が文字化けしないよう UTF-8 で書き出す
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$errors = New-Object System.Collections.ArrayList
$warns  = New-Object System.Collections.ArrayList

function Add-Err ([string]$m) { [void]$errors.Add($m) }
function Add-Warn([string]$m) { [void]$warns.Add($m) }

function Get-Field($row, [string]$name) {
    $p = $row.PSObject.Properties[$name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

$root  = (Resolve-Path $Path).Path
$dbDir = Join-Path $root 'db'
Write-Output "=== Validate: $root ==="

if (-not (Test-Path (Join-Path $dbDir 'structures.csv'))) {
    Write-Output "ERROR: db/structures.csv が無い"
    exit 1
}

# type ごとの実体ファイル・実体テーブルの対応
$entity = @{
    'note'    = @{ Dir = 'notes';    Ext = '.md';   Table = 'notes.csv'    }
    'diagram' = @{ Dir = 'diagrams'; Ext = '.md';   Table = 'diagrams.csv' }
    'asset'   = @{ Dir = 'assets';   Ext = '';      Table = 'assets.csv'   }
    'layer'   = @{ Dir = 'layers';   Ext = '.json'; Table = 'layers.csv'   }
}

# --- 実体テーブルの ID 集合を読む ---
$tableIds = @{}
foreach ($typ in $entity.Keys) {
    $tableIds[$typ] = @{}
    $tp = Join-Path $dbDir $entity[$typ].Table
    if (Test-Path $tp) {
        foreach ($r in (Import-Csv $tp -Encoding UTF8)) {
            $tableIds[$typ][$r.id] = $true
        }
    }
}

# --- structures を読む ---
$structures = @(Import-Csv (Join-Path $dbDir 'structures.csv') -Encoding UTF8)
$ids = @{}
foreach ($s in $structures) { $ids[$s.id] = $s }

Write-Output "structures: $($structures.Count) rows"

# --- 1. structure 行ごとの検査 ---
foreach ($s in $structures) {

    $typ = $s.type

    if (-not $entity.ContainsKey($typ)) {
        Add-Warn "未知の type: id=$($s.id) type=$typ (検査をスキップ)"
        continue
    }

    # 実体ファイル
    $rel = $entity[$typ].Dir + '/' + $s.id + $entity[$typ].Ext
    $fn  = Join-Path $root $rel
    if (-not (Test-Path $fn)) {
        Add-Err "実体ファイルが無い: $typ '$($s.name)' ($($s.id)) -> $rel"
    }

    # 実体テーブル行
    if (-not $tableIds[$typ].ContainsKey($s.id)) {
        Add-Err "実体テーブル行が無い: $typ '$($s.name)' ($($s.id)) -> db/$($entity[$typ].Table)"
    }

    # 親
    if ($s.id -eq 'index') {
        if (-not [string]::IsNullOrEmpty($s.parent_id)) {
            Add-Err "index の parent_id は空文字であるべき: parent_id=$($s.parent_id)"
        }
    } elseif ([string]::IsNullOrEmpty($s.parent_id)) {
        Add-Err "parent_id が空: '$($s.name)' ($($s.id))。index 以外は必ず親を持つ"
    } elseif ($s.parent_id -eq $s.id) {
        Add-Err "自己参照: '$($s.name)' ($($s.id))"
    } elseif (-not $ids.ContainsKey($s.parent_id)) {
        Add-Err "parent_id が存在しない: '$($s.name)' ($($s.id)) -> parent_id=$($s.parent_id)"
    }

    # 公開日時の書式
    foreach ($col in @('publish_date','republish_date')) {
        $v = Get-Field $s $col
        if ($null -ne $v -and $v -ne '' -and $v -notmatch '^\d{4}-\d{2}-\d{2}T') {
            Add-Err "$col の書式が不正: '$($s.name)' ($($s.id)) -> '$v'"
        }
    }
}

# --- 2. index からの到達性（循環・孤立の検出） ---
if ($ids.ContainsKey('index')) {
    $children = @{}
    foreach ($s in $structures) {
        if (-not $children.ContainsKey($s.parent_id)) {
            $children[$s.parent_id] = New-Object System.Collections.ArrayList
        }
        [void]$children[$s.parent_id].Add($s.id)
    }
    $seen = @{}
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue('index')
    $seen['index'] = $true
    while ($queue.Count -gt 0) {
        $cur = $queue.Dequeue()
        if ($children.ContainsKey($cur)) {
            foreach ($c in $children[$cur]) {
                if (-not $seen.ContainsKey($c)) {
                    $seen[$c] = $true
                    $queue.Enqueue($c)
                }
            }
        }
    }
    foreach ($s in $structures) {
        if (-not $seen.ContainsKey($s.id)) {
            Add-Err "index から到達できない（循環か孤立）: '$($s.name)' ($($s.id)) parent_id=$($s.parent_id)"
        }
    }
} else {
    Add-Err "index ノートの structure 行が無い"
}

# --- 3. alias の一意性（type 内） ---
$aliasSeen = @{}
foreach ($s in $structures) {
    if ([string]::IsNullOrEmpty($s.alias)) { continue }
    $key = $s.type + '/' + $s.alias
    if ($aliasSeen.ContainsKey($key)) {
        Add-Err "alias 重複: type=$($s.type) alias=$($s.alias) -> $($aliasSeen[$key]) と $($s.id)"
    } else {
        $aliasSeen[$key] = $s.id
    }
}

# --- 4. 同じ親の中での seq 重複 ---
$seqSeen = @{}
foreach ($s in $structures) {
    $key = $s.parent_id + '/' + $s.seq
    if ($seqSeen.ContainsKey($key)) {
        Add-Warn "seq 重複: parent_id=$($s.parent_id) seq=$($s.seq) -> $($seqSeen[$key]) と $($s.id)"
    } else {
        $seqSeen[$key] = $s.id
    }
}

# --- 5. structure 行を持たない実体ファイル（orphan） ---
foreach ($typ in $entity.Keys) {
    $dir = Join-Path $root $entity[$typ].Dir
    if (-not (Test-Path $dir)) { continue }
    $ext = $entity[$typ].Ext
    $dirName = $entity[$typ].Dir
    Get-ChildItem -Path $dir -File | ForEach-Object {
        if ($ext -ne '' -and $_.Extension -ne $ext) { return }
        if ($ext -eq '') { $id = $_.Name } else { $id = $_.BaseName }
        if (-not $ids.ContainsKey($id)) {
            Add-Warn "structure 行の無い $typ ファイル: $dirName/$($_.Name) (Binder を開いた時に index 直下へ自動登録される)"
        }
    }
}

# --- 6. CSV の列数がヘッダと一致するか（エスケープ漏れの検出） ---
Get-ChildItem -Path $dbDir -Filter '*.csv' | ForEach-Object {
    $name = $_.Name
    $lines = @(Get-Content $_.FullName -Encoding UTF8)
    if ($lines.Count -eq 0) { return }
    $expect = ($lines[0] -split ',').Count
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line.Contains('"')) { continue }   # クォート付きは単純分割できないので飛ばす
        $n = ($line -split ',').Count
        if ($n -ne $expect) {
            $head = $line.Substring(0, [Math]::Min(80, $line.Length))
            Add-Err "${name}:$($i+1) 列数が $n（ヘッダは $expect）。値のエスケープ漏れの可能性: $head"
        }
    }
}

# --- 7. Markdown 中のテンプレート関数の参照先が実在するか ---
$refPattern = '\{\{\s*(drawDiagram|assetsImage|assets|embed|drawLayer)\s+"([^"]+)"'
foreach ($sub in @('notes','diagrams')) {
    $dir = Join-Path $root $sub
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -Filter '*.md' -File | ForEach-Object {
        $fileName = $_.Name
        $lineNo = 0
        foreach ($line in (Get-Content $_.FullName -Encoding UTF8)) {
            $lineNo++
            foreach ($m in [regex]::Matches($line, $refPattern)) {
                $fn  = $m.Groups[1].Value
                $rid = $m.Groups[2].Value
                $where = "$sub/${fileName}:$lineNo {{$fn " + $rid + "}}"
                if (-not $ids.ContainsKey($rid)) {
                    Add-Err "$where の参照先が存在しない"
                    continue
                }
                $rtyp = $ids[$rid].type
                $ok = $true
                switch ($fn) {
                    'drawDiagram' { $ok = ($rtyp -eq 'diagram') }
                    'assetsImage' { $ok = ($rtyp -eq 'asset')   }
                    'assets'      { $ok = ($rtyp -eq 'asset')   }
                    'drawLayer'   { $ok = ($rtyp -eq 'layer')   }
                    'embed'       { $ok = ($rtyp -eq 'note' -or $rtyp -eq 'asset') }
                }
                if (-not $ok) {
                    Add-Err "$where の参照先の type が不正: type=$rtyp"
                }
            }
        }
    }
}

# --- 8. 未完成マーカー（TODO）の一覧。エラーではなく残作業の可視化 ---
$todos = New-Object System.Collections.ArrayList
foreach ($sub in @('notes','diagrams')) {
    $dir = Join-Path $root $sub
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -Filter '*.md' -File | Sort-Object Name | ForEach-Object {
        $fileName = $_.Name
        $entId = $fileName -replace '\.md$',''
        if ($ids.ContainsKey($entId)) { $label = $ids[$entId].name } else { $label = $entId }
        $lineNo = 0
        foreach ($line in (Get-Content $_.FullName -Encoding UTF8)) {
            $lineNo++
            if ($line -match 'TODO:') {
                $t = $line.Trim()
                if ($t.Length -gt 100) { $t = $t.Substring(0, 100) + '…' }
                [void]$todos.Add("$sub/${fileName}:$lineNo  [$label]  $t")
            }
        }
    }
}

# --- 結果 ---
Write-Output ""
foreach ($t in $todos)  { Write-Output "TODO : $t" }
if ($todos.Count -gt 0) { Write-Output "" }
foreach ($w in $warns)  { Write-Output "WARN : $w" }
foreach ($e in $errors) { Write-Output "ERROR: $e" }
Write-Output ""

if ($errors.Count -gt 0) {
    Write-Output "=== NG: ERROR $($errors.Count) 件 / WARN $($warns.Count) 件 / TODO $($todos.Count) 件。コミットしてはならない ==="
    exit 1
}

Write-Output "=== OK: ERROR 0 件 / WARN $($warns.Count) 件 / 未完成 TODO $($todos.Count) 件 ==="
exit 0
