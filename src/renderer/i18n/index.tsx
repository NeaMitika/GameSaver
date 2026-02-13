import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppLanguage } from '@shared/types';

const en = {
  common_close: 'Close',
  common_back: 'Back',
  common_cancel: 'Cancel',
  common_save: 'Save',
  common_saving: 'Saving...',
  common_browse: 'Browse',
  common_add_game: 'Add Game',
  common_open_settings: 'Open Settings',
  common_never: 'Never',
  header_settings: 'Settings',
  header_widget_mode: 'Widget mode',
  header_hide_to_tray: 'Hide to tray',
  header_scan_backups: 'Scan backups',
  header_app_version: 'App version {version}',
  app_recovery_mode_prefix: 'Recovery mode:',
  app_recovery_missing_path: 'Could not access {path}.',
  app_recovery_unavailable: 'Saved data path is unavailable.',
  app_data_folder_updated: 'Data folder updated. Restart required to fully switch app data.',
  app_restart_now: 'Restart Now',
  app_settings_saved: 'Settings saved.',
  app_recovery_still_active: 'Recovery mode is still active. Choose a reachable data folder.',
  dashboard_recovery_title: 'Recovery mode enabled',
  dashboard_recovery_description: 'Set a valid Data Folder in Settings to restore your games and backups.',
  dashboard_no_games_title: 'No games yet',
  dashboard_no_games_description: 'Add your first standalone game to start protecting saves.',
  widget_games_overview: 'Games Overview',
  widget_compact_summary: 'Compact widget summary',
  widget_tracked: '{count} tracked',
  widget_protected: 'Protected',
  widget_warnings: 'Warnings',
  widget_errors: 'Errors',
  widget_running: 'Running',
  widget_total_issues: 'Total Issues',
  widget_last_backup: 'Last Backup',
  row_no_install_folder: 'No install folder linked',
  row_open_details_for: 'Open details for {name}',
  row_backup: 'Backup',
  row_backup_now: 'Backup Now',
  status_protected: 'PROTECTED',
  status_warning: 'WARNING',
  status_error: 'ERROR',
  add_title: 'Add Game',
  add_description: 'Add by name, then optionally link the executable and install folder.',
  add_game_name: 'Game Name',
  add_game_name_placeholder: 'My Favorite RPG',
  add_exe_optional: 'Executable Path (Optional)',
  add_install_optional: 'Install Folder (Optional)',
  add_exe_placeholder: 'C:\\Games\\MyGame\\Game.exe',
  add_install_placeholder: 'C:\\Games\\MyGame',
  add_adding: 'Adding...',
  add_submit: 'Add Game',
  add_error_failed: 'Failed to add game.',
  settings_title: 'Settings',
  settings_description: 'Control retention and backup cadence.',
  settings_backup_frequency: 'Backup Frequency (minutes)',
  settings_retention_count: 'Retention Count (snapshots per game)',
  settings_storage_root: 'Storage Root',
  settings_storage_help: 'Changing storage root moves existing backups to the new folder.',
  settings_data_folder: 'Data Folder (Settings + DB + Backups)',
  settings_data_help: 'Changing this will restart the app and move data if needed.',
  settings_language: 'Language',
  settings_language_help: 'Select the language used by the app interface.',
  settings_save: 'Save Settings',
  settings_saving: 'Saving...',
  settings_error_failed: 'Failed to save settings.',
  detail_title: 'Game Details',
  detail_running: 'Running',
  detail_idle: 'Idle',
  detail_rename: 'Rename',
  detail_no_executable: 'No executable linked. Add one if you want one-click launch.',
  detail_change_exe: 'Change EXE',
  detail_set_exe: 'Set EXE',
  detail_launch_game: 'Launch game',
  detail_backup_now: 'Backup now',
  detail_save_locations_title: 'Save Locations',
  detail_save_locations_description: 'Sources monitored and included in backups.',
  detail_add_location: 'Add Location',
  detail_missing: 'Missing',
  detail_disable: 'Disable',
  detail_enable: 'Enable',
  detail_remove: 'Remove',
  detail_no_save_locations: 'No save locations configured.',
  detail_snapshots_title: 'Snapshots',
  detail_total_count: '{count} total',
  detail_verify: 'Verify',
  detail_restore: 'Restore',
  detail_delete: 'Delete',
  detail_no_snapshots: 'No snapshots yet.',
  detail_recent_activity: 'Recent Activity',
  detail_activity_log: 'activity.log',
  detail_entries_count: '{count} entries',
  detail_no_recent_events: 'No recent events.',
  detail_danger_zone: 'Danger Zone',
  detail_danger_description: 'Remove this game and delete its backups from disk.',
  detail_remove_game: 'Remove Game',
  detail_auto_detected: 'Auto-detected',
  detail_manual: 'Manual',
  detail_success_game_name_updated: 'Game name updated.',
  detail_error_failed_update_name: 'Failed to update game name.',
  detail_error_failed_pick_exe: 'Failed to pick executable path.',
  detail_success_exe_and_install_updated: 'Executable and install paths updated.',
  detail_success_exe_cleared: 'Executable path cleared.',
  detail_error_failed_update_exe: 'Failed to update executable path.',
  action_success_launch_requested: 'Game launch requested.',
  action_error_launch_failed: 'Failed to launch the game.',
  action_success_backup_completed: 'Backup request completed.',
  action_error_backup_failed: 'Failed to back up this game.',
  action_success_location_added: 'Save location added.',
  action_error_location_add_failed: 'Failed to add save location.',
  action_success_location_disabled: 'Save location disabled.',
  action_success_location_enabled: 'Save location enabled.',
  action_error_location_update_failed: 'Failed to update save location.',
  action_confirm_remove_location: 'Remove this save location? It will no longer be backed up.',
  action_success_location_removed: 'Save location removed.',
  action_error_location_remove_failed: 'Failed to remove save location.',
  action_success_snapshot_restored: 'Snapshot restored.',
  action_error_snapshot_restore_failed: 'Failed to restore snapshot.',
  action_confirm_delete_snapshot: 'Delete this snapshot? This cannot be undone.',
  action_success_snapshot_deleted: 'Snapshot deleted.',
  action_error_snapshot_delete_failed: 'Failed to delete snapshot.',
  action_success_snapshot_verified: 'Snapshot verified.',
  action_error_snapshot_issues: 'Snapshot has {count} issue(s).',
  action_error_snapshot_verify_failed: 'Failed to verify snapshot.',
  action_confirm_remove_game: 'Remove this game from GameSaver? Backups will be deleted.',
  action_success_game_removed: 'Game removed.',
  action_error_game_remove_failed: 'Failed to remove game.',
  dashboard_error_load_games_failed: 'Failed to load games.',
  dashboard_error_open_detail_failed: 'Failed to open game details.',
  dashboard_error_refresh_detail_failed: 'Failed to refresh game details.',
  dashboard_loading_scan_backups: 'Scanning backups...',
  dashboard_error_scan_detail_refresh_failed: 'Scan finished, but game details failed to refresh.',
  dashboard_error_scan_failed: 'Failed to scan existing backups.',
  dashboard_error_switch_layout_failed: 'Failed to switch view mode.'
} as const;

