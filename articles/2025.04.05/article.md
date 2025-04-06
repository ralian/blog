# Using Ninja outside of the Windows Developer Powershell

Building a CMake project on Windows with MSVC?

Normally your easiest two options are
1. Use the latest Visual Studio generator which uses the slow MSBuild scheduler
2. Use Ninja which requires either the Visual Studio CMake tools or at least fooling around with the Developer Powershell and vcpkg

But, what if we set the environment variables Ninja needed to call MSVC before calling the generator? In fact, it's a bit kludgy, but we can do this with CMake Presets.

Here is what I came up with:

```Powershell

<# PresetGenerator.ps1
This script grabs all the environment variables, calls vcvarsall.bat, diffs the environment variables, then writes the diff to your user preset file.
This is ONLY required if you intend to do CMake builds with Ninja OUTSIDE of the Visual Studio IDE.
#>

param (
    [switch] $force,
    [string] $vsfolder = '2022',
    [string] $edition = 'Community'
)

if ($force -or -not (Test-Path -Path 'CMakeUserPresets.json')) {
    Write-Host "Generating CMakeUserPresets.json"
} else {
    Write-Host "CMakeUserPresets.json already exists. Use -force to overwrite."
    exit
}

pushd "C:\Program Files\Microsoft Visual Studio\$vsfolder\$edition\VC\Auxiliary\Build"
gci env: | ConvertTo-Json | Out-File -FilePath ~\VCVarsEnvBefore.json
cmd /c ".\vcvarsall.bat x64 && start powershell -command `"gci env: | ConvertTo-Json | Out-File -FilePath ~\VCVarsEnvAfter.json`"" | Out-Null
popd

$Before = Get-Content ~\VCVarsEnvBefore.json | Out-String | ConvertFrom-Json
$After = Get-Content ~\VCVarsEnvAfter.json | Out-String | ConvertFrom-Json
$EnvDiff = Compare-Object $Before $After -Property Name, Value -PassThru | Where-Object { $_.SideIndicator -eq '=>' }

$KVPairs = $EnvDiff | Select-Object -Property Key,Value
$KVPairs | ConvertTo-Json | Out-File -FilePath ~\VCVarsEnvDiff.json

# This is a nasty conversion that has to happen by hand. Simply casting a hashtable to a PSCustomObject doesn't work.
$EnvMap = [PSCustomObject] @{}
$KVPairs | ForEach-Object -Process { $EnvMap | Add-Member -NotePropertyName $_.Key -NotePropertyValue $_.Value }

$CacheVariables = [PSCustomObject] @{
    CMAKE_C_COMPILER = 'cl'
    CMAKE_CXX_COMPILER = 'cl'
}

$CLPreset = [PSCustomObject] @{
    name = 'cl-ninja'
    generator = 'Ninja'
    binaryDir = '${sourceDir}/build/${presetName}'
    cacheVariables = $CacheVariables
    environment = $EnvMap
}

$UserPreset = [PSCustomObject] @{
    version = 4
    configurePresets = @(
        $CLPreset
    )
    buildPresets = @(
        @{
            name = 'cl-ninja'
            configurePreset = 'cl-ninja'
        }
    )
}

$UserPreset | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 -FilePath CMakeUserPresets.json
```

You can test this with the following commands in your project dir:

```
.\PresetGenerator.ps1 -force -vsfolder 2022 -edition Community
cmake --preset cl-ninja
cmake --build --preset cl-ninja
```

You'll have to forgive me for some of the hacky conversions happening here. Also, this only generates a new CMakeUserPresets.json instead of doing a json merge.

This could be further improved by doing a diff of environment variables before and after we call vcvarsall.

I don't recommend using this in production, but it is interesting.

