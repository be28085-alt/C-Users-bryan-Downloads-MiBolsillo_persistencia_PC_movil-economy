param(
    [string]$QtRoot = 'C:\Qt',
    [string]$QtVersion = '6.12.0',
    [string]$MinGWDirectory = 'mingw1310_64',
    [string]$BuildDirectory = (Join-Path $PSScriptRoot 'build/windows'),
    [switch]$Run
)

$ErrorActionPreference = 'Stop'
$qtPrefix = Join-Path $QtRoot "$QtVersion/mingw_64"
$compilerBin = Join-Path $QtRoot "Tools/$MinGWDirectory/bin"
$cmake = Join-Path $QtRoot 'Tools/CMake_64/bin/cmake.exe'
$ninja = Join-Path $QtRoot 'Tools/Ninja/ninja.exe'
foreach ($tool in @($cmake, $ninja, (Join-Path $compilerBin 'g++.exe'), (Join-Path $qtPrefix 'bin/qmake.exe'))) {
    if (-not (Test-Path -LiteralPath $tool)) { throw "No se encuentra la herramienta: $tool" }
}
$env:PATH = "$compilerBin;$(Join-Path $qtPrefix 'bin');$(Split-Path $ninja);$env:PATH"

& $cmake -S $PSScriptRoot -B $BuildDirectory -G Ninja "-DCMAKE_PREFIX_PATH=$qtPrefix" "-DCMAKE_MAKE_PROGRAM=$ninja" -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) { throw "La configuración CMake falló ($LASTEXITCODE)." }
& $cmake --build $BuildDirectory --parallel 2
if ($LASTEXITCODE -ne 0) { throw "La compilación falló ($LASTEXITCODE)." }
Write-Output "Ejecutable: $(Join-Path $BuildDirectory 'GestorFinanciero.exe')"
if ($Run) {
    & (Join-Path $BuildDirectory 'GestorFinanciero.exe')
}