type TranslationKey = keyof typeof en;
type TranslationMap = Record<TranslationKey, string>;
type TranslationParams = Record<string, string | number>;

const fallbackLanguage: AppLanguage = 'en';

function withOverrides(overrides: Partial<TranslationMap>): TranslationMap {
  return { ...en, ...overrides };
}

const translations: Record<AppLanguage, TranslationMap> = {
  en,
  it: withOverrides({
    common_close: 'Chiudi',
    common_back: 'Indietro',
    common_cancel: 'Annulla',
    common_save: 'Salva',
    common_saving: 'Salvataggio...',
    common_browse: 'Sfoglia',
    common_add_game: 'Aggiungi gioco',
    common_open_settings: 'Apri impostazioni',
    common_never: 'Mai',
    header_settings: 'Impostazioni',
    header_widget_mode: 'Modalita widget',
    header_hide_to_tray: 'Nascondi nella tray',
    header_scan_backups: 'Scansiona backup',
    header_app_version: 'Versione app {version}',
    app_recovery_mode_prefix: 'Modalita recupero:',
    app_recovery_missing_path: 'Impossibile accedere a {path}.',
    app_recovery_unavailable: 'Percorso dati salvati non disponibile.',
    app_data_folder_updated: 'Cartella dati aggiornata. Riavvio necessario per completare il cambio.',
    app_restart_now: 'Riavvia ora',
    app_settings_saved: 'Impostazioni salvate.',
    app_recovery_still_active: 'La modalita recupero e ancora attiva. Scegli una cartella dati raggiungibile.',
    dashboard_recovery_title: 'Modalita recupero attiva',
    dashboard_recovery_description: 'Imposta una cartella dati valida nelle impostazioni per ripristinare giochi e backup.',
    dashboard_no_games_title: 'Nessun gioco',
    dashboard_no_games_description: 'Aggiungi il tuo primo gioco standalone per iniziare a proteggere i salvataggi.',
    widget_games_overview: 'Panoramica giochi',
    widget_compact_summary: 'Riepilogo widget compatto',
    widget_tracked: '{count} monitorati',
    widget_protected: 'Protetti',
    widget_warnings: 'Avvisi',
    widget_errors: 'Errori',
    widget_running: 'In esecuzione',
    widget_total_issues: 'Problemi totali',
    widget_last_backup: 'Ultimo backup',
    row_no_install_folder: 'Nessuna cartella installazione collegata',
    row_open_details_for: 'Apri dettagli per {name}',
    row_backup_now: 'Backup ora',
    status_protected: 'PROTETTO',
    status_warning: 'AVVISO',
    status_error: 'ERRORE',
    add_title: 'Aggiungi gioco',
    add_description: 'Aggiungi per nome e collega facoltativamente eseguibile e cartella installazione.',
    add_game_name: 'Nome gioco',
    add_game_name_placeholder: 'Il mio RPG preferito',
    add_exe_optional: 'Percorso eseguibile (opzionale)',
    add_install_optional: 'Cartella installazione (opzionale)',
    add_adding: 'Aggiunta...',
    add_submit: 'Aggiungi gioco',
    settings_title: 'Impostazioni',
    settings_description: 'Controlla retention e frequenza backup.',
    settings_backup_frequency: 'Frequenza backup (minuti)',
    settings_retention_count: 'Numero retention (snapshot per gioco)',
    settings_storage_root: 'Cartella backup',
    settings_storage_help: 'Cambiare cartella backup sposta i backup esistenti nella nuova cartella.',
    settings_data_folder: 'Cartella dati (Impostazioni + DB + Backup)',
    settings_data_help: 'Cambiare questa cartella riavvia l app e sposta i dati se necessario.',
    settings_language: 'Lingua',
    settings_language_help: 'Seleziona la lingua usata dall interfaccia.',
    settings_save: 'Salva impostazioni',
    settings_saving: 'Salvataggio...',
    detail_title: 'Dettagli gioco',
    detail_running: 'Attivo',
    detail_idle: 'Inattivo',
    detail_rename: 'Rinomina',
    detail_no_executable: 'Nessun eseguibile collegato. Aggiungilo per avvio rapido.',
    detail_change_exe: 'Cambia EXE',
    detail_set_exe: 'Imposta EXE',
    detail_launch_game: 'Avvia gioco',
    detail_backup_now: 'Backup ora',
    detail_save_locations_title: 'Percorsi salvataggi',
    detail_save_locations_description: 'Sorgenti monitorate e incluse nei backup.',
    detail_add_location: 'Aggiungi percorso',
    detail_missing: 'Mancante',
    detail_disable: 'Disattiva',
    detail_enable: 'Attiva',
    detail_remove: 'Rimuovi',
    detail_no_save_locations: 'Nessun percorso salvataggio configurato.',
    detail_snapshots_title: 'Snapshot',
    detail_total_count: '{count} totali',
    detail_verify: 'Verifica',
    detail_restore: 'Ripristina',
    detail_delete: 'Elimina',
    detail_no_snapshots: 'Nessuno snapshot.',
    detail_recent_activity: 'Attivita recente',
    detail_entries_count: '{count} voci',
    detail_no_recent_events: 'Nessun evento recente.',
    detail_danger_zone: 'Zona pericolosa',
    detail_danger_description: 'Rimuovi questo gioco ed elimina i backup dal disco.',
    detail_remove_game: 'Rimuovi gioco',
    detail_auto_detected: 'Auto-rilevato',
    detail_manual: 'Manuale'
  }),
  fr: withOverrides({
    common_close: 'Fermer',
    common_back: 'Retour',
    common_cancel: 'Annuler',
    common_save: 'Enregistrer',
    common_saving: 'Enregistrement...',
    common_browse: 'Parcourir',
    common_add_game: 'Ajouter un jeu',
    common_open_settings: 'Ouvrir les parametres',
    common_never: 'Jamais',
    header_settings: 'Parametres',
    header_widget_mode: 'Mode widget',
    header_hide_to_tray: 'Masquer dans la zone',
    header_scan_backups: 'Analyser les sauvegardes',
    header_app_version: 'Version application {version}',
    app_restart_now: 'Redemarrer maintenant',
    dashboard_no_games_title: 'Aucun jeu',
    add_title: 'Ajouter un jeu',
    settings_title: 'Parametres',
    settings_language: 'Langue',
    detail_title: 'Details du jeu'
  }),
  de: withOverrides({
    common_close: 'Schliessen',
    common_back: 'Zuruck',
    common_cancel: 'Abbrechen',
    common_save: 'Speichern',
    common_saving: 'Speichert...',
    common_browse: 'Durchsuchen',
    common_add_game: 'Spiel hinzufugen',
    common_open_settings: 'Einstellungen offnen',
    common_never: 'Nie',
    header_settings: 'Einstellungen',
    header_widget_mode: 'Widget-Modus',
    header_hide_to_tray: 'In Tray ausblenden',
    header_scan_backups: 'Backups scannen',
    header_app_version: 'App-Version {version}',
    app_restart_now: 'Jetzt neu starten',
    dashboard_no_games_title: 'Noch keine Spiele',
    add_title: 'Spiel hinzufugen',
    settings_title: 'Einstellungen',
    settings_language: 'Sprache',
    detail_title: 'Spieldetails'
  }),
  es: withOverrides({
    common_close: 'Cerrar',
    common_back: 'Atras',
    common_cancel: 'Cancelar',
    common_save: 'Guardar',
    common_saving: 'Guardando...',
    common_browse: 'Examinar',
    common_add_game: 'Agregar juego',
    common_open_settings: 'Abrir configuracion',
    common_never: 'Nunca',
    header_settings: 'Configuracion',
    header_widget_mode: 'Modo widget',
    header_hide_to_tray: 'Ocultar en bandeja',
    header_scan_backups: 'Escanear copias',
    header_app_version: 'Version de la app {version}',
    app_restart_now: 'Reiniciar ahora',
    dashboard_no_games_title: 'Aun no hay juegos',
    add_title: 'Agregar juego',
    settings_title: 'Configuracion',
    settings_language: 'Idioma',
    detail_title: 'Detalles del juego'
  })
};

