; Allow selecting a drive root (e.g. E:\) in the assisted installer.
; The default assisted script then normalizes it to E:\${APP_FILENAME}.
AllowRootDirInstall true

; Reinstall/update should keep portable data folder in the same install directory.
!define /ifndef PORTABLE_DATA_DIR "${APP_FILENAME}Data"

!ifdef BUILD_UNINSTALLER
Function un.RemoveInstallDirContentsExceptPortableData
  Push $R0
  Push $R1

  FindFirst $R0 $R1 "$INSTDIR\*.*"
  loop:
    StrCmp $R1 "" done
    StrCmp $R1 "." next
    StrCmp $R1 ".." next
    StrCmp $R1 "${PORTABLE_DATA_DIR}" next

    IfFileExists "$INSTDIR\$R1\*.*" isDir isFile

    isDir:
      RMDir /r "$INSTDIR\$R1"
      Goto next

    isFile:
      Delete "$INSTDIR\$R1"

    next:
      FindNext $R0 $R1
      Goto loop

  done:
    FindClose $R0
    Pop $R1
    Pop $R0
FunctionEnd

!macro customRemoveFiles
  ${if} ${isUpdated}
    Call un.RemoveInstallDirContentsExceptPortableData
  ${else}
    ; keep default full cleanup for explicit uninstall
    SetOutPath $TEMP
    RMDir /r $INSTDIR
  ${endif}
!macroend
!endif