const locales: Record<AppLanguage, string> = {
  en: 'en-US',
  it: 'it-IT',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES'
};

export const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Espanol' }
];

export function normalizeLanguageValue(value: unknown): AppLanguage {
  if (typeof value !== 'string') {
    return fallbackLanguage;
  }
  const normalized = value.trim().toLowerCase().split('-')[0];
  if (normalized === 'it' || normalized === 'fr' || normalized === 'de' || normalized === 'es') {
    return normalized;
  }
  return fallbackLanguage;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token: string) => {
    const value = params[token];
    return value === undefined ? '' : String(value);
  });
}

type I18nContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: fallbackLanguage,
  locale: locales[fallbackLanguage],
  setLanguage: () => undefined,
  t: (key, params) => interpolate(en[key], params)
});

export function I18nProvider({
  children,
  initialLanguage
}: {
  children: ReactNode;
  initialLanguage?: AppLanguage;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(normalizeLanguageValue(initialLanguage ?? fallbackLanguage));

  useEffect(() => {
    if (!initialLanguage) {
      return;
    }
    setLanguageState(normalizeLanguageValue(initialLanguage));
  }, [initialLanguage]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(normalizeLanguageValue(nextLanguage));
  }, []);

  const dictionary = translations[language] ?? translations[fallbackLanguage];
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: locales[language],
      setLanguage,
      t: (key, params) => interpolate(dictionary[key] ?? en[key], params)
    }),
    [dictionary, language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
